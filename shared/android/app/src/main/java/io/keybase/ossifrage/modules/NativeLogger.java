package io.keybase.ossifrage.modules;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


public class NativeLogger extends ReactContextBaseJavaModule {
    private static final String NAME = "KBNativeLogger";
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

    @ReactMethod
    public void log(ReadableArray tagsAndLogs) {
        int len = tagsAndLogs.size();
        for (int i = 0; i < len; i++) {
            ReadableArray tagAndLog = tagsAndLogs.getArray(i);
            rawLog(tagAndLog.getString(0), tagAndLog.getString(1));
        }
    }

    @ReactMethod
    public void dump(String tagPrefix, Promise promise) {
        try {
            String cmd = "logcat -m 10000 -d " + RN_NAME + ":I *:S";

            Process process = Runtime.getRuntime().exec(cmd);
            BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            final WritableArray totalArray = Arguments.createArray();
            final Pattern pattern = Pattern.compile(".*" + tagPrefix + NAME + ": (.*)");
            while ((line = r.readLine()) != null) {
                Matcher m = pattern.matcher(line);
                if (m.matches()) {
                    totalArray.pushString(m.group(1));
                }
            }
            promise.resolve(totalArray);
        } catch (IOException e) {
            promise.reject(e);
            error("Exception in dump: ", e);
        }
    }
}
