package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.modules.core.PermissionListener;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;

import io.keybase.ossifrage.util.ContactsPermissionsWrapper;
import io.keybase.ossifrage.util.DNSNSFetcher;
import keybase.Keybase;

import static keybase.Keybase.initOnce;

public class MainActivity extends ReactActivity {
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
            e.printStackTrace();
        }
    }

    @Override
    @TargetApi(Build.VERSION_CODES.KITKAT)
    protected void onCreate(Bundle savedInstanceState) {
        try {
            Keybase.setGlobalExternalKeyStore(new KeyStore(this, getSharedPreferences("KeyStore", MODE_PRIVATE)));
        } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
            e.printStackTrace();
        }

        createDummyFile();
        initOnce(this.getFilesDir().getPath(), this.getFileStreamPath("service.log").getAbsolutePath(), "prod", false, new DNSNSFetcher());

        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        if (intent != null) {
            Bundle bundle = intent.getExtras();
            if (bundle != null && bundle.containsKey("notification")) {
                ReactInstanceManager instanceManager = getReactInstanceManager();
                if (instanceManager != null) {
                    ReactContext currentContext = instanceManager.getCurrentReactContext();
                    if (currentContext != null) {
                        DeviceEventManagerModule.RCTDeviceEventEmitter emitter = currentContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
                        if (emitter != null) {
                            emitter.emit("androidIntentNotification", "");
                        }
                    }
                }
            }
        }

        // Hide splash screen background after 300ms.
        // This prevents the image from being visible behind the app, such as during a
        // keyboard show animation.
        final Window mainWindow = this.getWindow();
        new android.os.Handler().postDelayed(
            new Runnable() {
                public void run() {
                    mainWindow.setBackgroundDrawableResource(R.color.white);
                }
            },
        300);
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
        Keybase.setAppStateBackground();
        super.onPause();
    }

    @Override
    protected void onResume() {
        Keybase.setAppStateForeground();
        super.onResume();
    }

    @Override
    protected void onDestroy() {
        Keybase.appWillExit();
        super.onDestroy();
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "Keybase";
    }
}
