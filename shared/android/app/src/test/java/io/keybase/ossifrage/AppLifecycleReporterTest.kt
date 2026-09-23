package io.keybase.ossifrage

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private class FakeBind : LifecycleBind {
    val calls: MutableList<String> = Collections.synchronizedList(mutableListOf())
    val threads: MutableSet<Thread> = Collections.synchronizedSet(mutableSetOf())

    private fun record(call: String) {
        threads.add(Thread.currentThread())
        calls.add(call)
    }

    override fun setAppStateForeground() = record("setAppStateForeground")

    override fun setAppStateBackgroundActive() = record("setAppStateBackgroundActive")

    override fun isAppStateForeground() = false

    override fun appDidEnterBackground(): Boolean {
        record("appDidEnterBackground")
        return false
    }

    override fun appBeginBackgroundTaskNonblock() = record("appBeginBackgroundTaskNonblock")

    override fun appWillExit() = record("appWillExit")

    override fun emitAppLifecycle(state: String) {}
}

private object Owner : LifecycleOwner {
    override val lifecycle: Lifecycle
        get() = throw UnsupportedOperationException()
}

class AppLifecycleReporterTest {
    private val bind = FakeBind()
    private val reporter = AppLifecycleReporter(bind) {}

    private fun launch() {
        reporter.onCreate(Owner)
        reporter.onStart(Owner)
        reporter.onResume(Owner)
    }

    private fun stop() {
        reporter.onPause(Owner)
        reporter.onStop(Owner)
    }

    private fun calls(): List<String> = bind.calls.toList()

    // A full-screen picker or camera stops the process like any other exit.
    @Test
    fun processStartAndStopReportEventsInOrder() {
        launch()
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertEquals(
            listOf(
                "setAppStateForeground", "setAppStateForeground",
                "appDidEnterBackground",
                "setAppStateForeground", "setAppStateForeground",
            ),
            calls(),
        )
    }

    @Test
    fun eventsReachGoOnTheCallingThreadBeforeTheCallbackReturns() {
        reporter.onStart(Owner)
        assertEquals(listOf("setAppStateForeground"), calls())
        reporter.onResume(Owner)
        assertEquals(listOf("setAppStateForeground", "setAppStateForeground"), calls())
        reporter.onStop(Owner)
        assertEquals(listOf("setAppStateForeground", "setAppStateForeground", "appDidEnterBackground"), calls())
        assertEquals(setOf(Thread.currentThread()), bind.threads.toSet())
    }

    @Test
    fun dialogOrPermissionPromptPauseNeverBackgrounds() {
        launch()
        reporter.onPause(Owner)
        reporter.onResume(Owner)
        reporter.onPause(Owner)
        assertEquals(listOf("setAppStateForeground", "setAppStateForeground", "setAppStateForeground"), calls())
    }

    @Test
    fun onlyAFinishingActivityExits() {
        launch()
        reporter.onMainActivityDestroy(isFinishing = false, isChangingConfigurations = false)
        reporter.onMainActivityDestroy(isFinishing = true, isChangingConfigurations = true)
        assertEquals(listOf("setAppStateForeground", "setAppStateForeground"), calls())
        reporter.onMainActivityDestroy(isFinishing = true, isChangingConfigurations = false)
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertEquals(
            listOf(
                "setAppStateForeground", "setAppStateForeground",
                "appWillExit", "appDidEnterBackground",
                "setAppStateForeground", "setAppStateForeground",
            ),
            calls(),
        )
    }
}

class SendQuickReplyTest {
    private val errors = mutableListOf<Pair<String, Throwable?>>()
    private var sent = false

    private fun send(currentUID: () -> String = { "uid" }, msgId: Long = 1, send: () -> Unit = { sent = true }) =
        sendQuickReply(currentUID, msgId, { msg, e -> errors.add(msg to e) }, send)

    @Test
    fun replySends() {
        assertEquals(QUICK_REPLY_SENT, send())
        assertTrue(sent)
        assertTrue(errors.isEmpty())
    }

    @Test
    fun failedReplyIsNotReportedAsRepliedAndLogsTheException() {
        val failure = IllegalStateException("outbox full")
        assertEquals(QUICK_REPLY_FAILED, send { throw failure })
        assertEquals(listOf<Pair<String, Throwable?>>("Failed to send quick reply" to failure), errors.toList())
    }

    // Go sends before it checks either, and swallows the send's error.
    @Test
    fun loggedOutReplyIsNotSent() {
        assertEquals(QUICK_REPLY_FAILED, send(currentUID = { "" }))
        assertFalse(sent)
        assertEquals(1, errors.size)
    }

    @Test
    fun unreadableUidFailsTheReply() {
        val failure = IllegalStateException("go not ready")
        assertEquals(QUICK_REPLY_FAILED, send(currentUID = { throw failure }))
        assertFalse(sent)
        assertEquals(listOf<Throwable?>(failure), errors.map { it.second })
    }

    @Test
    fun replyToAnInvalidMessageIsNotSent() {
        assertEquals(QUICK_REPLY_FAILED, send(msgId = -1))
        assertFalse(sent)
        assertEquals(1, errors.size)
    }
}

class RunReceiverWorkTest {
    private val finishes = AtomicInteger()
    private val finished = CountDownLatch(1)
    private val warnings = Collections.synchronizedList(mutableListOf<String>())
    private val errors = Collections.synchronizedList(mutableListOf<Throwable>())

    private fun run(budgetMs: Long, work: () -> Unit) = runReceiverWork(
        budgetMs,
        { r -> Thread(r).start() },
        { warnings.add(it) },
        { _, e -> errors.add(e) },
        {
            finishes.incrementAndGet()
            finished.countDown()
        },
        work,
    )

    @Test(timeout = 10_000)
    fun finishesAfterTheWorkOffTheCallingThread() {
        val ranOn = AtomicReference<Thread>()
        run(10_000) { ranOn.set(Thread.currentThread()) }
        assertTrue(finished.await(5, TimeUnit.SECONDS))
        assertTrue(ranOn.get() != Thread.currentThread())
        Thread.sleep(50)
        assertEquals(1, finishes.get())
        assertTrue(warnings.isEmpty())
    }

    @Test(timeout = 10_000)
    fun finishesAndLogsWhenTheWorkThrows() {
        val failure = IllegalStateException("boom")
        run(10_000) { throw failure }
        assertTrue(finished.await(5, TimeUnit.SECONDS))
        assertEquals(listOf<Throwable>(failure), errors.toList())
        assertEquals(1, finishes.get())
    }

    @Test(timeout = 10_000)
    fun finishesAtTheBudgetWhileTheWorkIsStillRunning() {
        val release = CountDownLatch(1)
        val workDone = CountDownLatch(1)
        run(100) {
            release.await(5, TimeUnit.SECONDS)
            workDone.countDown()
        }
        assertTrue(finished.await(5, TimeUnit.SECONDS))
        assertEquals(1, warnings.size)
        release.countDown()
        assertTrue(workDone.await(5, TimeUnit.SECONDS))
        Thread.sleep(50)
        assertEquals("finishes once", 1, finishes.get())
    }
}
