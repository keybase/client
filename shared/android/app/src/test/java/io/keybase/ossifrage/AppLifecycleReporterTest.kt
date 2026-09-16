package io.keybase.ossifrage

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import java.util.Collections
import java.util.concurrent.Future
import java.util.concurrent.FutureTask
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

    private fun run(task: () -> Unit = { bind.calls.add("task") }) = runPushWindow(bind, {}, task)

    @Test
    fun foregroundSkipsTheTask() {
        bind.token = 0
        run()
        assertEquals(listOf("pushWindowBegin"), bind.calls)
    }

    @Test
    fun notInitializedRunsTheTaskWithoutAWindow() {
        bind.token = -1
        run()
        assertEquals(listOf("pushWindowBegin", "task"), bind.calls)
    }

    @Test
    fun windowEndsAfterTheTask() {
        run()
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
