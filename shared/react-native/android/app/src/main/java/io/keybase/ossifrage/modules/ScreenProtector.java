package io.keybase.ossifrage.modules;

import android.os.Build;
import android.view.Window;
import android.view.WindowManager;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

public class ScreenProtector extends ReactContextBaseJavaModule {
    public ScreenProtector(final ReactApplicationContext reactContext) {
        super(reactContext);

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                final Window window = reactContext.getCurrentActivity().getWindow();
                setSecureFlag(window, false);
            }

            @Override
            public void onHostPause() {
                final Window window = reactContext.getCurrentActivity().getWindow();
                setSecureFlag(window, true);
            }

            @Override
            public void onHostDestroy() {
                final Window window = reactContext.getCurrentActivity().getWindow();
                setSecureFlag(window, true);
            }
        });
    }

    private static void setSecureFlag(Window window, boolean setSecure) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH && setSecure) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    @Override
    public String getName() {
        return "ScreenProtector";
    }
}
