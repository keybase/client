package com.reactnativekb;

import androidx.annotation.NonNull;
import android.provider.Settings;
import android.content.Context;
import android.telephony.TelephonyManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

import keybase.Keybase;

@ReactModule(name = KbModule.NAME)
public class KbModule extends ReactContextBaseJavaModule {
    public static final String NAME = "Kb";
    private boolean misTestDevice;

    // Is this a robot controlled test device? (i.e. pre-launch report?)
    private static boolean isTestDevice(ReactApplicationContext context) {
      String testLabSetting = Settings.System.getString(context.getContentResolver(), "firebase.test.lab");
      return "true".equals(testLabSetting);
    }

    public KbModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.misTestDevice = isTestDevice(reactContext);
    }


    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void getDefaultCountryCode(Promise promise) {
        try {
            TelephonyManager tm = (TelephonyManager) this.getReactApplicationContext().getSystemService(Context.TELEPHONY_SERVICE);
            String countryCode = tm.getNetworkCountryIso();
            promise.resolve(countryCode);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    @ReactMethod
    public void logSend(String status, String feedback, boolean sendLogs, boolean sendMaxBytes, String traceDir, String cpuProfileDir, Promise promise) {
        if (misTestDevice) {
            return;
        }
        try {
          final String logID = Keybase.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir);
            promise.resolve(logID);
        } catch (Exception e) {
            promise.reject(e);
        }
    }
}
