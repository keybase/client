package io.keybase.ossifrage

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.Operation
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.await
import com.bumptech.glide.Glide
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.reactnativekb.IncomingShareCache
import expo.modules.ApplicationLifecycleDispatcher.onApplicationCreate
import expo.modules.ApplicationLifecycleDispatcher.onConfigurationChanged
import expo.modules.ExpoReactHostFactory
import io.keybase.ossifrage.modules.BackgroundSyncJobs
import io.keybase.ossifrage.modules.BackgroundSyncWorker
import io.keybase.ossifrage.modules.LegacyJobsCleanupFlag
import io.keybase.ossifrage.modules.NativeLogger
import io.keybase.ossifrage.modules.scheduleBackgroundSync
import keybase.Keybase
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.util.concurrent.TimeUnit

internal class AppLifecycleListener(private val context: Context?) :
    DefaultLifecycleObserver {
    override fun onStop(owner: LifecycleOwner) { // app moved to background
        Thread {
            try {
                Glide.get(context!!).clearDiskCache()
            } catch (e: Exception) {
                NativeLogger.warn("AppLifecycleListener: error clearing Glide disk cache", e)
            }
        }.start()
    }
}

class MainApplication : Application(), ReactApplication {

    override val reactHost: ReactHost by lazy {
        ExpoReactHostFactory.getDefaultReactHost(
            context = applicationContext,
            packageList = PackageList(this).packages.apply {
                add(KBReactPackage())
            }
        )
    }

    internal val lifecycleReporter by lazy {
        AppLifecycleReporter(KeybaseLifecycleBind(this)) { NativeLogger.info(it) }
    }

    override fun onCreate() {
        NativeLogger.info("MainApplication created")
        super.onCreate()
        // Before any activity starts, so the first process ON_START is seen.
        ProcessLifecycleOwner.get().lifecycle.addObserver(lifecycleReporter)
        try {
            DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
        } catch (e: IllegalArgumentException) {
            DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.STABLE
        }
        loadReactNative(this)

        // KB
        onApplicationCreate(this)

        Thread {
            try {
                IncomingShareCache.purgeOld(this)
            } catch (e: Exception) {
                NativeLogger.warn("MainApplication: error purging old incoming shares", e)
            }
        }.start()

        Thread {
            try {
                scheduleBackgroundSync(WorkManagerBackgroundSyncJobs(this), SharedPrefsCleanupFlag(this))
            } catch (e: Exception) {
                NativeLogger.warn("MainApplication: error scheduling background sync", e)
            }
        }.start()
    }

    fun onReactContextInitialized(context: ReactContext?) {
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            AppLifecycleListener(context)
        )
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

private class WorkManagerBackgroundSyncJobs(context: Context) : BackgroundSyncJobs {
    private val workManager = WorkManager.getInstance(context)

    // WorkManager tags every request with its worker's class name.
    override fun cancelAll() {
        workManager.cancelAllWorkByTag(BackgroundSyncWorker::class.java.name).awaitDone("cancel")
    }

    override fun enqueueUnique() {
        val request = PeriodicWorkRequest.Builder(
            BackgroundSyncWorker::class.java,
            1, TimeUnit.HOURS,
            15, TimeUnit.MINUTES
        ).build()
        workManager.enqueueUniquePeriodicWork("background_sync", ExistingPeriodicWorkPolicy.KEEP, request).awaitDone("enqueue")
    }

    // A stalled WorkManager must not park the scheduling thread forever.
    private fun Operation.awaitDone(what: String) {
        try {
            runBlocking { withTimeout(OPERATION_TIMEOUT_MS) { await() } }
        } catch (e: TimeoutCancellationException) {
            NativeLogger.warn("MainApplication: background sync $what timed out after ${OPERATION_TIMEOUT_MS}ms")
            throw e
        }
    }

    companion object {
        private const val OPERATION_TIMEOUT_MS = 30_000L
    }
}

private class SharedPrefsCleanupFlag(context: Context) : LegacyJobsCleanupFlag {
    private val prefs = context.getSharedPreferences("background_sync", Context.MODE_PRIVATE)

    override fun isDone() = prefs.getBoolean(KEY, false)

    override fun markDone() {
        prefs.edit().putBoolean(KEY, true).commit()
    }

    companion object {
        private const val KEY = "legacy_jobs_cancelled"
    }
}
