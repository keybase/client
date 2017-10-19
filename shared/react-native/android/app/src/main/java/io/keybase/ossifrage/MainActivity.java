package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;
import android.view.WindowManager;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactRootView;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;

import keybase.Keybase;

import static keybase.Keybase.initOnce;
import static keybase.Keybase.logSend;

import io.keybase.ossifrage.util.DNSNSFetcher;

public class MainActivity extends ReactActivity {
    private static final String TAG = MainActivity.class.getName();

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

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "Keybase";
    }
}
