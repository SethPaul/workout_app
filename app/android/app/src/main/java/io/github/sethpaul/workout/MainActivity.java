package io.github.sethpaul.workout;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local (non-npm) plugins must be registered before the bridge starts.
        registerPlugin(BackupTransferPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
