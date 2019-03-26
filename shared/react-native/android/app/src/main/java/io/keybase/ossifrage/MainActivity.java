package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.icu.util.Output;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;
import android.webkit.MimeTypeMap;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.ReactFragmentActivity;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.LifecycleState;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.modules.core.PermissionListener;

import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.StandardCopyOption;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.ArrayList;
import java.util.UUID;

import io.keybase.ossifrage.modules.KeybaseEngine;
import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.util.ContactsPermissionsWrapper;
import io.keybase.ossifrage.util.DNSNSFetcher;
import io.keybase.ossifrage.util.VideoHelper;
import keybase.Keybase;

import static keybase.Keybase.initOnce;

public class MainActivity extends ReactFragmentActivity {
    private static final String TAG = MainActivity.class.getName();
    private PermissionListener listener;

    private void createDummyFile() {
        final File dummyFile = new File(this.getFilesDir(), "dummy.txt");
        try {
            if (dummyFile.createNewFile()) {
                dummyFile.setWritable(true);
                final FileOutputStream stream = new FileOutputStream(dummyFile);
                try {
                    stream.write("hi".getBytes());
                } finally {
                    stream.close();
                }
            } else {
                Log.d(TAG, "dummy.txt exists");
            }
        } catch (Exception e) {
            NativeLogger.error("Exception in createDummyFile", e);
        }
    }

    private ReactContext getReactContext() {
        ReactInstanceManager instanceManager = getReactInstanceManager();
        if (instanceManager == null) {
            NativeLogger.warn("react instance manager not ready");
            return null;
        }

        return instanceManager.getCurrentReactContext();
    }

    private void handleNotificationIntentWithContext(Intent intent, ReactContext reactContext) {
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

    private void handleNotificationIntent(final Intent intent) {
        if (!intent.getBooleanExtra("isNotification", false)) return;
        intent.removeExtra("isNotification");
        NativeLogger.info("launching from notification");

        final ReactContext reactContext = getReactContext();
        if (reactContext == null) {
            NativeLogger.warn("react context not ready");
            (new Thread(new Runnable() {
                @Override
                public void run() {

                    // Try for 10 seconds
                    int millisecondsToSleep = 18000;
                    int millisecondsPerSleep = 6000;
                    int numSleeps = millisecondsToSleep / millisecondsPerSleep;
                    for (int i=0; i < numSleeps; i++) {
                        try {
                            Thread.sleep(millisecondsPerSleep);
                        } catch (InterruptedException ex) {
                            Thread.currentThread().interrupt();
                        }
                        final ReactContext reactContext = getReactContext();
                        if (reactContext == null) {
                            continue;
                        }
                        // FIXME: Currently this is very sloppy. Even after reactContext is no
                        // longer null, it's possible to error when trying to route from the
                        // resulting action.
                        handleNotificationIntentWithContext(intent, reactContext);
                        return;
                    }
                }
            })).run();
            return;
        }

        this.handleNotificationIntentWithContext(intent, reactContext);
    }

    private void handleSendIntentStream(Intent intent) {
        Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;

        String filePath = null;
        if (uri.getScheme().equals("content")) {
            ContentResolver resolver = getContentResolver();
            String mimeType = resolver.getType(uri);
            String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
            String filename = String.format("%s.%s", UUID.randomUUID().toString(), extension);
            File file = new File(getCacheDir(), filename);
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

        ReactContext reactContext = getReactContext();
        if (reactContext == null) return;

        WritableMap evt = Arguments.createMap();
        evt.putString("path", filePath);

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

        ReactContext reactContext = getReactContext();
        if (reactContext == null) return;

        WritableMap evt = Arguments.createMap();
        evt.putString("text", sharedText);
        DeviceEventManagerModule.RCTDeviceEventEmitter emitter = reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
        if (emitter != null) {
            emitter.emit("onShareText", evt);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        this.handleNotificationIntent(intent);
        this.handleSendIntentText(intent);
        this.handleSendIntentStream(intent);
        this.handleSendIntentMultipleStreams(intent);
    }

    @Override
    @TargetApi(Build.VERSION_CODES.KITKAT)
    protected void onCreate(Bundle savedInstanceState) {
        try {
            Keybase.setGlobalExternalKeyStore(new KeyStore(this, getSharedPreferences("KeyStore", MODE_PRIVATE)));
        } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
            NativeLogger.error("Exception in MainActivity.onCreate", e);
        }

        createDummyFile();
        initOnce(this.getFilesDir().getPath(), "", this.getFileStreamPath("service.log").getAbsolutePath(), "prod", false,
                new DNSNSFetcher(), new VideoHelper());

        super.onCreate(savedInstanceState);


        // Hide splash screen background after 300ms.
        // This prevents the image from being visible behind the app, such as during a
        // keyboard show animation.
        final Window mainWindow = this.getWindow();
        new android.os.Handler().postDelayed(new Runnable() {
            public void run() {
                mainWindow.setBackgroundDrawableResource(R.color.white);
            }
        }, 300);
    }

    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new ReactActivityDelegate(this, getMainComponentName()) {
            @Override
            protected ReactRootView createRootView() {
                return new RNGestureHandlerEnabledRootView(MainActivity.this);
            }
        };
    }

    @Override
    public boolean onCreateThumbnail(final Bitmap outBitmap, final Canvas canvas) {
        return super.onCreateThumbnail(outBitmap, canvas);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            return super.onKeyUp(KeyEvent.KEYCODE_MENU, null);
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (listener != null) {
            listener.onRequestPermissionsResult(requestCode, permissions, grantResults);
        }
        if (permissions.length > 0 && permissions[0].equals("android.permission.READ_CONTACTS")) {
            // Call callback wrapper with results
            ContactsPermissionsWrapper.callbackWrapper(requestCode, permissions, grantResults);
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (Keybase.appDidEnterBackground()) {
            Keybase.appBeginBackgroundTaskNonblock(new KBPushNotifier(this));
        } else {
            Keybase.setAppStateBackground();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        Keybase.setAppStateForeground();
        handleIntent(getIntent());
    }

    @Override
    protected void onStart() {
        super.onStart();
        Keybase.setAppStateForeground();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Keybase.appWillExit(new KBPushNotifier(this));
    }

    @Override
    public void onNewIntent(Intent intent) {
        NativeLogger.info("new Intent: " + intent.getAction());
        super.onNewIntent(intent);
        setIntent(intent);
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is
     * used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "Keybase";
    }
}
