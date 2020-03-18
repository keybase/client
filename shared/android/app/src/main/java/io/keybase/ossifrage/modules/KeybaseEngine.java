package io.keybase.ossifrage.modules;

import android.app.KeyguardManager;
import android.content.Context;
import android.util.Log;
import android.text.format.DateFormat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import android.os.Bundle;

import io.keybase.ossifrage.BuildConfig;
import io.keybase.ossifrage.DarkModePrefHelper;
import io.keybase.ossifrage.DarkModePreference;
import io.keybase.ossifrage.MainActivity;
import io.keybase.ossifrage.util.GuiConfig;
import io.keybase.ossifrage.util.ReadFileAsString;
import keybase.Keybase;

import static io.keybase.ossifrage.MainActivity.isTestDevice;
import static keybase.Keybase.readB64;
import static keybase.Keybase.version;
import static keybase.Keybase.writeB64;

@ReactModule(name = "KeybaseEngine")
public class KeybaseEngine extends ReactContextBaseJavaModule implements KillableModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_EVENT_NAME = "RPC";
    private static final String RPC_META_EVENT_NAME = "META_RPC";
    private static final String RPC_META_EVENT_ENGINE_RESET = "ENGINE_RESET";
    private ExecutorService executor;
    private Boolean started = false;
    private ReactApplicationContext reactContext;
    private Bundle initialBundleFromNotification;
    private HashMap<String, String> initialIntent;
    private String shareFileUrl;
    private String shareText;
    private boolean misTestDevice;

    private static void relayReset(ReactApplicationContext reactContext) {
        if (!reactContext.hasActiveCatalystInstance()) {
            NativeLogger.info(NAME + ": JS Bridge is dead, Can't send EOF message");
        } else {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(KeybaseEngine.RPC_META_EVENT_NAME, KeybaseEngine.RPC_META_EVENT_ENGINE_RESET);
        }
    }

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
                      NativeLogger.info(NAME + ": JS Bridge is dead, dropping engine message: " + data);
                  }

                  reactContext
                          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                          .emit(KeybaseEngine.RPC_EVENT_NAME, data);
              } catch (Exception e) {
                if (e.getMessage().equals("Read error: EOF")) {
                    NativeLogger.info("Got EOF from read. Likely because of reset.");
                } else {
                    NativeLogger.error("Exception in ReadFromKBLib.run", e);
                }
              }
          } while (!Thread.currentThread().isInterrupted() && reactContext.hasActiveCatalystInstance());
        }
    }

    public KeybaseEngine(final ReactApplicationContext reactContext) {
        super(reactContext);
        NativeLogger.info("KeybaseEngine constructed");
        this.reactContext = reactContext;
        this.misTestDevice = isTestDevice(reactContext);

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

    public void destroy() {
        try {
            if (executor != null) {
                executor.shutdownNow();
            }

            Keybase.reset();
            relayReset(reactContext);
            // We often hit this timeout during app resume, e.g. hit the back
            // button to go to home screen and then tap Keybase app icon again.
            if (executor != null && !executor.awaitTermination(3, TimeUnit.SECONDS)) {
                NativeLogger.warn(NAME + ": Executor pool didn't shut down cleanly");
            }
            executor = null;
        } catch (Exception e) {
            NativeLogger.error("Exception in KeybaseEngine.destroy", e);
        }
    }

    public String getName() {
        return NAME;
    }


    private String readGuiConfig() {
        return GuiConfig.getInstance(this.reactContext.getFilesDir()).asString();
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
          NativeLogger.warn(NAME + ": Error reading keyguard secure state", e);
        }

        String serverConfig = "";
        try {
            serverConfig = ReadFileAsString.read(this.reactContext.getCacheDir().getAbsolutePath() + "/Keybase/keybase.app.serverConfig");
        } catch (Exception e) {
            NativeLogger.warn(NAME + ": Error reading server config", e);
        }

        final Map<String, Object> constants = new HashMap<>();
        constants.put("eventName", RPC_EVENT_NAME);
        constants.put("metaEventName", RPC_META_EVENT_NAME);
        constants.put("metaEventEngineReset", RPC_META_EVENT_ENGINE_RESET);
        constants.put("appVersionName", versionName);
        constants.put("appVersionCode", versionCode);
        constants.put("guiConfig", readGuiConfig());
        constants.put("version", version());
        constants.put("isDeviceSecure", isDeviceSecure);
        constants.put("isTestDevice", misTestDevice);
        constants.put("serverConfig", serverConfig);
        constants.put("uses24HourClock", DateFormat.is24HourFormat(this.reactContext));
        return constants;
    }

    @ReactMethod
    public void runWithData(String data) {
      try {
          writeB64(data);
      } catch (Exception e) {
          NativeLogger.error("Exception in KeybaseEngine.runWithData", e);
      }
    }

    @ReactMethod
    public void reset() {
      try {
          Keybase.reset();
          relayReset(reactContext);
      } catch (Exception e) {
          NativeLogger.error("Exception in KeybaseEngine.reset", e);
      }
    }

    @ReactMethod
    public void start() {
        NativeLogger.info("KeybaseEngine started");
        try {
            started = true;
            if (executor == null) {
                executor = Executors.newSingleThreadExecutor();
                executor.execute(new ReadFromKBLib(this.reactContext));
            }
        } catch (Exception e) {
            NativeLogger.error("Exception in KeybaseEngine.start", e);
        }
    }

    // This isn't related to the Go Engine, but it's a small thing that wouldn't be worth putting in
    // its own react module. That's because starting up a react module is a bit expensive and we
    // wouldn't be able to lazy load this because we need it on startup.
    @ReactMethod
    public void getInitialBundleFromNotification(Promise promise) {
        if (this.initialBundleFromNotification != null) {
            WritableMap map = Arguments.fromBundle(this.initialBundleFromNotification);
            promise.resolve(map);
            this.initialBundleFromNotification = null;
        }
        else {
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void getInitialShareFileUrl(Promise promise) {
        promise.resolve(this.shareFileUrl);
        this.shareFileUrl = null;
    }

    @ReactMethod
    public void getInitialShareText(Promise promise) {
        promise.resolve(this.shareText);
        this.shareText = null;
    }

    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
    @ReactMethod
    public void appColorSchemeChanged(String prefString) {
        final DarkModePreference pref = DarkModePrefHelper.fromString(prefString);
        final MainActivity activity = (MainActivity) reactContext.getCurrentActivity();
        if (activity != null) {
          activity.setBackgroundColor(pref);
        }
    }

    public void setInitialBundleFromNotification(Bundle bundle) {
        this.initialBundleFromNotification = bundle;
    }

    public void setInitialShareFileUrl(String s) {
        this.shareFileUrl = s;
    }
    public void setInitialShareText(String text) {
        this.shareText = text;
    }

}
