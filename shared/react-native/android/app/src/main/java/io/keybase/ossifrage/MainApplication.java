package io.keybase.ossifrage;

import android.app.Application;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.shell.MainReactPackage;
import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;
import com.facebook.soloader.SoLoader;
import com.lwansbrough.RCTCamera.RCTCameraPackage;
import com.imagepicker.ImagePickerPackage;
import com.RNFetchBlob.RNFetchBlobPackage;
import com.rt2zz.reactnativecontacts.ReactNativeContacts;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import io.keybase.ossifrage.modules.StorybookConstants;

public class MainApplication extends Application implements ReactApplication {
  private File logFile;

  @Override
  public void onCreate () {
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);

    logFile = this.getFileStreamPath("android.log");
  }

  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {

    @Override
    public boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
      if (BuildConfig.BUILD_TYPE == "storyBook") {
        return Arrays.<ReactPackage>asList(
          new MainReactPackage(),
          new KBReactPackage("") {
            @Override
            public List<NativeModule> createNativeModules(ReactApplicationContext reactApplicationContext) {
              List<NativeModule> modules = new ArrayList<>();
              modules.add(new StorybookConstants(reactApplicationContext));
              return modules;
            }
          },
          new ReactNativePushNotificationPackage(),
          new RCTCameraPackage(),
          new ImagePickerPackage(),
          new RNFetchBlobPackage(),
          new ReactNativeContacts()
        );
      }

      return Arrays.<ReactPackage>asList(
              new MainReactPackage(),
              new KBReactPackage(logFile.getAbsolutePath()),
              new ReactNativePushNotificationPackage(),
              new RCTCameraPackage(),
              new ImagePickerPackage(),
              new RNFetchBlobPackage(),
              new ReactNativeContacts()
      );
    }

  };

  @Override
  public ReactNativeHost getReactNativeHost() {
      return mReactNativeHost;
  }
}
