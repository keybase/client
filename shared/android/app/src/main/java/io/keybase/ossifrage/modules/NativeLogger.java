package io.keybase.ossifrage.modules;

import android.util.Log;
import android.util.JsonWriter;

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
import java.io.StringWriter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


public class NativeLogger extends ReactContextBaseJavaModule {
    private static final String NAME = "KBNativeLogger";

    // Must match strings passed to NativeLogger in
    // shared/logger/index.js.
    private static final String ERROR_TAG = "e";
    private static final String INFO_TAG = "i";
    private static final String WARN_TAG = "w";

    private static void rawLog(String tag, String jsonLog) {
        Log.i(tag + NAME, jsonLog);
    }

    // This should do roughly the same thing as dumpLine from
    // native-logger.js.
    private static String dumpLine(String toLog) {
        long millis = System.currentTimeMillis();
        StringWriter sw = new StringWriter();
        JsonWriter js = new JsonWriter(sw);
        try {
            js.beginArray()
                .value(millis)
                .value(toLog)
                .endArray()
                .close();
            return sw.toString();
        } catch (IOException e) {
            rawLog(ERROR_TAG, "Exception in dumpLine: " + Log.getStackTraceString(e));
            return toLog;
        }
    }

    private static String dumpLine(String toLog, Throwable tr) {
      return dumpLine(toLog + ": " + Log.getStackTraceString(tr));
    }

    public static void error(String log) {
        rawLog(ERROR_TAG, dumpLine(log));
    }

    public static void error(String log, Throwable tr) {
        rawLog(ERROR_TAG, dumpLine(log, tr));
    }

    public static void info(String log) {
        rawLog(INFO_TAG, dumpLine(log));
    }

    public static void info(String log, Throwable tr) {
        rawLog(INFO_TAG, dumpLine(log, tr));
    }

    public static void warn(String log) {
        rawLog(WARN_TAG, dumpLine(log));
    }

    public static void warn(String log, Throwable tr) {
        rawLog(WARN_TAG, dumpLine(log, tr));
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
            String cmd = "logcat -m 10000 -d " + "ReactNativeJS" + ":I *:S";

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
            rawLog(ERROR_TAG, "Exception in dump: " + Log.getStackTraceString(e));
        }
    }
}
