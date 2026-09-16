package io.keybase.ossifrage

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Future
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private class FakeBind : LifecycleBind {
    val calls: MutableList<String> = Collections.synchronizedList(mutableListOf())
    var stayRunning = false
    var token = 7L
    var endHandsOver = false
    var onDidEnterBackground: () -> Unit = {}

    override fun willEnterForeground() {
        calls.add("willEnterForeground")
    }

    override fun didBecomeActive() {
        calls.add("didBecomeActive")
    }

    override fun didEnterBackground(): Boolean {
        onDidEnterBackground()
        calls.add("didEnterBackground")
        return stayRunning
    }

    override fun willExit() {
        calls.add("willExit")
    }

    override fun pushWindowBegin(): Long {
        calls.add("pushWindowBegin")
        return token
    }

    override fun pushWindowEnd(token: Long): Boolean {
        calls.add("pushWindowEnd($token)")
        return endHandsOver
    }

    override fun beginBackgroundTask() {
        calls.add("beginBackgroundTask")
    }
}

// Runs nothing until told to, so tests see what was queued and in what order.
private class ManualExecutor : LifecycleExecutor {
    val queue = mutableListOf<Runnable>()

    override fun submit(task: Runnable): Future<*> {
        val future = FutureTask<Unit>(task, Unit)
        queue.add(future)
        return future
    }

    fun runAll() {
        while (queue.isNotEmpty()) {
            queue.removeAt(0).run()
        }
    }
}

private object Owner : LifecycleOwner {
    override val lifecycle: Lifecycle
        get() = throw UnsupportedOperationException()
}

class AppLifecycleReporterTest {
    private val bind = FakeBind()
    private val executor = ManualExecutor()
    private val reporter = AppLifecycleReporter(bind, executor) {}

    private fun launch() {
        reporter.onCreate(Owner)
        reporter.onStart(Owner)
        reporter.onResume(Owner)
    }

    private fun stop() {
        reporter.onPause(Owner)
        reporter.onStop(Owner)
    }

    private fun calls(): List<String> {
        executor.runAll()
        return bind.calls.toList()
    }

    @Test
    fun processStartAndStopReportEventsInOrder() {
        launch()
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertTrue("nothing reaches Go on the calling thread", bind.calls.isEmpty())
        assertEquals(
            listOf(
                "willEnterForeground", "didBecomeActive",
                "didEnterBackground",
                "willEnterForeground", "didBecomeActive",
            ),
            calls(),
        )
    }

    @Test
    fun processStopWithWorkStartsTheBackgroundTask() {
        launch()
        bind.stayRunning = true
        stop()
        assertEquals(
            listOf("willEnterForeground", "didBecomeActive", "didEnterBackground", "beginBackgroundTask"),
            calls(),
        )
    }

    @Test
    fun dialogOrPermissionPromptPauseNeverBackgrounds() {
        launch()
        reporter.onPause(Owner)
        reporter.onResume(Owner)
        reporter.onPause(Owner)
        assertEquals(listOf("willEnterForeground", "didBecomeActive", "didBecomeActive"), calls())
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
                "willEnterForeground", "didBecomeActive",
                "didEnterBackground",
                "willEnterForeground", "didBecomeActive",
            ),
            calls(),
        )
    }

    @Test
    fun startWithoutUiReportsTheBackgroundOnce() {
        reporter.onCreate(Owner)
        reporter.reportHeadlessStart()
        reporter.reportHeadlessStart()
        assertEquals(listOf("didEnterBackground"), calls())
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        reporter.reportHeadlessStart()
        assertEquals(listOf("didEnterBackground", "willEnterForeground", "didBecomeActive"), calls())
    }

    @Test
    fun startWithoutUiAfterTheUiReportsNothing() {
        reporter.onStart(Owner)
        reporter.reportHeadlessStart()
        reporter.onResume(Owner)
        stop()
        reporter.reportHeadlessStart()
        assertEquals(listOf("willEnterForeground", "didBecomeActive", "didEnterBackground"), calls())
    }

    @Test
    fun awaitReportedWaitsForQueuedEvents() {
        val executor = SingleThreadLifecycleExecutor()
        val reporter = AppLifecycleReporter(bind, executor) {}
        bind.onDidEnterBackground = { Thread.sleep(100) }
        reporter.reportHeadlessStart()
        reporter.awaitReported(5000)
        assertEquals(listOf("didEnterBackground"), bind.calls.toList())
    }

    @Test
    fun onlyAFinishingActivityExits() {
        launch()
        reporter.onMainActivityDestroy(isFinishing = false, isChangingConfigurations = false)
        reporter.onMainActivityDestroy(isFinishing = true, isChangingConfigurations = true)
        assertEquals(listOf("willEnterForeground", "didBecomeActive"), calls())
        reporter.onMainActivityDestroy(isFinishing = true, isChangingConfigurations = false)
        stop()
        reporter.onStart(Owner)
        reporter.onResume(Owner)
        assertEquals(
            listOf(
                "willEnterForeground", "didBecomeActive",
                "willExit", "didEnterBackground",
                "willEnterForeground", "didBecomeActive",
            ),
            calls(),
        )
    }

    @Test
    fun eventsReachGoInOrderOnOneBackgroundThread() {
        val threads = Collections.synchronizedSet(mutableSetOf<Thread>())
        val record = object : LifecycleBind by bind {
            override fun willEnterForeground() {
                threads.add(Thread.currentThread())
                bind.willEnterForeground()
            }

            override fun didBecomeActive() {
                threads.add(Thread.currentThread())
                bind.didBecomeActive()
            }

            override fun didEnterBackground(): Boolean {
                threads.add(Thread.currentThread())
                // Slow, like the outbox query, so later events queue behind it.
                Thread.sleep(5)
                return bind.didEnterBackground()
            }
        }
        val ordered = AppLifecycleReporter(record, SingleThreadLifecycleExecutor()) {}
        val expected = mutableListOf<String>()
        repeat(20) {
            ordered.onStart(Owner)
            ordered.onResume(Owner)
            ordered.onStop(Owner)
            expected += listOf("willEnterForeground", "didBecomeActive", "didEnterBackground")
        }
        ordered.awaitReported(10_000)
        assertEquals(expected, bind.calls.toList())
        assertEquals(1, threads.size)
        assertFalse(threads.contains(Thread.currentThread()))
    }
}

