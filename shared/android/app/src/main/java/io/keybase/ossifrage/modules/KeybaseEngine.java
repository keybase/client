package io.keybase.ossifrage.modules;

import android.app.KeyguardManager;
import android.content.Context;
import android.text.format.DateFormat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.Map;
import java.io.File;
import android.os.Bundle;
import android.os.Environment;

import io.keybase.ossifrage.BuildConfig;
import io.keybase.ossifrage.DarkModePrefHelper;
import io.keybase.ossifrage.DarkModePreference;
import io.keybase.ossifrage.MainActivity;
import io.keybase.ossifrage.util.GuiConfig;
import io.keybase.ossifrage.util.ReadFileAsString;
import keybase.Keybase;
import me.leolin.shortcutbadger.ShortcutBadger;

import static io.keybase.ossifrage.MainActivity.isTestDevice;
import static keybase.Keybase.version;

@ReactModule(name = "KeybaseEngine")
public class KeybaseEngine extends ReactContextBaseJavaModule implements KillableModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_META_EVENT_NAME = "kb-meta-engine-event";
    private static final String RPC_META_EVENT_ENGINE_RESET = "kb-engine-reset";

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

    @ReactMethod
    public void addListener(String eventName) {
      // Set up any upstream listeners or background tasks as necessary
    }

    @ReactMethod
    public void removeListeners(Integer count) {
      // Remove upstream listeners, stop unnecessary background tasks
    }

    public KeybaseEngine(final ReactApplicationContext reactContext) {
        super(reactContext);
        NativeLogger.info("KeybaseEngine constructed");
        this.reactContext = reactContext;
        this.misTestDevice = isTestDevice(reactContext);
    }

    public void destroy() {
        try {
            Keybase.reset();
            relayReset(reactContext);
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


        String cacheDir = "";
        {
            File dir = this.reactContext.getCacheDir();
            if (dir != null) {
                cacheDir = dir.getAbsolutePath();
            } 
        }

        String downloadDir = "";
        {
            File dir = this.reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null) {
                downloadDir = dir.getAbsolutePath();
            }
        }

        final Map<String, Object> constants = new HashMap<>();
        constants.put("androidIsDeviceSecure", isDeviceSecure);
        constants.put("androidIsTestDevice", misTestDevice);
        constants.put("appVersionCode", versionCode);
        constants.put("appVersionName", versionName);
        constants.put("darkModeSupported", "0");
        constants.put("fsCacheDir", cacheDir);
        constants.put("fsDownloadDir", downloadDir);
        constants.put("guiConfig", readGuiConfig());
        constants.put("serverConfig", serverConfig);
        constants.put("uses24HourClock", DateFormat.is24HourFormat(this.reactContext));
        constants.put("version", version());
        return constants;
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

        } catch (Exception e) {
            NativeLogger.error("Exception in KeybaseEngine.start", e);
        }
    }

    // This isn't related to the Go Engine, but it's a small thing that wouldn't be worth putting in
    // its own react module. That's because starting up a react module is a bit expensive and we
    // wouldn't be able to lazy load this because we need it on startup.
    @ReactMethod
    public void androidGetInitialBundleFromNotification(Promise promise) {
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
    public void androidGetInitialShareFileUrl(Promise promise) {
        promise.resolve(this.shareFileUrl);
        this.shareFileUrl = null;
    }

    @ReactMethod
    public void androidGetInitialShareText(Promise promise) {
        promise.resolve(this.shareText);
        this.shareText = null;
    }

    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
    @ReactMethod
    public void androidAppColorSchemeChanged(String prefString) {
        final DarkModePreference pref = DarkModePrefHelper.fromString(prefString);
        final MainActivity activity = (MainActivity) reactContext.getCurrentActivity();
        if (activity != null) {
          activity.setBackgroundColor(pref);
        }
    }

    @ReactMethod
    public void androidSetApplicationIconBadgeNumber(int badge) {
        ShortcutBadger.applyCount(this.reactContext, badge);
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
