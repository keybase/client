package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;

import com.burnweb.rnpermissions.RNPermissionsPackage;
import com.eguma.barcodescanner.BarcodeScannerPackage;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactPackage;
import com.facebook.react.ReactRootView;
import com.facebook.react.shell.MainReactPackage;

import java.io.File;
import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.Arrays;
import java.util.List;

import go.keybase.Keybase;

import static go.keybase.Keybase.InitOnce;
import static go.keybase.Keybase.LogSend;

public class MainActivity extends ReactActivity {
    private static final String TAG = MainActivity.class.getName();
    private ReactInstanceManager mReactInstanceManager;
    private ReactRootView mReactRootView;
    private File logFile;

    @Override
    @TargetApi(Build.VERSION_CODES.KITKAT)
    protected void onCreate(Bundle savedInstanceState) {
        logFile = this.getFileStreamPath("android.log");
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && !Settings.canDrawOverlays(this) && this.getUseDeveloperSupport()) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, -1);
        }

        InitOnce(this.getFilesDir().getPath(), logFile.getAbsolutePath(), "staging", false);

        try {
            Keybase.SetGlobalExternalKeyStore(new KeyStore(this, getSharedPreferences("KeyStore", MODE_PRIVATE)));
        } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
            e.printStackTrace();
        }

        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            try {
                final String id = LogSend(logFile.getAbsolutePath());
                Log.d(TAG, "LOG id is: " + id);
            } catch (Exception e) {
                Log.d(TAG, "Error in log sending:", e);
            }
            return super.onKeyUp(KeyEvent.KEYCODE_MENU, null);
        }
        return super.onKeyUp(keyCode, event);
    }
    // For dealing with permissions using RNPermissionsPackage
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        RNPermissionsPackage.onRequestPermissionsResult(requestCode, permissions, grantResults);
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
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
