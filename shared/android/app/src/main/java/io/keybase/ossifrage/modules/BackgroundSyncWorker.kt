package io.keybase.ossifrage.modules

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import keybase.Keybase

class BackgroundSyncWorker(
        context: Context,
        params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        Log.d(TAG, "Background sync start.")
        val result = Keybase.backgroundSync()
        Log.d(TAG, "Background sync complete: $result")
        return Result.success()
    }

    companion object {
        const val TAG = "background_sync_job"
    }
}
