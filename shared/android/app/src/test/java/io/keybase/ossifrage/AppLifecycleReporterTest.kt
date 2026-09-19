package io.keybase.ossifrage

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private class FakeBind : LifecycleBind {
    val calls: MutableList<String> = Collections.synchronizedList(mutableListOf())
    val threads: MutableSet<Thread> = Collections.synchronizedSet(mutableSetOf())

    private fun record(call: String) {
        threads.add(Thread.currentThread())
        calls.add(call)
    }

    override fun uiActive() = record("uiActive")

    override fun uiInactive() = record("uiInactive")

    override fun uiBackground() = record("uiBackground")

    override fun willExit() = record("willExit")
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

    @Test
    fun processStartAndStopReportEventsInOrder() {
        launch()
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertEquals(
            listOf(
                "uiInactive", "uiActive",
                "uiBackground",
                "uiInactive", "uiActive",
            ),
            calls(),
        )
    }

    @Test
    fun eventsReachGoOnTheCallingThreadBeforeTheCallbackReturns() {
        reporter.onStart(Owner)
        assertEquals(listOf("uiInactive"), calls())
        reporter.onResume(Owner)
        assertEquals(listOf("uiInactive", "uiActive"), calls())
        reporter.onStop(Owner)
        assertEquals(listOf("uiInactive", "uiActive", "uiBackground"), calls())
        assertEquals(setOf(Thread.currentThread()), bind.threads.toSet())
    }

    @Test
    fun dialogOrPermissionPromptPauseNeverBackgrounds() {
        launch()
        reporter.onPause(Owner)
        reporter.onResume(Owner)
        reporter.onPause(Owner)
        assertEquals(listOf("uiInactive", "uiActive", "uiActive"), calls())
    }

    // A full-screen picker or camera stops the process like any other exit.
    @Test
    fun fullScreenPickerBackgroundsAndReturningForegrounds() {
        launch()
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertEquals(
            listOf(
                "uiInactive", "uiActive",
                "uiBackground",
                "uiInactive", "uiActive",
            ),
            calls(),
        )
    }

    @Test
    fun onlyAFinishingActivityExits() {
        launch()
        reporter.onMainActivityDestroy(isFinishing = false, isChangingConfigurations = false)
        reporter.onMainActivityDestroy(isFinishing = true, isChangingConfigurations = true)
        assertEquals(listOf("uiInactive", "uiActive"), calls())
        reporter.onMainActivityDestroy(isFinishing = true, isChangingConfigurations = false)
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertEquals(
            listOf(
                "uiInactive", "uiActive",
                "willExit", "uiBackground",
                "uiInactive", "uiActive",
            ),
            calls(),
        )
    }
}

class SendQuickReplyTest {
    private val errors = mutableListOf<Pair<String, Throwable>>()

    private fun send(send: () -> Unit) = sendQuickReply({ msg, e -> errors.add(msg to e) }, send)

    @Test
    fun replySends() {
        var sent = false
        assertEquals(QUICK_REPLY_SENT, send { sent = true })
        assertTrue(sent)
        assertTrue(errors.isEmpty())
    }

    @Test
    fun failedReplyIsNotReportedAsRepliedAndLogsTheException() {
        val failure = IllegalStateException("outbox full")
        assertEquals(QUICK_REPLY_FAILED, send { throw failure })
        assertEquals(listOf("Failed to send quick reply" to failure), errors.toList())
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
