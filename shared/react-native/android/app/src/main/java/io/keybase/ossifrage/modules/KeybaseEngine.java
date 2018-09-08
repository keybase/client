package io.keybase.ossifrage.modules;

import android.app.KeyguardManager;
import android.content.Context;
import android.util.Log;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import keybase.Keybase;
import io.keybase.ossifrage.BuildConfig;

import static keybase.Keybase.readB64;
import static keybase.Keybase.writeB64;
import static keybase.Keybase.version;

public class KeybaseEngine extends ReactContextBaseJavaModule implements KillableModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_EVENT_NAME = "RPC";
    private Instant appStart;
    private ExecutorService executor;
    private Boolean started = false;
    private ReactApplicationContext reactContext;

    private class ReadFromKBLib implements Runnable {
        private final ReactApplicationContext reactContext;

        public ReadFromKBLib(ReactApplicationContext reactContext) {
            this.reactContext = reactContext;
        }

        @Override
        public void run() {
          do {
              try {
                  final String data = readB64();

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

  public KeybaseEngine(final ReactApplicationContext reactContext, Instant appStart) {
        super(reactContext);
        this.reactContext = reactContext;
        this.appStart = appStart;

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                if (started && executor == null) {
                    executor = Executors.newSingleThreadExecutor();
                    executor.execute(new ReadFromKBLib(reactContext));
                }
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
            // We often hit this timeout during app resume, e.g. hit the back
            // button to go to home screen and then tap Keybase app icon again.
            if (!executor.awaitTermination(3, TimeUnit.SECONDS)) {
                Log.w(NAME, "Executor pool didn't shut down cleanly");
            }
            executor = null;
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public String getName() {
        return NAME;
    }

    @Override
    public Map<String, Object> getConstants() {
        String versionCode = String.valueOf(BuildConfig.VERSION_CODE);
        String versionName = BuildConfig.VERSION_NAME;
        boolean isDeviceSecure = false;

        try {
            final KeyguardManager keyguardManager = (KeyguardManager) this.reactContext.getSystemService(Context.KEYGUARD_SERVICE);
            isDeviceSecure = keyguardManager.isKeyguardSecure();
        } catch (Exception e) {
            Log.w(NAME, "Error reading keyguard secure state", e);
        }

        final Map<String, Object> constants = new HashMap<>();
        constants.put("eventName", RPC_EVENT_NAME);
        constants.put("appStart", appStart.toEpochMilli());
        constants.put("appVersionName", versionName);
        constants.put("appVersionCode", versionCode);
        constants.put("version", version());
        constants.put("isDeviceSecure", isDeviceSecure);
        return constants;
    }

    @ReactMethod
    public void runWithData(String data) {
      try {
          writeB64(data);
      } catch (Exception e) {
          e.printStackTrace();
      }
    }

    @ReactMethod
    public void reset() {
      try {
          Keybase.reset();
      } catch (Exception e) {
          e.printStackTrace();
      }
    }

    @ReactMethod
    public void start() {
        try {
            started = true;
            if (executor == null) {
                executor = Executors.newSingleThreadExecutor();
                executor.execute(new ReadFromKBLib(this.reactContext));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
