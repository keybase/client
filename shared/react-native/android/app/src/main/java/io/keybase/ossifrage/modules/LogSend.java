package io.keybase.ossifrage.modules;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import go.keybase.Keybase;
import io.keybase.ossifrage.BuildConfig;

public class LogSend extends ReactContextBaseJavaModule {
    private static final String NAME = "KBLogSend";

    public LogSend(final ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void logSend(String status, String feedback, boolean sendLogs, String logFilePath, Promise promise) {
        try {
            final String logID = Keybase.logSend(status, feedback, sendLogs, logFilePath);
            promise.resolve(logID);
        } catch (Exception e) {
            promise.reject(e);
        }
    }
}
