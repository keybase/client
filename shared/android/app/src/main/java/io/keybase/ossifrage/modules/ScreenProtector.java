package io.keybase.ossifrage.modules;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import static io.keybase.ossifrage.MainActivity.isTestDevice;

public class ScreenProtector extends ReactContextBaseJavaModule {
    private ReactApplicationContext reactContext;
    private boolean misTestDevice;

    public ScreenProtector(final ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.misTestDevice = isTestDevice(reactContext);
        this.setSecureFlag();

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                setSecureFlag();
            }

            @Override
            public void onHostPause() {
            }

            @Override
            public void onHostDestroy() {
            }
        });
    }

    @ReactMethod
    public void setSecureFlagSetting(boolean setSecure, Promise promise) {
        final SharedPreferences prefs = reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE);
        final boolean success = prefs.edit().putBoolean("setSecure", setSecure).commit();
        promise.resolve(success);
        setSecureFlag();
    }

    @ReactMethod
    public void getSecureFlagSetting(Promise promise) {
        final SharedPreferences prefs = this.reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE);
        final boolean setSecure = prefs.getBoolean("setSecure", !misTestDevice);
        promise.resolve(setSecure);
    }

    private void setSecureFlag() {
        final SharedPreferences prefs = this.reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE);
        final boolean setSecure = prefs.getBoolean("setSecure", !misTestDevice);
        final Activity activity = this.reactContext.getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    final Window window = activity.getWindow();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH && setSecure) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    }
                }
            });
        }
    }

    @Override
    public String getName() {
        return "ScreenProtector";
    }
}
