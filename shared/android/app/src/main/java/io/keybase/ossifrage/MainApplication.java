package io.keybase.ossifrage;

import android.app.Application;
import android.content.Context;

import androidx.multidex.MultiDex;

import com.evernote.android.job.JobManager;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.soloader.SoLoader;

import org.unimodules.adapters.react.ModuleRegistryAdapter;
import org.unimodules.adapters.react.ReactAdapterPackage;
import org.unimodules.adapters.react.ReactModuleRegistryProvider;
import org.unimodules.core.interfaces.Package;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import expo.modules.barcodescanner.BarCodeScannerPackage;
import expo.modules.constants.ConstantsPackage;
import expo.modules.contacts.ContactsPackage;
import expo.modules.imagepicker.ImagePickerPackage;
import expo.modules.permissions.PermissionsPackage;
import expo.modules.sms.SMSPackage;
import io.keybase.ossifrage.modules.BackgroundJobCreator;
import io.keybase.ossifrage.modules.BackgroundSyncJob;
import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.modules.StorybookConstants;

public class MainApplication extends Application implements ReactApplication {
    private final ReactModuleRegistryProvider mModuleRegistryProvider = new ReactModuleRegistryProvider(Arrays.<Package>asList(
      new ReactAdapterPackage(),
      new ConstantsPackage(),
      // Same order as package.json
      new BarCodeScannerPackage(),
      new ContactsPackage(),
      new ImagePickerPackage(),
      new PermissionsPackage(),
      new SMSPackage()
    ), null);


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
//            ImagePipelineConfig frescoConfig = ImagePipelineConfig
//                    .newBuilder(context)
//                    .setBitmapMemoryCacheParamsSupplier(new CustomBitmapMemoryCacheParamsSupplier(context))
//                    .build();
//
//            MainPackageConfig appConfig = new MainPackageConfig.Builder().setFrescoConfig(frescoConfig).build();

            @SuppressWarnings("UnnecessaryLocalVariable")
            List<ReactPackage> packages = new PackageList(this).getPackages();
            // new MainReactPackage(appConfig),// removed from rn-diff but maybe we need it for fresco config?
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

            packages.add(new ModuleRegistryAdapter(mModuleRegistryProvider));

            return packages;
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
