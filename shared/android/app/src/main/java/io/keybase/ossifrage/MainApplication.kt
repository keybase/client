package io.keybase.ossifrage

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.multidex.MultiDex
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkRequest
import com.bumptech.glide.Glide
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import expo.modules.ApplicationLifecycleDispatcher.onApplicationCreate
import expo.modules.ApplicationLifecycleDispatcher.onConfigurationChanged
import io.keybase.ossifrage.modules.BackgroundSyncWorker
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase
import java.util.concurrent.TimeUnit

internal class AppLifecycleListener(private val context: Context?) :
    DefaultLifecycleObserver {
    override fun onStop(owner: LifecycleOwner) { // app moved to background
        Thread {
            try {
                Glide.get(context!!).clearDiskCache()
            } catch (e: Exception) {
            }
        }.start()
    }
}

class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages.toMutableList()
            packages.add(KBReactPackage())
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
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            // If you opted-in for the New Architecture, we load the native entry point for this app.
            load(bridgelessEnabled = true)
        }

        // KB
        onApplicationCreate(this)

        val backgroundSyncRequest: WorkRequest = PeriodicWorkRequest.Builder(
            BackgroundSyncWorker::class.java,
            1, TimeUnit.HOURS,
            15, TimeUnit.MINUTES
        )
            .build()
        WorkManager
            .getInstance(this)
            .enqueue(backgroundSyncRequest)
    }

    fun onReactContextInitialized(context: ReactContext?) {
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            AppLifecycleListener(context)
        )
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
