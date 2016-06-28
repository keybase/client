package io.keybase.ossifrage.modules;

import android.util.Log;

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

public class KeybaseEngine extends ReactContextBaseJavaModule implements KillableModule {

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
          do {
              try {
                  final String data = ReadB64();

                  if (!reactContext.hasActiveCatalystInstance()) {
                      Log.e(NAME, "JS Bridge is dead, dropping engine message: " + data);
                  }

                  reactContext
                          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                          .emit(KeybaseEngine.RPC_EVENT_NAME, data);
              } catch (Exception e) {
                      e.printStackTrace();
              }
          } while (!Thread.currentThread().isInterrupted() && reactContext.hasActiveCatalystInstance());
        }
    }

    public KeybaseEngine(final ReactApplicationContext reactContext) {
        super(reactContext);

        executor = Executors.newSingleThreadExecutor();
        executor.execute(new ReadFromKBLib(reactContext));

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
            }

            @Override
            public void onHostPause() {
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
        } catch (Exception e) {
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
      try {
          WriteB64(data);
      } catch (Exception e) {
          e.printStackTrace();
      }
    }

    @ReactMethod
    public void reset() {
      try {
          Reset();
      } catch (Exception e) {
          e.printStackTrace();
      }
    }
}
