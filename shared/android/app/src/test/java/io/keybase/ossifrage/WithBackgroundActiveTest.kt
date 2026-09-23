package io.keybase.ossifrage

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import keybase.ChatNotification
import keybase.PushNotifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Mirrors Go's MobileAppState for the calls the push window makes.
private class StateBind(var foreground: Boolean, var keepRunning: Boolean = false) : LifecycleBind {
    val calls = mutableListOf<String>()

    override fun setAppStateForeground() {
        calls.add("setAppStateForeground")
        foreground = true
    }

    override fun setAppStateBackgroundActive() {
        calls.add("setAppStateBackgroundActive")
        foreground = false
    }

    override fun isAppStateForeground() = foreground

    override fun appDidEnterBackground(): Boolean {
        calls.add("appDidEnterBackground")
        foreground = false
        return keepRunning
    }

    override fun appBeginBackgroundTaskNonblock() {
        calls.add("appBeginBackgroundTaskNonblock")
    }

    override fun appWillExit() {
        calls.add("appWillExit")
    }

    override fun emitAppLifecycle(state: String) {}
}

// gomobile's ChatNotification loads the Go library when constructed, so the
// tests display null.
private class FakeNotifier : PushNotifier {
    var displays = 0

    override fun displayChatNotification(notification: ChatNotification?) {
        displays++
    }

    override fun localNotification(
        ident: String?, title: String?, msg: String?, badgeCount: Long, soundName: String?,
        convID: String?, typ: String?, uid: String?,
    ) {}
}

private object ProcessOwner : LifecycleOwner {
    override val lifecycle: Lifecycle
        get() = throw UnsupportedOperationException()
}

class WithBackgroundActiveTest {
    private val notifier = FakeNotifier()

    // Stands in for handleBackgroundNotification: Go displays through the
    // notifier it is handed.
    private fun handlePush(bind: StateBind, during: () -> Unit = {}): PushNotifier? {
        var handed: PushNotifier? = null
        withBackgroundActive(bind, notifier, {}) { n ->
            bind.calls.add("handleBackgroundNotification")
            handed = n
            during()
            n?.displayChatNotification(null)
        }
        return handed
    }

    @Test
    fun foregroundPushIsHandledByGoWithDisplaySuppressed() {
        val bind = StateBind(foreground = true)
        assertNotNull(handlePush(bind))
        assertEquals(listOf("handleBackgroundNotification"), bind.calls)
        assertEquals(0, notifier.displays)
    }

    @Test
    fun backgroundPushHoldsGoActiveThenHandsOverToABackgroundTask() {
        val bind = StateBind(foreground = false, keepRunning = true)
        handlePush(bind)
        assertEquals(
            listOf(
                "setAppStateBackgroundActive", "handleBackgroundNotification",
                "appDidEnterBackground", "appBeginBackgroundTaskNonblock",
            ),
            bind.calls,
        )
        assertEquals(1, notifier.displays)
    }

    // appDidEnterBackground reports BACKGROUND itself when nothing keeps the
    // app running; each of those calls is a full leveldb flush.
    @Test
    fun backgroundPushWithNothingRunningGoesBackOnce() {
        val bind = StateBind(foreground = false)
        handlePush(bind)
        assertEquals(
            listOf("setAppStateBackgroundActive", "handleBackgroundNotification", "appDidEnterBackground"),
            bind.calls,
        )
        assertEquals(1, notifier.displays)
    }

    @Test
    fun pushAfterTheProcessWentToBackgroundDoesNotReportBackgroundAgain() {
        val bind = StateBind(foreground = false)
        val reporter = AppLifecycleReporter(bind) {}
        reporter.onStart(ProcessOwner)
        reporter.onResume(ProcessOwner)
        reporter.onStop(ProcessOwner)
        handlePush(bind)
        assertEquals(
            listOf(
                "setAppStateForeground", "setAppStateForeground", "appDidEnterBackground",
                "setAppStateBackgroundActive", "handleBackgroundNotification", "appDidEnterBackground",
            ),
            bind.calls,
        )
    }

    @Test
    fun appOpenedDuringThePushStaysForeground() {
        val bind = StateBind(foreground = false)
        handlePush(bind) { bind.setAppStateForeground() }
        assertEquals(
            listOf("setAppStateBackgroundActive", "handleBackgroundNotification", "setAppStateForeground"),
            bind.calls,
        )
        assertEquals(0, notifier.displays)
    }

    // A quick reply has no notifier and must still send in the foreground.
    @Test
    fun foregroundWorkWithoutANotifierStillRuns() {
        val bind = StateBind(foreground = true)
        var handed: PushNotifier? = notifier
        withBackgroundActive(bind, null, {}) {
            bind.calls.add("handlePostTextReply")
            handed = it
        }
        assertNull(handed)
        assertEquals(listOf("handlePostTextReply"), bind.calls)
    }

    private fun handleSilentPush(bind: StateBind): Boolean {
        var ran = false
        handleChatPush(bind, notifier, silent = true, {}) { n ->
            bind.calls.add("handleBackgroundNotification")
            ran = true
            assertNull(n)
        }
        return ran
    }

    // Go only acks a push it is handed a notifier for, so a silent push in the
    // foreground would be unboxed for nothing.
    @Test
    fun foregroundSilentPushSkipsGo() {
        val bind = StateBind(foreground = true)
        assertFalse(handleSilentPush(bind))
        assertEquals(listOf<String>(), bind.calls)
    }

    @Test
    fun backgroundSilentPushIsHandledWithoutANotifier() {
        val bind = StateBind(foreground = false)
        assertTrue(handleSilentPush(bind))
        assertEquals(
            listOf("setAppStateBackgroundActive", "handleBackgroundNotification", "appDidEnterBackground"),
            bind.calls,
        )
    }

    @Test
    fun loudPushIsHandedTheNotifier() {
        val bind = StateBind(foreground = true)
        var handed: PushNotifier? = null
        handleChatPush(bind, notifier, silent = false, {}) { handed = it }
        assertNotNull(handed)
    }
}
