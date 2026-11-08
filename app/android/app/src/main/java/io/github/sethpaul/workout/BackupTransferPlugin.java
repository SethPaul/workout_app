package io.github.sethpaul.workout;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Moves backup JSON files in and out of the app without any storage
 * permissions, using the Storage Access Framework and content URIs:
 *
 * - saveFile: system "create document" picker (Downloads, Drive, ...).
 * - openFile: system "open document" picker. Any file type is selectable,
 *   because providers often report a downloaded .json as octet-stream; the
 *   web layer validates the contents.
 * - backupReceived event: a file opened with ("Open with Workout") or shared
 *   to the app. The launch intent is delivered here too (BridgeActivity
 *   forwards it), and the event is retained until the web layer subscribes.
 *
 * The JS side lives in src/platform/backupIO.ts.
 */
@CapacitorPlugin(name = "BackupTransfer")
public class BackupTransferPlugin extends Plugin {

    /** Backups are a few MB at most; refuse anything absurd rather than OOM. */
    private static final int MAX_BYTES = 32 * 1024 * 1024;

    private final ExecutorService io = Executors.newSingleThreadExecutor();

    // --- Save ---------------------------------------------------------------

    @PluginMethod
    public void saveFile(PluginCall call) {
        String filename = call.getString("filename", "workout-backup.json");
        if (call.getString("data") == null) {
            call.reject("Missing data");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onSaveResult");
    }

    @ActivityCallback
    private void onSaveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = resultUri(result);
        if (uri == null) {
            JSObject ret = new JSObject();
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        String data = call.getString("data", "");
        io.execute(() -> {
            // "wt" truncates, so overwriting an existing file can't leave a
            // longer file's tail behind (which would corrupt the JSON).
            try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("Could not open the destination for writing");
                out.write(data.getBytes(StandardCharsets.UTF_8));
                JSObject ret = new JSObject();
                ret.put("saved", true);
                ret.put("uri", uri.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not save the backup: " + e.getMessage(), e);
            }
        });
    }

    // --- Open ---------------------------------------------------------------

    @PluginMethod
    public void openFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "onOpenResult");
    }

    @ActivityCallback
    private void onOpenResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = resultUri(result);
        if (uri == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }
        io.execute(() -> {
            try {
                JSObject ret = new JSObject();
                ret.put("name", displayName(uri));
                ret.put("text", readText(uri));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not read the file: " + e.getMessage(), e);
            }
        });
    }

    // --- Incoming (Open with / Share to) ------------------------------------

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        Uri uri = null;
        String sharedText = null;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = streamExtra(intent);
            if (uri == null) sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        } else {
            return;
        }
        if (uri == null && sharedText == null) return;

        // Don't re-import the same file if the activity is recreated with
        // the original intent.
        intent.setAction(null);

        final Uri source = uri;
        final String text = sharedText;
        io.execute(() -> {
            JSObject payload = new JSObject();
            if (source == null) {
                payload.put("name", "shared text");
                payload.put("text", text);
            } else {
                payload.put("name", displayName(source));
                try {
                    payload.put("text", readText(source));
                } catch (Exception e) {
                    payload.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
                }
            }
            getBridge().executeOnMainThread(() -> notifyListeners("backupReceived", payload, true));
        });
    }

    // --- Helpers ------------------------------------------------------------

    private static Uri resultUri(ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) return null;
        return result.getData().getData();
    }

    @SuppressWarnings("deprecation")
    private static Uri streamExtra(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        }
        return intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    private String displayName(Uri uri) {
        String fallback = uri.getLastPathSegment() != null ? uri.getLastPathSegment() : "backup.json";
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) return fallback;
        try (
            Cursor c = getContext()
                .getContentResolver()
                .query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)
        ) {
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getString(0);
        } catch (Exception ignored) {
            // Some providers don't support the query; the fallback is fine.
        }
        return fallback;
    }

    private String readText(Uri uri) throws IOException {
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("The file could not be opened");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            int total = 0;
            int n;
            while ((n = in.read(chunk)) != -1) {
                total += n;
                if (total > MAX_BYTES) throw new IOException("The file is too large to be a workout backup");
                buf.write(chunk, 0, n);
            }
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
