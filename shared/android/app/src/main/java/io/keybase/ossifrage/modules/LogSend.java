package io.keybase.ossifrage.modules;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import keybase.Keybase;

import static io.keybase.ossifrage.MainActivity.isTestDevice;

public class LogSend extends ReactContextBaseJavaModule {
    private static final String NAME = "KBLogSend";
    private boolean misTestDevice;

    public LogSend(final ReactApplicationContext reactContext) {
        super(reactContext);
        this.misTestDevice = isTestDevice(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
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
