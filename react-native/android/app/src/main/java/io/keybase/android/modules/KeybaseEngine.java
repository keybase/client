package io.keybase.android.modules;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import static go.keybase.Keybase.ReadB64;
import static go.keybase.Keybase.WriteB64;

public class KeybaseEngine extends ReactContextBaseJavaModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_EVENT_NAME = "RPC";

    private class ReadFromKBLib implements Runnable {
        private final ReactApplicationContext reactContext;

        public ReadFromKBLib(ReactApplicationContext reactContext) {
            this.reactContext = reactContext;
        }

        @Override
        public void run() {
            // TODO: There may be a race condition here...
            // It will fail if you try to run .getJSModule
            String data = ReadB64();

            reactContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit(KeybaseEngine.RPC_EVENT_NAME, data);

            // loop forever
            this.run();
        }
    }

    public KeybaseEngine(final ReactApplicationContext reactContext) {
        super(reactContext);

        Executor executor = Executors.newSingleThreadExecutor();
        executor.execute(new ReadFromKBLib(reactContext));
    }

    public String getName() {
        return NAME;
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("eventName", RPC_EVENT_NAME);
        return constants;
    }

    @ReactMethod
    public void runWithData(String data) {
        WriteB64(data);
    }
}
