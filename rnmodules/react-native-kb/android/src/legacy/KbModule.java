package com.reactnativekb;

import com.facebook.react.bridge.ReadableMap;
import java.util.Map;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class KbModule extends ReactContextBaseJavaModule {
    public static final String NAME = KbModuleImpl.NAME;
    private KbModuleImpl impl;

    KbModule(ReactApplicationContext context) {
        super(context);
        this.impl = new KbModuleImpl(context);
    }

    @Override
    @NonNull
    public String getName() {
        return KbModuleImpl.NAME;
    }

    @ReactMethod
    public void addListener(String eventName) {
        // needed
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // needed
    }

    @Override
    public Map<String, Object> getConstants() {
        return this.impl.getConstants();
    }

    @ReactMethod
    public void getDefaultCountryCode(Promise promise) {
        this.impl.getDefaultCountryCode(promise);
    }


    @ReactMethod
    public void logSend(String status, String feedback, boolean sendLogs, boolean sendMaxBytes, String traceDir, String cpuProfileDir, Promise promise) {
        this.impl.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir, promise);
    }
    @ReactMethod
    public void androidOpenSettings() {
        this.impl.androidOpenSettings();
    }
    @ReactMethod
    public void androidSetSecureFlagSetting(boolean setSecure, Promise promise) {
        this.impl.androidSetSecureFlagSetting(setSecure, promise);
    }
    @ReactMethod
    public void androidGetSecureFlagSetting(Promise promise) {
        this.impl.androidGetSecureFlagSetting(promise);
    }
    @ReactMethod
    public void androidShare(String uriPath, String mimeType, Promise promise) {
        this.impl.androidShare(uriPath, mimeType, promise);
    }
    @ReactMethod
    public void androidShareText(String text, String mimeType, Promise promise) {
        this.impl.androidShareText(text, mimeType, promise);
    }
    @ReactMethod
    public void androidCheckPushPermissions(Promise promise) {
        this.impl.androidCheckPushPermissions(promise);
    }
    @ReactMethod
    public void androidRequestPushPermissions(Promise promise) {
        this.impl.androidRequestPushPermissions(promise);
    }
    @ReactMethod
    public void androidGetRegistrationToken(Promise promise) {
        this.impl.androidGetRegistrationToken(promise);
    }
    @ReactMethod
    public void androidUnlink(String path, Promise promise) {
        this.impl.androidUnlink(path, promise);
    }
    @ReactMethod
    public void androidAddCompleteDownload(ReadableMap config, Promise promise) {
        this.impl.androidAddCompleteDownload(config, promise);
    }
    @ReactMethod
    public void androidAppColorSchemeChanged(String prefString) {
        this.impl.androidAppColorSchemeChanged(prefString);
    }
    @ReactMethod
    public void androidSetApplicationIconBadgeNumber(int badge) {
        this.impl.androidSetApplicationIconBadgeNumber(badge);
    }
    @ReactMethod
    public void androidGetInitialBundleFromNotification(Promise promise) {
        this.impl.androidGetInitialBundleFromNotification(promise);
    }
    @ReactMethod
    public void androidGetInitialShareFileUrl(Promise promise) {
        this.impl.androidGetInitialShareFileUrl(promise);
    }
    @ReactMethod
    public void androidGetInitialShareText(Promise promise) {
        this.impl.androidGetInitialShareText(promise);
    }
    @ReactMethod
    public void engineReset() {
        this.impl.engineReset();
    }
    @ReactMethod
    public void engineStart() {
        this.impl.engineStart();
    }
}

