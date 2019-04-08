package io.keybase.ossifrage.modules;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.MimeTypeMap;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.UUID;

import io.keybase.ossifrage.KBPushNotifier;
import keybase.Keybase;
import keybase.PushNotifier;

public class IntentHandler extends ReactContextBaseJavaModule {

    private static final String TAG = IntentHandler.class.getName();
    private final ReactApplicationContext reactContext;
    private Bundle shareData = new Bundle();

    protected void handleNotificationIntent(Intent intent) {
        if (!intent.getBooleanExtra("isNotification", false)) return;
        intent.removeExtra("isNotification");
        NativeLogger.info("launching from notification");

        DeviceEventManagerModule.RCTDeviceEventEmitter emitter = reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
        if (emitter == null) {
            NativeLogger.warn("notification emitter not ready");
            return;
        }
        WritableMap evt = Arguments.createMap();
        evt.putString("convID", intent.getStringExtra("convID"));
        evt.putString("type", "chat.newmessage");
        evt.putBoolean("userInteraction", true);
        emitter.emit("androidIntentNotification", evt);
    }

    private void handleSendIntentStream(Intent intent) {
        Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;

        String filePath = null;
        if (uri.getScheme().equals("content")) {
            ContentResolver resolver = reactContext.getContentResolver();
            String mimeType = resolver.getType(uri);
            String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
            String filename = String.format("%s.%s", UUID.randomUUID().toString(), extension);
            File file = new File(reactContext.getCacheDir(), filename);
            try {
                InputStream istream = resolver.openInputStream(uri);
                OutputStream ostream = new FileOutputStream(file);

                byte[] buf = new byte[64 * 1024];
                int len;
                while ((len = istream.read(buf)) != -1) {
                    ostream.write(buf, 0, len);
                }
                filePath = file.getPath();
            } catch (IOException ex) {
                Log.w(TAG, "error writing shared file " + uri.toString());
            }
        } else {
            filePath = uri.getPath();
        }

        if (filePath == null) return;

        if (reactContext == null) return;

        shareData = new Bundle();
        shareData.putString("localPath", filePath);
        WritableMap evt = Arguments.fromBundle(shareData);

        DeviceEventManagerModule.RCTDeviceEventEmitter emitter = reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
        if (emitter != null) {
            emitter.emit("onShareData", evt);
        }
    }

    private void handleSendIntentMultipleStreams(Intent intent) {
        ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        if (uris == null) return;

        // TODO: do something with the intent streams.
    }

    private void handleSendIntentText(Intent intent) {
        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (sharedText == null) return;

        if (reactContext == null) return;

        shareData = new Bundle();
        shareData.putString("text", sharedText);
        WritableMap evt = Arguments.fromBundle(shareData);
        DeviceEventManagerModule.RCTDeviceEventEmitter emitter = reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
        if (emitter != null) {
            emitter.emit("onShareText", evt);
        }
    }

    public void handleIntent(final Intent intent) {
        if (intent == null) return;

        if (reactContext == null) {
            NativeLogger.warn("react context not ready");
            return;
        }

        handleNotificationIntent(intent);
        handleSendIntentText(intent);
        handleSendIntentStream(intent);
        handleSendIntentMultipleStreams(intent);
    }

    public IntentHandler(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                handleIntent(getCurrentActivity().getIntent());
            }

            @Override
            public void onHostPause() {}

            @Override
            public void onHostDestroy() {}
        });
    }

    @Override
    public void initialize() {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            NativeLogger.warn("activity not yet initialized");
            return;
        }
        handleIntent(activity.getIntent());
    }

    @Override
    public String getName() {
        return "IntentHandler";
    }

    @ReactMethod
    public void getShareLocalPath(Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            String err = "activity not yet initialized";
            NativeLogger.warn(err);
            promise.reject(new Exception(err));
            return;
        }
        promise.resolve(Arguments.fromBundle(shareData));
    }
}
