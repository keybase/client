package io.keybase.ossifrage;

import android.app.Application;
import android.content.Context;
import android.support.multidex.MultiDex;

import com.reactnativecommunity.netinfo.NetInfoPackage;
import com.evernote.android.job.JobManager;
import com.facebook.imagepipeline.core.ImagePipelineConfig;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.shell.MainPackageConfig;
import com.facebook.react.shell.MainReactPackage;
import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;
import com.facebook.soloader.SoLoader;
import com.RNFetchBlob.RNFetchBlobPackage;
import com.reactnativecommunity.webview.RNCWebViewPackage;
import com.rt2zz.reactnativecontacts.ReactNativeContacts;
import com.dylanvann.fastimage.FastImageViewPackage;

import com.airbnb.android.react.lottie.LottiePackage;
import com.swmansion.gesturehandler.react.RNGestureHandlerPackage;
import com.swmansion.reanimated.ReanimatedPackage;
import com.swmansion.rnscreens.RNScreensPackage;


import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import io.keybase.ossifrage.modules.StorybookConstants;
import io.keybase.ossifrage.modules.BackgroundJobCreator;
import io.keybase.ossifrage.modules.BackgroundSyncJob;
import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.generated.BasePackageList;

import org.unimodules.adapters.react.ModuleRegistryAdapter;
import org.unimodules.adapters.react.ReactModuleRegistryProvider;
import org.unimodules.core.interfaces.SingletonModule;

public class MainApplication extends Application implements ReactApplication {
    private final ReactModuleRegistryProvider mModuleRegistryProvider = new ReactModuleRegistryProvider(new BasePackageList().getPackageList(), Arrays.<SingletonModule>asList());

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);
    }

    @Override
    public void onCreate() {
        NativeLogger.info("MainApplication created");
        super.onCreate();
        SoLoader.init(this, /* native exopackage */ false);
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

    private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {

        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            Context context = getApplicationContext();
            // limit fresco memory
            ImagePipelineConfig frescoConfig = ImagePipelineConfig
                    .newBuilder(context)
                    .setBitmapMemoryCacheParamsSupplier(new CustomBitmapMemoryCacheParamsSupplier(context))
                    .build();

            MainPackageConfig appConfig = new MainPackageConfig.Builder().setFrescoConfig(frescoConfig).build();

            return Arrays.<ReactPackage>asList(
                    new MainReactPackage(appConfig),
                    new KBReactPackage() {
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
                    },
                    new ReactNativePushNotificationPackage(),
                    new RNFetchBlobPackage(),
                    new ReactNativeContacts(),
                    new FastImageViewPackage(),
                    new LottiePackage(),
                    new RNGestureHandlerPackage(),
                    new RNScreensPackage(),
                    new NetInfoPackage(),
                    new RNCWebViewPackage(),
                    new ReanimatedPackage(),
                    new ModuleRegistryAdapter(mModuleRegistryProvider)
            );
        }
        @Override
        protected String getJSMainModuleName() {
            return "index";
        }
    };

    @Override
    public ReactNativeHost getReactNativeHost() {
        return mReactNativeHost;
    }
}
