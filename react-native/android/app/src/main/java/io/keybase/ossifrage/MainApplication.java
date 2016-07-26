package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;

import com.burnweb.rnpermissions.RNPermissionsPackage;
import com.eguma.barcodescanner.BarcodeScannerPackage;
import com.facebook.react.ReactApplication;

import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;

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

public class MainApplication extends Application implements ReactApplication {
  private File logFile;

  @Override
  public void onCreate () {
    super.onCreate();

    logFile = this.getFileStreamPath("android.log");
  }

  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {

    @Override
    protected boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
      return Arrays.asList(
              new MainReactPackage(),
              new BarcodeScannerPackage(),
              new RNPermissionsPackage(),
              new KBReactPackage(logFile.getAbsolutePath()));
    }

  };

  @Override
  public ReactNativeHost getReactNativeHost() {
      return mReactNativeHost;
  }
}
