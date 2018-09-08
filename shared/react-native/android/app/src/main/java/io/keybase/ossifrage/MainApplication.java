package io.keybase.ossifrage;

import android.app.Application;
import android.util.Log;

import com.evernote.android.job.JobManager;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.shell.MainReactPackage;
import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;
import com.facebook.soloader.SoLoader;
import com.imagepicker.ImagePickerPackage;
import com.RNFetchBlob.RNFetchBlobPackage;
import com.rt2zz.reactnativecontacts.ReactNativeContacts;
import org.reactnative.camera.RNCameraPackage;

import java.io.File;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import io.keybase.ossifrage.modules.StorybookConstants;
import io.keybase.ossifrage.modules.BackgroundJobCreator;
import io.keybase.ossifrage.modules.BackgroundSyncJob;

public class MainApplication extends Application implements ReactApplication {
  private static final String NAME = "MainApplication";

  private Instant appStart;

  @Override
  public void onCreate() {
    Clock clock = Clock.systemDefaultZone();
    appStart = clock.instant();
    Log.i(NAME, "App started on " + appStart.toString());
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);
    JobManager manager = JobManager.create(this);
    manager.addJobCreator(new BackgroundJobCreator());

    // Make sure exactly one background job is scheduled.
    int numBackgroundJobs = manager.getAllJobRequestsForTag(BackgroundSyncJob.TAG).size();
    if (numBackgroundJobs == 0) {
        BackgroundSyncJob.scheduleJob();
    } else if (numBackgroundJobs >1 ) {
        manager.cancelAllForTag(BackgroundSyncJob.TAG);
        BackgroundSyncJob.scheduleJob();
    }
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
          new KBReactPackage(appStart) {
            @Override
            public List<NativeModule> createNativeModules(ReactApplicationContext reactApplicationContext) {
              List<NativeModule> modules = new ArrayList<>();
              modules.add(new StorybookConstants(reactApplicationContext));
              return modules;
            }
          },
          new ReactNativePushNotificationPackage(),
          new RNCameraPackage(),
          new ImagePickerPackage(),
          new RNFetchBlobPackage(),
          new ReactNativeContacts()
        );
      }

      return Arrays.<ReactPackage>asList(
              new MainReactPackage(),
              new KBReactPackage(appStart),
              new ReactNativePushNotificationPackage(),
              new RNCameraPackage(),
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
