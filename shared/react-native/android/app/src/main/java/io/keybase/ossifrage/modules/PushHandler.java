package io.keybase.ossifrage.modules;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import io.keybase.ossifrage.KBPushNotifier;
import keybase.Keybase;
import keybase.PushNotifier;

public class PushHandler extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public PushHandler(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PushHandler";
    }

    @ReactMethod
    public void handlePushNotification(String convID, String payload, Integer membersType,
                                       Boolean displayPlaintext, Integer messageID, String pushID,
                                       Integer badgeCount, Integer unixTime, String soundName, Promise promise) {
        try {
            PushNotifier notifier = new KBPushNotifier(reactContext);
            Keybase.handleBackgroundNotification(convID, payload, membersType, displayPlaintext, messageID, pushID, badgeCount, unixTime, soundName, notifier);
            promise.resolve(null);
        } catch (Exception ex) {
            promise.reject(ex);
        }
    }
}
