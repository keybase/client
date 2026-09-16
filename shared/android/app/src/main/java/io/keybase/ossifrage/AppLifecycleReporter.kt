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
    fun beginBackgroundTask()
}

internal interface LifecycleExecutor {
    fun submit(task: Runnable): Future<*>
}

internal class SingleThreadLifecycleExecutor : LifecycleExecutor {
    private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "kb-app-lifecycle") }

    override fun submit(task: Runnable): Future<*> = executor.submit(task)
}

// Reports the app's process lifecycle to Go as events; Go decides the state.
//
// Events reach Go in the order they happen, on one background thread:
// didEnterBackground queries the outbox, so it can't run on the main thread.
//
// Only the process lifecycle counts. Activity pauses (dialogs, permission
// prompts, choosers, the photo picker sheet) report nothing, not even
// willResignActive: INACTIVE would let a push window open and end in
// BACKGROUND while the app is on screen. A full-screen picker or camera stops
// the process like any other exit.
internal class AppLifecycleReporter(
    private val bind: LifecycleBind,
    private val executor: LifecycleExecutor,
    private val log: (String) -> Unit,
) : DefaultLifecycleObserver {
    private var reported = false
    private var started = false

    @Synchronized
    override fun onStart(owner: LifecycleOwner) {
        started = true
        reported = true
        enqueue("willEnterForeground") { bind.willEnterForeground() }
    }

    @Synchronized
    override fun onResume(owner: LifecycleOwner) {
        enqueue("didBecomeActive") { bind.didBecomeActive() }
    }

    @Synchronized
    override fun onStop(owner: LifecycleOwner) {
        started = false
        reportBackground("process stop")
    }

    // Activity recreation and a task moved to the back are not an exit.
    @Synchronized
    fun onMainActivityDestroy(isFinishing: Boolean, isChangingConfigurations: Boolean) {
        if (!isFinishing || isChangingConfigurations) {
            return
        }
        reported = true
        enqueue("willExit") { bind.willExit() }
    }

    // A process started without UI (a push) starts Go in BACKGROUNDACTIVE with
    // nothing to end it; report the background, unless the UI got there first.
    @Synchronized
    fun reportHeadlessStart() {
        if (!reported && !started) {
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

    private fun reportBackground(why: String) {
        reported = true
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
}

internal enum class InForeground { SKIP, RUN }

// Runs task in a push window: Go stays up in BACKGROUNDACTIVE while it runs.
// When the app is in the foreground no window opens (Go is already up), and
// the task runs or is skipped per inForeground. Returns whether it ran.
internal fun runPushWindow(bind: LifecycleBind, log: (String) -> Unit, inForeground: InForeground, task: () -> Unit): Boolean {
    val token = bind.pushWindowBegin()
    if (token == 0L) {
        if (inForeground == InForeground.SKIP) {
            log("runPushWindow: app is in the foreground, skipping")
            return false
        }
        task()
        return true
    }
    try {
        task()
    } finally {
        // Negative: Go isn't initialized, so no window opened.
        if (token > 0 && bind.pushWindowEnd(token)) {
            bind.beginBackgroundTask()
        }
    }
    return true
}

// Sends a notification quick reply, which must go out even with the app in
// the foreground. Returns the text for the replied notification.
internal fun sendQuickReply(bind: LifecycleBind, log: (String) -> Unit, send: () -> Unit): String =
    try {
        if (runPushWindow(bind, log, InForeground.RUN, send)) QUICK_REPLY_SENT else QUICK_REPLY_FAILED
    } catch (e: Exception) {
        log("sendQuickReply: failed to send: $e")
        QUICK_REPLY_FAILED
    }

internal const val QUICK_REPLY_SENT = "Replied"
internal const val QUICK_REPLY_FAILED = "Couldn't send reply"
