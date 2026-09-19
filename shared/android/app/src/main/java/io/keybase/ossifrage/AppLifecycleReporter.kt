package io.keybase.ossifrage

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

// The Go lifecycle entry points. Kept free of Android and gomobile types so
// the event mapping runs in JVM tests.
internal interface LifecycleBind {
    fun uiActive()
    fun uiInactive()
    fun uiBackground()
    fun willExit()
}

// Reports the app's process lifecycle to Go as events; Go decides the state.
//
// Events reach Go on the calling thread, before the callback returns: every Go
// lifecycle call returns at once, except willExit, whose warning about
// messages still sending reads the outbox.
//
// Only the process lifecycle counts. Activity pauses (dialogs, permission
// prompts, choosers, the photo picker sheet) report nothing, not even
// UIInactive: only the process lifecycle decides what Go sees. A full-screen
// picker or camera stops the process like any other exit.
//
// A process started without UI (a push, a quick reply) reports nothing: Go
// starts in the background.
internal class AppLifecycleReporter(
    private val bind: LifecycleBind,
    private val log: (String) -> Unit,
) : DefaultLifecycleObserver {
    override fun onStart(owner: LifecycleOwner) {
        report("uiInactive") { bind.uiInactive() }
    }

    override fun onResume(owner: LifecycleOwner) {
        report("uiActive") { bind.uiActive() }
    }

    override fun onStop(owner: LifecycleOwner) {
        report("uiBackground") { bind.uiBackground() }
    }

    // Activity recreation and a task moved to the back are not an exit.
    fun onMainActivityDestroy(isFinishing: Boolean, isChangingConfigurations: Boolean) {
        if (!isFinishing || isChangingConfigurations) {
            return
        }
        report("willExit") { bind.willExit() }
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
internal fun sendQuickReply(error: (String, Throwable) -> Unit, send: () -> Unit): String =
    try {
        send()
        QUICK_REPLY_SENT
    } catch (e: Exception) {
        error("Failed to send quick reply", e)
        QUICK_REPLY_FAILED
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
