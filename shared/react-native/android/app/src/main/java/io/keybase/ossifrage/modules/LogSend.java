package io.keybase.ossifrage.modules;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import go.keybase.Keybase;
import io.keybase.ossifrage.BuildConfig;

public class LogSend extends ReactContextBaseJavaModule {
    private static final String NAME = "KBLogSend";
    private final String logFilePath;

    public LogSend(final ReactApplicationContext reactContext, String logFilePath) {
        super(reactContext);
        this.logFilePath = logFilePath;
    }

    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void logSend(String status, String feedback, boolean sendLogs, Promise promise) {
        String versionCode = String.valueOf(BuildConfig.VERSION_CODE);
        String versionName = BuildConfig.VERSION_NAME;

        try {
            final String logID = Keybase.logSend(status, feedback, versionName, versionCode, sendLogs, logFilePath);
            promise.resolve(logID);
        } catch (Exception e) {
            promise.reject(e);
        }
    }
}
