package io.keybase.ossifrage

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.multidex.MultiDex
import androidx.work.WorkManager
import androidx.work.WorkRequest
import androidx.work.PeriodicWorkRequest
import com.bumptech.glide.Glide
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import expo.modules.ApplicationLifecycleDispatcher.onApplicationCreate
import expo.modules.ApplicationLifecycleDispatcher.onConfigurationChanged
import io.keybase.ossifrage.modules.BackgroundSyncWorker
import io.keybase.ossifrage.modules.NativeLogger
import io.keybase.ossifrage.modules.StorybookConstants
import keybase.Keybase
import java.util.concurrent.TimeUnit

internal class AppLifecycleListener(private val context: Context?) : DefaultLifecycleObserver {
    override fun onStop(owner: LifecycleOwner) { // app moved to background
        Thread { Glide.get(context!!).clearDiskCache() }.start()
    }
}

class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
            val packages: MutableList<ReactPackage> = PackageList(this).packages
            packages.add(object : KBReactPackage() {
                override fun createNativeModules(reactApplicationContext: ReactApplicationContext): List<NativeModule> {
                    return if (BuildConfig.BUILD_TYPE === "storyBook") {
                        val modules: MutableList<NativeModule> = ArrayList()
                        modules.add(StorybookConstants(reactApplicationContext))
                        modules
                    } else {
                        super.createNativeModules(reactApplicationContext)
                    }
                }
            })
            return packages
        }

        override fun getJSMainModuleName(): String = "index"
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)


    override fun onCreate() {
        NativeLogger.info("MainApplication created")
        super.onCreate()
        SoLoader.init(this,  /* native exopackage */false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            load()
        }

        // KB
        onApplicationCreate(this)
        val instanceManager = reactNativeHost.reactInstanceManager
        if (instanceManager != null) {
            ProcessLifecycleOwner.get().lifecycle.addObserver(
                    AppLifecycleListener(instanceManager.currentReactContext)
            )
        }
        val backgroundSyncRequest: WorkRequest = PeriodicWorkRequest.Builder(BackgroundSyncWorker::class.java,
                1, TimeUnit.HOURS,
                15, TimeUnit.MINUTES)
                .build()
        WorkManager
                .getInstance(this)
                .enqueue(backgroundSyncRequest)
    }

    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        MultiDex.install(this)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        onConfigurationChanged(this, newConfig)
    }

    override fun onLowMemory() {
        Keybase.forceGC()
        super.onLowMemory()
    }
}
