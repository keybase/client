package io.keybase.ossifrage.modules;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.os.AsyncTask;
import android.util.Log;

import keybase.Keybase;

public class BackgroundJobService extends JobService {
    private static final String TAG = BackgroundJobService.class.getName();

    @Override
    public boolean onStartJob(JobParameters jobParameters) {
        Log.d(TAG, "Starting async background sync");
        new JobTask(this).execute(jobParameters);
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }

    private static class JobTask extends AsyncTask<JobParameters, Void, JobParameters> {
        private final JobService jobService;

        public JobTask(JobService jobService) {
            this.jobService = jobService;
        }

        @Override
        protected JobParameters doInBackground(JobParameters... params) {
            Log.d(TAG, "Running background sync");
            Keybase.backgroundSync();
            return params[0];
        }

        @Override
        protected void onPostExecute(JobParameters jobParameters) {
            Log.d(TAG, "Background sync complete");
            jobService.jobFinished(jobParameters, false);
        }
    }
}
