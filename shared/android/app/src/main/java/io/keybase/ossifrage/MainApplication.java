package io.keybase.ossifrage;

import android.app.Application;
import android.content.Context;
import android.os.Build;
import android.os.Trace;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;

import androidx.annotation.RequiresApi;
import androidx.multidex.MultiDex;

import com.evernote.android.job.JobManager;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMarker;
import com.facebook.react.bridge.ReactMarkerConstants;
import com.facebook.react.uimanager.util.ReactFindViewUtil;
import com.facebook.soloader.SoLoader;

import org.unimodules.adapters.react.ModuleRegistryAdapter;
import org.unimodules.adapters.react.ReactAdapterPackage;
import org.unimodules.adapters.react.ReactModuleRegistryProvider;
import org.unimodules.core.interfaces.Package;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;

import javax.annotation.Nullable;

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

    @RequiresApi(api = Build.VERSION_CODES.JELLY_BEAN_MR2)
    @Override
    public void onCreate() {
        NativeLogger.info("MainApplication created");
        super.onCreate();
        Trace.beginSection("Loading RN native code");
        SoLoader.init(this, /* native exopackage */ false);
        Trace.endSection();
        JobManager manager = JobManager.create(this);
        manager.addJobCreator(new BackgroundJobCreator());

        // Profiling
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        addTTIEndListener();
      }
      ReactMarker.addListener(new ReactMarker.MarkerListener() {
          private final HashSet<ReactMarkerConstants> seenTags = new HashSet<ReactMarkerConstants>();
            @RequiresApi(api = Build.VERSION_CODES.Q)
            @Override
            public void logMarker(ReactMarkerConstants name, @Nullable String tag, int instanceKey) {
                if (tag != null && tag.equals("Storybook")) {
                  Log.d("Marker", "Storybook here" + System.currentTimeMillis());
                }
                if (name.toString().contains("START")) {
//                    Trace.beginAsyncSection(tag, name.ordinal()*1000 + instanceKey);
                    Trace.beginSection(name.toString() + tag);
                } else if (name.toString().contains("END")) {
                    Trace.endSection();
//                    Trace.endAsyncSection(ReactMarkerConstants.values()[name.ordinal() -1].toString() + " " + tag, (name.ordinal()-1)*1000 + instanceKey);

                } else {
                  Trace.beginSection(name.toString() + " " + tag);
                  Trace.endSection();
                }


//              Log.i("Marker", name.toString() + "-" + name.ordinal() + " " + tag + ". instanceKey::" + instanceKey);
            }
        });

        // Make sure exactly one background job is scheduled.
        int numBackgroundJobs = manager.getAllJobRequestsForTag(BackgroundSyncJob.TAG).size();
        if (numBackgroundJobs == 0) {
            BackgroundSyncJob.scheduleJob();
        } else if (numBackgroundJobs > 1) {
            manager.cancelAllForTag(BackgroundSyncJob.TAG);
            BackgroundSyncJob.scheduleJob();
        }
    }

   /**
   * Waits for Loading to complete, also called a Time-To-Interaction (TTI) event. To indicate TTI
   * completion, add a prop nativeID="tti_complete" to the component whose appearance indicates that
   * the initial TTI or loading is complete
   */
  @RequiresApi(api = Build.VERSION_CODES.Q)
  private void addTTIEndListener() {
    Log.d("Marker", "Setting listener");
    Trace.beginAsyncSection("Starting App", 0);
    ReactFindViewUtil.addViewListener(
        new ReactFindViewUtil.OnViewFoundListener() {
          @Override
          public String getNativeId() {
            // This is the value of the nativeID property
            return "tti_complete";
          }

          @Override
          public void onViewFound(final View view) {
            Log.d("Marker", "Found view");
            // Once we find the view, we also need to wait for it to be drawn
            view.getViewTreeObserver()
                // TODO (axe) Should be OnDrawListener instead of this
                .addOnPreDrawListener(
                    new ViewTreeObserver.OnPreDrawListener() {
                      @Override
                      public boolean onPreDraw() {
                        view.getViewTreeObserver().removeOnPreDrawListener(this);
                        Trace.endAsyncSection("Starting App", 0);
                        Log.d("App Start Timing", "End Time " + System.currentTimeMillis());
                        return true;
                      }
                    });
          }
        });
  }

    private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {

        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @RequiresApi(api = Build.VERSION_CODES.JELLY_BEAN_MR2)
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

            Log.d("Package Timing", "Start " + System.currentTimeMillis());
            Trace.beginSection("getPackages");
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
            Trace.endSection();
            Log.d("Package Timing", "End " + System.currentTimeMillis());

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
