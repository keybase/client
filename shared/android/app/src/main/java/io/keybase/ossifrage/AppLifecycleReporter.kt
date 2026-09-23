package io.keybase.ossifrage

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

// Go's lifecycle entry points and the JS app-state event. Kept free of Android
// and gomobile calls so the event mapping and the push window run in JVM tests.
internal interface LifecycleBind {
    fun setAppStateForeground()
    fun setAppStateBackgroundActive()
    fun isAppStateForeground(): Boolean
    fun appDidEnterBackground(): Boolean
    fun appBeginBackgroundTaskNonblock()
    fun appWillExit()
    fun emitAppLifecycle(state: String)
}

// Reports the whole process's visibility, not one activity's, to Go and JS
// together, so both see the same state. Process ON_STOP only fires once no
// activity is started, so moving between our own activities, dialogs and
// permission prompts never looks like a trip to the background.
//
// Calls reach Go on the calling thread, before the callback returns.
internal class AppLifecycleReporter(
    private val bind: LifecycleBind,
    private val log: (String) -> Unit,
) : DefaultLifecycleObserver {
    override fun onStart(owner: LifecycleOwner) = foreground("process onStart")

    override fun onResume(owner: LifecycleOwner) = foreground("process onResume")

    override fun onStop(owner: LifecycleOwner) {
        report("process onStop") {
            // appDidEnterBackground already reports BACKGROUND (and flushes) when
            // it returns false; calling setAppStateBackground too would flush twice.
            if (bind.appDidEnterBackground()) {
                bind.appBeginBackgroundTaskNonblock()
            }
        }
        bind.emitAppLifecycle("background")
    }

    fun onMainActivityResume() = foreground("MainActivity onResume")

    // Activity recreation and a task moved to the back are not an exit.
    fun onMainActivityDestroy(isFinishing: Boolean, isChangingConfigurations: Boolean) {
        if (!isFinishing || isChangingConfigurations) {
            return
        }
        report("MainActivity finishing") { bind.appWillExit() }
        bind.emitAppLifecycle("background")
    }

    private fun foreground(event: String) {
        report(event) { bind.setAppStateForeground() }
        bind.emitAppLifecycle("active")
    }

    private fun report(event: String, call: () -> Unit) {
        log("AppLifecycleReporter: $event")
        try {
            call()
        } catch (e: Exception) {
            log("AppLifecycleReporter: $event failed: $e")
        }
    }
}

// Sends a notification quick reply. Returns the text for the replied
// notification.
internal fun sendQuickReply(
    currentUID: () -> String,
    msgId: Long,
    error: (String, Throwable?) -> Unit,
    send: () -> Unit,
): String {
    val uid = try {
        currentUID()
    } catch (e: Exception) {
        error("Quick reply couldn't read the current uid", e)
        return QUICK_REPLY_FAILED
    }
    // Go sends before it checks either, and swallows the send's error.
    if (uid.isEmpty()) {
        error("Quick reply while logged out", null)
        return QUICK_REPLY_FAILED
    }
    if (msgId < 0) {
        error("Quick reply to invalid message id $msgId", null)
        return QUICK_REPLY_FAILED
    }
    return try {
        send()
        QUICK_REPLY_SENT
    } catch (e: Exception) {
        error("Failed to send quick reply", e)
        QUICK_REPLY_FAILED
    }
}

// Runs a receiver's work off the main thread and calls finish exactly once:
// when the work ends or when budgetMs runs out, whichever is first, so the
// broadcast never outlives its limit. Work that overruns keeps going. An
// exception from work is logged, since it would otherwise kill the process.
internal fun runReceiverWork(
    budgetMs: Long,
    start: (Runnable) -> Unit,
    warn: (String) -> Unit,
    error: (String, Throwable) -> Unit,
    finish: () -> Unit,
    work: () -> Unit,
) {
    val done = CountDownLatch(1)
    start(Runnable {
        try {
            work()
        } catch (e: Exception) {
            error("runReceiverWork: work failed", e)
        } finally {
            done.countDown()
        }
    })
    start(Runnable {
        try {
            if (!done.await(budgetMs, TimeUnit.MILLISECONDS)) {
                warn("runReceiverWork: still running after ${budgetMs}ms, finishing the broadcast")
            }
        } finally {
            finish()
        }
    })
}

internal const val QUICK_REPLY_SENT = "Replied"
internal const val QUICK_REPLY_FAILED = "Couldn't send reply"
