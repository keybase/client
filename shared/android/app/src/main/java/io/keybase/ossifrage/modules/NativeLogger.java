package io.keybase.ossifrage.modules;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;

public class NativeLogger extends ReactContextBaseJavaModule {
    private static final String NAME = "NativeLogger";
    private static final String RN_NAME = "ReactNativeJS";

    private static void rawLog(String tag, String jsonLog) {
        Log.i(tag + NAME, jsonLog);
    }

    private static String formatLine(String tagPrefix, String toLog) {
        // Copies the Style JS outputs in native/logger.native.tsx
        return tagPrefix + NAME + ": [" + System.currentTimeMillis() + ",\"" + toLog + "\"]";
    }

    public static void error(String log) {
        Log.e(RN_NAME, formatLine("e", log));
    }

    public static void error(String log, Throwable tr) {
        Log.e(RN_NAME, formatLine("e", log + Log.getStackTraceString(tr)));
    }

    public static void info(String log) {
        Log.i(RN_NAME, formatLine("i", log));
    }

    public static void info(String log, Throwable tr) {
        Log.i(RN_NAME, formatLine("i", log + Log.getStackTraceString(tr)));
    }

    public static void warn(String log) {
        Log.i(RN_NAME, formatLine("w", log));
    }

    public static void warn(String log, Throwable tr) {
        Log.i(RN_NAME, formatLine("w", log + Log.getStackTraceString(tr)));
    }

    public NativeLogger(final ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }
}
