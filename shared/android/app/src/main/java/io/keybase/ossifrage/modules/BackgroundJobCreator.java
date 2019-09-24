package io.keybase.ossifrage.modules;

import androidx.annotation.NonNull;

import com.evernote.android.job.Job;
import com.evernote.android.job.JobCreator;

public class BackgroundJobCreator implements JobCreator {

    @Override
    public Job create(@NonNull String tag) {
        switch (tag) {
            case BackgroundSyncJob.TAG:
                return new BackgroundSyncJob();
            default:
                return null;
        }
    }
}
