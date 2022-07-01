package io.keybase.ossifrage;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;

import com.facebook.common.internal.Supplier;
import com.facebook.common.util.ByteConstants;
import com.facebook.imagepipeline.cache.DefaultBitmapMemoryCacheParamsSupplier;
import com.facebook.imagepipeline.cache.MemoryCacheParams;

/**
 * Custom Bitmap cache config for Fresco based off of {@link DefaultBitmapMemoryCacheParamsSupplier}
 */
public class CustomBitmapMemoryCacheParamsSupplier implements Supplier<MemoryCacheParams> {

    private static final int CACHE_DIVISION = 8; // cache size will be 1/8 of the max allocated app memory
    private static final int MAX_CACHE_ENTRIES = 256;
    private static final int MAX_EVICTION_QUEUE_SIZE = Integer.MAX_VALUE;
    private static final int MAX_EVICTION_QUEUE_ENTRIES = Integer.MAX_VALUE;
    private static final int MAX_CACHE_ENTRY_SIZE = Integer.MAX_VALUE;

    private final ActivityManager mActivityManager;

    public CustomBitmapMemoryCacheParamsSupplier(Context context) {
        mActivityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
    }

    @Override
    public MemoryCacheParams get() {
        return new MemoryCacheParams(
                getMaxCacheSize(),
                MAX_CACHE_ENTRIES,
                MAX_EVICTION_QUEUE_SIZE,
                MAX_EVICTION_QUEUE_ENTRIES,
                MAX_CACHE_ENTRY_SIZE);
    }

    private int getMaxCacheSize() {
        final int maxMemory =
                Math.min(mActivityManager.getMemoryClass() * ByteConstants.MB, Integer.MAX_VALUE);
        if (maxMemory < 32 * ByteConstants.MB) {
            return 4 * ByteConstants.MB;
        } else if (maxMemory < 64 * ByteConstants.MB) {
            return 6 * ByteConstants.MB;
        } else {
            // We don't want to use more ashmem on Gingerbread for now, since it doesn't respond well to
            // native memory pressure (doesn't throw exceptions, crashes app, crashes phone)
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.HONEYCOMB) {
                return 8 * ByteConstants.MB;
            } else {
                return maxMemory / CACHE_DIVISION;
            }
        }
    }
}