package io.keybase.ossifrage

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

// The Go lifecycle entry points. Kept free of Android and gomobile types so
// the event mapping runs in JVM tests.
internal interface LifecycleBind {
    fun willEnterForeground()
    fun didBecomeActive()
    fun didEnterBackground(): Boolean
    fun willExit()
    fun pushWindowBegin(): Long
    fun pushWindowEnd(token: Long): Boolean
    fun pushWindowClose(token: Long)
    // False when a background task can't run, e.g. with no context for its
    // failure notifications.
    fun canBeginBackgroundTask(): Boolean
    fun beginBackgroundTask()
}

internal interface LifecycleExecutor {
    fun submit(task: Runnable): Future<*>
    // Returns a function that cancels the task.
    fun schedule(delayMs: Long, task: Runnable): () -> Unit
}

internal class SingleThreadLifecycleExecutor : LifecycleExecutor {
    private val executor = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "kb-app-lifecycle") }

    override fun submit(task: Runnable): Future<*> = executor.submit(task)

    override fun schedule(delayMs: Long, task: Runnable): () -> Unit {
        val scheduled = executor.schedule(task, delayMs, TimeUnit.MILLISECONDS)
        return { scheduled.cancel(false) }
    }
}

// Reports the app's process lifecycle to Go as events; Go decides the state.
//
// Events reach Go in the order they happen, on one background thread:
// didEnterBackground queries the outbox, so it can't run on the main thread.
//
// Only the process lifecycle counts. Activity pauses (dialogs, permission
// prompts, choosers, the photo picker) report nothing, not even
// willResignActive: INACTIVE would let a push window open and end in
// BACKGROUND while the app is on screen.
internal class AppLifecycleReporter(
    private val bind: LifecycleBind,
    private val executor: LifecycleExecutor,
    private val log: (String) -> Unit,
) : DefaultLifecycleObserver {
    private enum class Reported { NOTHING, FOREGROUND, BACKGROUND }

    private var reported = Reported.NOTHING
    private var started = false
    private var externalActivityPending = false
    private var deferredStop = 0L
    private var cancelDeferredStop: (() -> Unit)? = null

    @Synchronized
    override fun onStart(owner: LifecycleOwner) {
        started = true
        externalActivityPending = false
        endDeferredStop()
        if (reported != Reported.FOREGROUND) {
            enqueue("willEnterForeground") { bind.willEnterForeground() }
        }
    }

    @Synchronized
    override fun onResume(owner: LifecycleOwner) {
        reported = Reported.FOREGROUND
        enqueue("didBecomeActive") { bind.didBecomeActive() }
    }

    @Synchronized
    override fun onStop(owner: LifecycleOwner) {
        started = false
        if (!externalActivityPending) {
            reportBackground("process stop")
            return
        }
        // A full-screen picker, camera or document UI we started for a result
        // stops the process, but the user is still using the app.
        val token = ++deferredStop
        log("AppLifecycleReporter: deferring the background while an activity started for a result is up")
        cancelDeferredStop = executor.schedule(EXTERNAL_ACTIVITY_GRACE_MS, Runnable { deferredStopExpired(token) })
    }

    @Synchronized
    fun onExternalActivityLaunched() {
        externalActivityPending = true
    }

    @Synchronized
    fun onExternalActivityResult() {
        externalActivityPending = false
    }

    // Activity recreation and a task moved to the back are not an exit.
    @Synchronized
    fun onMainActivityDestroy(isFinishing: Boolean, isChangingConfigurations: Boolean) {
        if (!isFinishing || isChangingConfigurations) {
            return
        }
        endDeferredStop()
        reported = Reported.BACKGROUND
        enqueue("willExit") { bind.willExit() }
    }

    // A process started without UI (a push) starts Go in BACKGROUNDACTIVE with
    // nothing to end it; report the background, unless the UI got there first.
    @Synchronized
    fun reportHeadlessStart() {
        if (reported == Reported.NOTHING && !started) {
            reportBackground("started without UI")
        }
    }

    // Waits until every event reported so far has reached Go.
    fun awaitReported(timeoutMs: Long) {
        try {
            executor.submit(Runnable {}).get(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (e: Exception) {
            log("AppLifecycleReporter: gave up waiting for events to reach Go: $e")
        }
    }

    @Synchronized
    private fun deferredStopExpired(token: Long) {
        if (token != deferredStop || cancelDeferredStop == null || started) {
            return
        }
        cancelDeferredStop = null
        reportBackground("process stop after the external activity grace period")
    }

    private fun endDeferredStop() {
        cancelDeferredStop?.invoke()
        cancelDeferredStop = null
    }

    private fun reportBackground(why: String) {
        reported = Reported.BACKGROUND
        enqueue("didEnterBackground: $why") {
            if (bind.didEnterBackground()) {
                bind.beginBackgroundTask()
            }
        }
    }

    // Callers hold the lock, so tasks are queued in the order events happen.
    private fun enqueue(event: String, call: () -> Unit) {
        executor.submit(Runnable {
            log("AppLifecycleReporter: $event")
            try {
                call()
            } catch (e: Exception) {
                log("AppLifecycleReporter: $event failed: $e")
            }
        })
    }

    companion object {
        const val EXTERNAL_ACTIVITY_GRACE_MS = 2 * 60 * 1000L
    }
}

// Runs task in a push window: Go stays up in BACKGROUNDACTIVE while it runs,
// unless the app is in the foreground, where the task is skipped.
internal fun runPushWindow(bind: LifecycleBind, log: (String) -> Unit, task: () -> Unit) {
    val token = bind.pushWindowBegin()
    if (token == 0L) {
        log("runPushWindow: app is in the foreground, skipping")
        return
    }
    try {
        task()
    } finally {
        // Negative: Go isn't initialized, so no window opened.
        if (token > 0) {
            if (!bind.canBeginBackgroundTask()) {
                bind.pushWindowClose(token)
            } else if (bind.pushWindowEnd(token)) {
                bind.beginBackgroundTask()
            }
        }
    }
}
