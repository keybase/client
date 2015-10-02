package io.keybase.android.modules;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static go.keybase.Keybase.ReadB64;
import static go.keybase.Keybase.Reset;
import static go.keybase.Keybase.WriteB64;

public class KeybaseEngine extends ReactContextBaseJavaModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_EVENT_NAME = "RPC";
    private final ExecutorService executor;

    private class ReadFromKBLib implements Runnable {
        private final ReactApplicationContext reactContext;

        public ReadFromKBLib(ReactApplicationContext reactContext) {
            this.reactContext = reactContext;
        }

        @Override
        public void run() {
            // TODO: There may be a race condition here...
            // It will fail if you try to run .getJSModule
            // before react has loaded.

            while (!Thread.currentThread().isInterrupted()) {
                final String data = ReadB64();

                reactContext
                  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                  .emit(KeybaseEngine.RPC_EVENT_NAME, data);
            }
        }
    }

    public KeybaseEngine(final ReactApplicationContext reactContext) {
        super(reactContext);

        executor = Executors.newSingleThreadExecutor();
        executor.execute(new ReadFromKBLib(reactContext));

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                Reset();
            }

            @Override
            public void onHostPause() {
                Reset();
            }

            @Override
            public void onHostDestroy() {
                destroy();
            }
        });
    }

    public void destroy(){
        try {
            executor.shutdownNow();
            Reset();
            executor.awaitTermination(30, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
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

    @ReactMethod
    public void reset() {
        Reset();
    }
}
