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

import go.keybase.Keybase;
import io.keybase.ossifrage.BuildConfig;
import javassist.convert.TransformWriteField;

import static go.keybase.Keybase.readB64;
import static go.keybase.Keybase.writeB64;
import static go.keybase.Keybase.version;

public class KeybaseEngine extends ReactContextBaseJavaModule implements KillableModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_EVENT_NAME = "RPC";
    private ExecutorService readExecutor;
    private ExecutorService writeExecutor;
    private Boolean started = false;
    private ReactApplicationContext reactContext;

    private class WriteToKBLib implements Runnable {
        private final String data;

        public WriteToKBLib(String data) {
            this.data = data;
        }

        @Override
        public void run() {
            try {
                writeB64(this.data);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private class ReadFromKBLib implements Runnable {
        private final ReactApplicationContext reactContext;

        public ReadFromKBLib(ReactApplicationContext reactContext) {
            this.reactContext = reactContext;
        }

        @Override
        public void run() {
            Thread.currentThread().setName("ReadFromKBLib.ReadThread");
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
          } while (!Thread.interrupted() && reactContext.hasActiveCatalystInstance());
        }
    }

    public KeybaseEngine(final ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;


        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                if (started && readExecutor == null) {
                    readExecutor = Executors.newSingleThreadExecutor();
                    readExecutor.execute(new ReadFromKBLib(reactContext));
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
            readExecutor.shutdownNow();
            reset();
            readExecutor.awaitTermination(30, TimeUnit.SECONDS);
            readExecutor = null;
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

        final Map<String, Object> constants = new HashMap<>();
        constants.put("eventName", RPC_EVENT_NAME);
        constants.put("appVersionName", versionName);
        constants.put("appVersionCode", versionCode);
        constants.put("version", version());
        return constants;
    }

    @ReactMethod
    public void runWithData(String data) {
        writeExecutor.execute(new WriteToKBLib(data));
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
            if (writeExecutor == null) {
                writeExecutor = Executors.newSingleThreadExecutor();
            }

            if (readExecutor == null) {
                readExecutor = Executors.newSingleThreadExecutor();
                readExecutor.execute(new ReadFromKBLib(this.reactContext));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
