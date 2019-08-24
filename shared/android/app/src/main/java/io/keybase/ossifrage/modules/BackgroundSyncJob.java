package io.keybase.ossifrage.modules;

import android.support.annotation.NonNull;
import android.util.Log;

import com.evernote.android.job.Job;
import com.evernote.android.job.JobRequest;

import java.util.concurrent.TimeUnit;

import keybase.Keybase;

public class BackgroundSyncJob extends Job {
    public static final String TAG = "background_sync_job";

    @Override
    @NonNull
    protected Job.Result onRunJob(@NonNull final Params params) {
        Log.d(TAG, "Background sync start.");
        Keybase.backgroundSync();
        Log.d(TAG, "Background sync complete.");
        return Job.Result.SUCCESS;
    }

    public static void scheduleJob() {
        new JobRequest.Builder(TAG)
                .setRequiredNetworkType(JobRequest.NetworkType.ANY)
                .setPeriodic(TimeUnit.HOURS.toMillis(1))
                .build()
                .schedule();
    }
}
