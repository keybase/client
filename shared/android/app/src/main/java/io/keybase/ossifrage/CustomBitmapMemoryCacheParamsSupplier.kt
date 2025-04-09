package io.keybase.ossifrage

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.facebook.common.internal.Supplier
import com.facebook.common.util.ByteConstants
import com.facebook.imagepipeline.cache.MemoryCacheParams

/**
 * Custom Bitmap cache config for Fresco based off of [DefaultBitmapMemoryCacheParamsSupplier]
 */
class CustomBitmapMemoryCacheParamsSupplier(context: Context) : Supplier<MemoryCacheParams> {
    private val activityManager: ActivityManager by lazy {
        context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    }

    override fun get(): MemoryCacheParams {
        return MemoryCacheParams(
                maxCacheSize,
                MAX_CACHE_ENTRIES,
                MAX_EVICTION_QUEUE_SIZE,
                MAX_EVICTION_QUEUE_ENTRIES,
                MAX_CACHE_ENTRY_SIZE)
    }

    private val maxCacheSize: Int
         get() {
            val maxMemory = Math.min(activityManager.memoryClass * ByteConstants.MB, Int.MAX_VALUE)
            return if (maxMemory < 32 * ByteConstants.MB) {
                4 * ByteConstants.MB
            } else if (maxMemory < 64 * ByteConstants.MB) {
                6 * ByteConstants.MB
            } else {
                maxMemory / CACHE_DIVISION
            }
        }

    companion object {
        private const val CACHE_DIVISION = 8 // cache size will be 1/8 of the max allocated app memory
        private const val MAX_CACHE_ENTRIES = 256
        private const val MAX_EVICTION_QUEUE_SIZE = Int.MAX_VALUE
        private const val MAX_EVICTION_QUEUE_ENTRIES = Int.MAX_VALUE
        private const val MAX_CACHE_ENTRY_SIZE = Int.MAX_VALUE
    }
}
