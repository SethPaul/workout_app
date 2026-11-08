# Android app

The Android app is the same web app, packaged with [Capacitor](https://capacitorjs.com/).
The production bundle ships inside the APK, so the app works fully offline and doesn't
depend on the hosted site.

| Path | What it is |
|---|---|
| `capacitor.config.ts` | App id (`io.github.sethpaul.workout`), name, system-bar / safe-area handling. |
| `android/` | Native project (Gradle). Mostly Capacitor's template. |
| `android/app/src/main/java/.../BackupTransferPlugin.java` | Native side of backup save / open / "Open with". |
| `src/platform/backupIO.ts` | JS side: picks the browser or native path for each backup action. |
| `.github/workflows/android.yml` | Builds the APK on every PR and push to `main`. |

## Data: moving from the web app to Android

**The Android app has its own storage.** It does not see data saved in the browser (even
on the same phone), and the browser doesn't see the app's data. Use a backup file to move
everything — workouts, logs, movements, settings — in one go:

1. **In the web app:** Settings → Backup → **Export JSON**. This downloads
   `workout-backup-YYYY-MM-DD.json`. (In Safari, **Share backup** is also offered.)
2. **Get the file onto the phone:** email it to yourself, put it in Google Drive, or copy it
   over USB. If you exported from a phone browser, it is already in Downloads.
3. **In the Android app**, either:
   - tap the file (in Files, Downloads, Drive, or a Gmail attachment) and choose
     **Workout** from "Open with", or share it to Workout, **or**
   - open Settings → Backup → **Import JSON** and pick the file. Any file type can be
     picked, because Android often labels downloaded `.json` files as generic binaries;
     the contents are checked before anything changes.
4. Check the confirmation. Before replacing anything it shows the file name, when it was
   exported, what it holds, what's on the device now, and **a warning if any workouts
   logged on the device aren't in the backup** (they would be lost). Cancel and nothing
   changes.

The same steps work the other way round (Android → web), and between two phones. On
Android, **Save backup to a file** lets you choose where it goes (Downloads, Drive, ...)
and **Share backup** opens the share sheet.

Backups are plain JSON in the format described in `SPEC.md`. Older backups (schema v1/v2,
or with no `exportedAt` stamp) still import; they're migrated on load. A file saved by a
text editor with a byte-order mark is accepted too.

### Don't lose data on reinstall

Uninstalling the app deletes its data. Updating does not — **as long as the new APK is
signed with the same key** and has a higher version code. Installing an APK signed with a
different key fails with "App not installed / conflicts with an existing package", and the
only way around it is to uninstall (losing the data). So:

- Export a backup before uninstalling or switching between debug and release builds.
- Set up a release key (below) **before** you install the app for real use.

## Build

### In CI (no local Android tooling needed)

Every PR and every push to `main` that touches `app/` runs the **Android** workflow. The APK
is attached to the run as an artifact (`workout-android-<version>`). Publishing a GitHub
release also attaches the APK to the release, which is the easiest way to download it on a
phone.

`versionCode` is the workflow run number, so each CI build upgrades the previous one in
place.

#### Release signing

Without signing secrets, CI builds a **debug** APK signed with a throwaway key that changes
every run — fine for trying the app, but each new build will need an uninstall. To get
upgradeable builds, create a key once and add it as repository secrets:

```sh
keytool -genkeypair -v -keystore workout-release.keystore -alias workout \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 workout-release.keystore   # macOS: base64 -i workout-release.keystore
```

Then in GitHub → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 output |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `workout` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | the key password |

Keep the keystore file and passwords somewhere safe (a password manager). If the key is
lost, future builds can't update the installed app.

### Locally

Needs JDK 21 and the Android SDK (Android Studio installs both).

```sh
cd app
npm install
npm run android:sync     # vite build --mode native, then copy into android/
npm run android:open     # open in Android Studio, then Run ▶
# or, from the command line:
cd android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```

Run `npm run android:sync` after every web change; Android Studio only sees the copied
bundle. `--mode native` skips the service worker (the assets are already local, and a
cached worker would keep serving an old bundle after an app update).

To install a CI-built APK, download it on the phone and allow "Install unknown apps" for
the browser or Files app when prompted, or use `adb install -r workout-*.apk`.

## Notes

- **Permissions:** only `INTERNET` (Capacitor's default; the app makes no network calls)
  and `VIBRATE` (vibration cues). File save/open use the system pickers, so no storage
  permission is needed.
- **Screen / sound / vibration:** the Run screen's wake lock, Web Audio cues and vibration
  work in the Android WebView as they do in Chrome.
- **Edge-to-edge:** the app draws under the status and navigation bars and pads with
  `env(safe-area-inset-*)` like the installed PWA does.
- **Android's own backup:** `allowBackup` is on, so Android's device backup may restore the
  app's data on a new phone. Treat that as a bonus, not a substitute for exporting.
