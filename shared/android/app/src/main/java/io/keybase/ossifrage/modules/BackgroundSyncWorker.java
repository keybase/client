package io.keybase.ossifrage.modules;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import keybase.Keybase;

public class BackgroundSyncWorker extends Worker {
    public static final String TAG = "background_sync_job";

    public BackgroundSyncWorker(
            @NonNull Context context,
            @NonNull WorkerParameters params) {
        super(context, params);
    }

    @Override
    public Result doWork() {
        Log.d(TAG, "Background sync start.");
        Keybase.backgroundSync();
        Log.d(TAG, "Background sync complete.");
        return Result.success();
    }
}
