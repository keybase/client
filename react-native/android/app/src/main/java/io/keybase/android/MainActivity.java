package io.keybase.android;

import android.annotation.TargetApi;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;

import com.facebook.react.LifecycleState;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactRootView;
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler;
import com.facebook.react.shell.MainReactPackage;

import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;

import go.keybase.Keybase;

import static go.keybase.Keybase.Init;

public class MainActivity extends Activity implements DefaultHardwareBackBtnHandler {

    private static final String TAG = MainActivity.class.getName();

    private ReactInstanceManager mReactInstanceManager;
    private ReactRootView mReactRootView;

    @Override
    @TargetApi(Build.VERSION_CODES.KITKAT)
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Init(this.getFilesDir().getPath(), "staging", "", false);

        try {
            Keybase.SetGlobalExternalKeyStore(new KeyStore(this, getSharedPreferences("KeyStore", MODE_PRIVATE)));
        } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
            e.printStackTrace();
        }

        mReactRootView = new ReactRootView(this);
        mReactInstanceManager = ReactInstanceManager.builder()
          .setApplication(getApplication())
          .setBundleAssetName("index.bundle")
          .setJSMainModuleName("react/index")
          .addPackage(new MainReactPackage())
          .addPackage(new ReactPackage())
          .setUseDeveloperSupport(BuildConfig.DEBUG)
          .setInitialLifecycleState(LifecycleState.RESUMED)
          .build();

        mReactRootView.startReactApplication(mReactInstanceManager, "Keybase", null);
        setContentView(mReactRootView);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (BuildConfig.DEBUG) {
            if (keyCode == KeyEvent.KEYCODE_MENU && mReactInstanceManager != null) {
                mReactInstanceManager.showDevOptionsDialog();
                return true;
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_UP && mReactInstanceManager != null) {
                mReactInstanceManager.getDevSupportManager().handleReloadJS();
                return true;
            }
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    public void invokeDefaultOnBackPressed() {
      super.onBackPressed();
    }

    @Override
    public void onBackPressed() {
        if (mReactInstanceManager != null) {
            mReactInstanceManager.onBackPressed();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();

        if (mReactInstanceManager != null) {
            mReactInstanceManager.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (mReactInstanceManager != null) {
            mReactInstanceManager.onResume(this);
        }
    }
}