class RunPushWindowTest {
    private val bind = FakeBind()

    private fun run(inForeground: InForeground = InForeground.SKIP, task: () -> Unit = { bind.calls.add("task") }) =
        runPushWindow(bind, {}, inForeground, task)

    @Test
    fun foregroundSkipsTheTask() {
        bind.token = 0
        assertFalse(run())
        assertEquals(listOf("pushWindowBegin"), bind.calls)
    }

    @Test
    fun foregroundRunsATaskThatMustRunWithoutAWindow() {
        bind.token = 0
        assertTrue(run(InForeground.RUN))
        assertEquals(listOf("pushWindowBegin", "task"), bind.calls)
    }

    @Test
    fun notInitializedRunsTheTaskWithoutAWindow() {
        bind.token = -1
        assertTrue(run())
        assertEquals(listOf("pushWindowBegin", "task"), bind.calls)
    }

    @Test
    fun windowEndsAfterTheTask() {
        assertTrue(run())
        assertEquals(listOf("pushWindowBegin", "task", "pushWindowEnd(7)"), bind.calls)
    }

    @Test
    fun windowHandedOverStartsTheBackgroundTask() {
        bind.endHandsOver = true
        run()
        assertEquals(listOf("pushWindowBegin", "task", "pushWindowEnd(7)", "beginBackgroundTask"), bind.calls)
    }

    @Test
    fun windowEndsWhenTheTaskThrows() {
        try {
            run { throw IllegalStateException("boom") }
            fail("the task's exception propagates")
        } catch (e: IllegalStateException) {
            assertEquals("boom", e.message)
        }
        assertEquals(listOf("pushWindowBegin", "pushWindowEnd(7)"), bind.calls)
    }
}

class SendQuickReplyTest {
    private val bind = FakeBind()
    private val infos = mutableListOf<String>()
    private val errors = mutableListOf<Pair<String, Throwable>>()

    private fun send(send: () -> Unit = { bind.calls.add("send") }) =
        sendQuickReply(bind, { infos.add(it) }, { msg, e -> errors.add(msg to e) }, send)

    @Test
    fun foregroundReplySends() {
        bind.token = 0
        assertEquals(QUICK_REPLY_SENT, send())
        assertEquals(listOf("pushWindowBegin", "send"), bind.calls)
        assertTrue(errors.isEmpty())
    }

    @Test
    fun backgroundReplySendsInAWindow() {
        assertEquals(QUICK_REPLY_SENT, send())
        assertEquals(listOf("pushWindowBegin", "send", "pushWindowEnd(7)"), bind.calls)
    }

    @Test
    fun failedReplyIsNotReportedAsRepliedAndLogsTheException() {
        val failure = IllegalStateException("outbox full")
        assertEquals(QUICK_REPLY_FAILED, send { throw failure })
        assertEquals(listOf("pushWindowBegin", "pushWindowEnd(7)"), bind.calls)
        assertEquals(listOf("Failed to send quick reply" to failure), errors.toList())
        assertTrue(infos.isEmpty())
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
