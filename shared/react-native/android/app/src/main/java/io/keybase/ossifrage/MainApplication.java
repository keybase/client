package io.keybase.ossifrage;

import android.app.Application;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;
import com.facebook.soloader.SoLoader;
import com.lwansbrough.RCTCamera.RCTCameraPackage;
import com.imagepicker.ImagePickerPackage;
import com.RNFetchBlob.RNFetchBlobPackage;
import com.reactnativenavigation.NavigationApplication;

import java.io.File;
import java.util.Arrays;
import java.util.List;

public class MainApplication extends Application implements NavigationApplication {
  private File logFile;

  @Override
  public void onCreate () {
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);

    logFile = this.getFileStreamPath("android.log");
  }

  @Override
  public boolean isDebug() {
    return BuildConfig.DEBUG;
  }

  protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
      new KBReactPackage(logFile.getAbsolutePath()),
      new ReactNativePushNotificationPackage(),
      new RCTCameraPackage(),
      new ImagePickerPackage(),
      new RNFetchBlobPackage()
    );
  }

  @Override
  public List<ReactPackage> createAdditionalReactPackages() {
    return getPackages();
  }
}
