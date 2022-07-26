package io.keybase.ossifrage;
import android.content.res.Configuration;
import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ReactNativeHostWrapper;
import android.app.Application;
import android.content.Context;

import androidx.multidex.MultiDex;

import com.evernote.android.job.JobManager;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.soloader.SoLoader;
import io.keybase.ossifrage.newarchitecture.MainApplicationReactNativeHost;
import com.facebook.react.bridge.JSIModulePackage;
import com.swmansion.reanimated.ReanimatedJSIModulePackage;

import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.List;

import io.keybase.ossifrage.modules.BackgroundJobCreator;
import io.keybase.ossifrage.modules.BackgroundSyncJob;
import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.modules.StorybookConstants;

import static keybase.Keybase.forceGC;

public class MainApplication extends Application implements ReactApplication {
    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);
    }

    @Override
    public void onCreate() {
        NativeLogger.info("MainApplication created");
        super.onCreate();
        // If you opted-in for the New Architecture, we enable the TurboModule system
        ReactFeatureFlags.useTurboModules = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        SoLoader.init(this, /* native exopackage */ false);
        initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
        ApplicationLifecycleDispatcher.onApplicationCreate(this);
        JobManager manager = JobManager.create(this);
        manager.addJobCreator(new BackgroundJobCreator());

        // Make sure exactly one background job is scheduled.
        int numBackgroundJobs = manager.getAllJobRequestsForTag(BackgroundSyncJob.TAG).size();
        if (numBackgroundJobs == 0) {
            BackgroundSyncJob.scheduleJob();
        } else if (numBackgroundJobs > 1) {
            manager.cancelAllForTag(BackgroundSyncJob.TAG);
            BackgroundSyncJob.scheduleJob();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
    }

    @Override
    public void onLowMemory() {
        forceGC();
        super.onLowMemory();
    }

/**
   * Loads Flipper in React Native templates. Call this in the onCreate method with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private static void initializeFlipper(
      Context context, ReactInstanceManager reactInstanceManager) {
    if (BuildConfig.DEBUG) {
      try {
        NativeLogger.info("MainApplication init flipper");
        /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
        Class<?> aClass = Class.forName("io.keybase.ossifrage.ReactNativeFlipper");
        aClass
            .getMethod("initializeFlipper", Context.class, ReactInstanceManager.class)
            .invoke(null, context, reactInstanceManager);
          NativeLogger.info("MainApplication init flipper loaded!");
      } catch (ClassNotFoundException e) {
        e.printStackTrace();
      } catch (NoSuchMethodException e) {
        e.printStackTrace();
      } catch (IllegalAccessException e) {
        e.printStackTrace();
      } catch (InvocationTargetException e) {
        e.printStackTrace();
      }
    }
  }

    private final ReactNativeHost mReactNativeHost = new ReactNativeHostWrapper(this, new ReactNativeHost(this) {
                @Override
                public boolean getUseDeveloperSupport() {
                    return BuildConfig.DEBUG;
                }

                @Override
                protected List<ReactPackage> getPackages() {
                    //@SuppressWarnings("UnnecessaryLocalVariable")
                    List<ReactPackage> packages = new PackageList(this).getPackages();
                    packages.add(new KBReactPackage() {
                        @Override
                        public List<NativeModule> createNativeModules(ReactApplicationContext reactApplicationContext) {
                            if (BuildConfig.BUILD_TYPE == "storyBook") {
                                List<NativeModule> modules = new ArrayList<>();
                                modules.add(new StorybookConstants(reactApplicationContext));
                                return modules;
                            } else {
                                return super.createNativeModules(reactApplicationContext);
                            }
                        }
                    });

                    return packages;
                }

                @Override
                protected String getJSMainModuleName() {
                    return "index";
                }

                @Override
                protected JSIModulePackage getJSIModulePackage() {
                    return new ReanimatedJSIModulePackage();
                }
    });

    private final ReactNativeHost mNewArchitectureNativeHost =
      new MainApplicationReactNativeHost(this);

    @Override
    public ReactNativeHost getReactNativeHost() {
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
          return mNewArchitectureNativeHost;
        } else {
          return mReactNativeHost;
        }
    }
}
