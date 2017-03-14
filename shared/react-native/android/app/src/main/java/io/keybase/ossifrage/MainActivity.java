package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactRootView;

import java.io.File;
import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;

import go.keybase.Keybase;

import static go.keybase.Keybase.initOnce;
import static go.keybase.Keybase.logSend;

public class MainActivity extends ReactActivity {
    private static final String TAG = MainActivity.class.getName();
    private File logFile;

    @Override
    @TargetApi(Build.VERSION_CODES.KITKAT)
    protected void onCreate(Bundle savedInstanceState) {
        try {
            Keybase.setGlobalExternalKeyStore(new KeyStore(this, getSharedPreferences("KeyStore", MODE_PRIVATE)));
        } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
            e.printStackTrace();
        }

        logFile = this.getFileStreamPath("android.log");
        initOnce(this.getFilesDir().getPath(), logFile.getAbsolutePath(), "prod", false);

        super.onCreate(savedInstanceState);

        // Hide splash screen background after 3s.
        // This prevents the image from being visible behind the app, such as during a
        // keyboard show animation.
        final Window mainWindow = this.getWindow();
        new android.os.Handler().postDelayed(
            new Runnable() {
                public void run() {
                    mainWindow.setBackgroundDrawableResource(R.color.white);
                }
            },
        3000);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            try {
                final String id = logSend(logFile.getAbsolutePath());
                Log.d(TAG, "LOG id is: " + id);
            } catch (Exception e) {
                Log.d(TAG, "Error in log sending:", e);
            }
            return super.onKeyUp(KeyEvent.KEYCODE_MENU, null);
        }
        return super.onKeyUp(keyCode, event);
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
