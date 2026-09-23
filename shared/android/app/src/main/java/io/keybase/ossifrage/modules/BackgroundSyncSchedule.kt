package io.keybase.ossifrage.modules

// WorkManager and the persisted flag, behind interfaces so the scheduling
// decision runs in JVM tests. Each call returns once its operation is done and
// throws if it failed.
internal interface BackgroundSyncJobs {
    // Cancels every BackgroundSyncWorker job, including ones enqueued without
    // a unique name by older versions.
    fun cancelAll()
    fun enqueueUnique()
}

internal interface LegacyJobsCleanupFlag {
    fun isDone(): Boolean
    fun markDone()
}

// Older versions enqueued a new periodic job on every process start, so
// existing installs can carry many. Clear them once, then keep one unique job
// whose period isn't reset on each launch.
internal fun scheduleBackgroundSync(jobs: BackgroundSyncJobs, cleanup: LegacyJobsCleanupFlag) {
    if (cleanup.isDone()) {
        jobs.enqueueUnique()
        return
    }
    jobs.cancelAll()
    jobs.enqueueUnique()
    cleanup.markDone()
}
