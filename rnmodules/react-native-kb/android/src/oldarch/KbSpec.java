package com.reactnativekb;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;

abstract class KbSpec extends ReactContextBaseJavaModule {
  KbSpec(ReactApplicationContext context) {
    super(context);
  }

    public abstract void getDefaultCountryCode(Promise promise);
    public abstract void logSend(String status, String feedback, boolean sendLogs, boolean sendMaxBytes, String traceDir, String cpuProfileDir, Promise promise);
    public abstract void androidOpenSettings();
    public abstract void androidSetSecureFlagSetting(boolean setSecure, Promise promise);
    public abstract void androidGetSecureFlagSetting(Promise promise);
    public abstract void androidShare(String uriPath, String mimeType, Promise promise);
    public abstract void androidShareText(String text, String mimeType, Promise promise);
    public abstract void androidCheckPushPermissions(Promise promise);
    public abstract void androidRequestPushPermissions(Promise promise);
    public abstract void androidGetRegistrationToken(Promise promise);
    public abstract void androidUnlink(String path, Promise promise);
    public abstract void androidAddCompleteDownload(ReadableMap config, Promise promise);
    public abstract void androidAppColorSchemeChanged(String prefString);
    public abstract void androidSetApplicationIconBadgeNumber(double badge);
    public abstract void androidGetInitialBundleFromNotification(Promise promise);
    public abstract void androidGetInitialShareFileUrl(Promise promise);
    public abstract void androidGetInitialShareText(Promise promise);
    public abstract void engineReset();
    public abstract void engineStart();
    public abstract void rpcOnGo(byte[] arr);
}
