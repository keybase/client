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

import static io.keybase.ossifrage.MainActivity.isTestDevice;
import static keybase.Keybase.version;

@ReactModule(name = "KeybaseEngine")
public class KeybaseEngine extends ReactContextBaseJavaModule implements KillableModule {

    private static final String NAME = "KeybaseEngine";
    private static final String RPC_META_EVENT_NAME = "kb-meta-engine-event";
    private static final String RPC_META_EVENT_ENGINE_RESET = "kb-engine-reset";

    private Boolean started = false;
    private ReactApplicationContext reactContext;

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
}
