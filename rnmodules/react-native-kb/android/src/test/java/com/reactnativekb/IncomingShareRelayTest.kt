package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class IncomingShareRelayTest {
    private fun text(t: String) = IncomingShareRelay.Share(t, emptyList(), 0)

    private class Sink(var accept: Boolean = true) {
        val got = mutableListOf<IncomingShareRelay.Share>()
        val ids = mutableListOf<Long>()
        fun emit(id: Long, share: IncomingShareRelay.Share): Boolean {
            got.add(share)
            ids.add(id)
            return accept
        }
    }

    @Test
    fun heldUntilJSIsReady() {
        val relay = IncomingShareRelay()
        relay.fill(relay.begin(), text("a"))
        assertEquals(text("a"), relay.peek())

        val sink = Sink()
        relay.attach(sink, sink::emit)
        assertEquals(listOf(text("a")), sink.got)
        assertNull(relay.peek())
    }

    @Test
    fun deliveredAtOnceWhenJSIsReady() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::emit)
        relay.fill(relay.begin(), text("a"))
        assertEquals(listOf(text("a")), sink.got)
        assertNull(relay.peek())
    }

    @Test
    fun aFailedEmitKeepsTheShareForARetry() {
        val relay = IncomingShareRelay()
        val sink = Sink(accept = false)
        relay.attach(sink, sink::emit)
        relay.fill(relay.begin(), text("a"))
        assertEquals(text("a"), relay.peek())

        sink.accept = true
        relay.flush()
        assertEquals(listOf(text("a"), text("a")), sink.got)
        assertNull(relay.peek())
    }

    @Test
    fun readinessOutlivesTheActivity() {
        // JS says it is ready once per runtime; later shares, from any Activity,
        // still go straight to it.
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::emit)
        relay.fill(relay.begin(), text("a"))
        relay.fill(relay.begin(), text("b"))
        assertEquals(listOf(text("a"), text("b")), sink.got)
    }

    @Test
    fun aNewerShareSupersedesOneStillBeingPrepared() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::emit)
        val older = relay.begin()
        relay.fill(relay.begin(), text("newer"))
        relay.fill(older, text("older"))
        assertEquals(listOf(text("newer")), sink.got)
        assertNull(relay.peek())
    }

    @Test
    fun aDetachedRuntimeGetsNothing() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::emit)
        relay.detach(sink)
        relay.fill(relay.begin(), text("a"))
        assertEquals(emptyList<IncomingShareRelay.Share>(), sink.got)
        assertEquals(text("a"), relay.peek())
    }

    @Test
    fun aStaleRuntimeCannotDetachItsSuccessor() {
        val relay = IncomingShareRelay()
        val old = Sink()
        val current = Sink()
        relay.attach(old, old::emit)
        relay.attach(current, current::emit)
        relay.detach(old)
        relay.fill(relay.begin(), text("a"))
        assertEquals(emptyList<IncomingShareRelay.Share>(), old.got)
        assertEquals(listOf(text("a")), current.got)
    }

    @Test
    fun aRestoredShareIsHeldUntilJSIsReady() {
        val relay = IncomingShareRelay()
        relay.restore(text("saved"))
        assertEquals(text("saved"), relay.peek())

        val sink = Sink()
        relay.attach(sink, sink::emit)
        assertEquals(listOf(text("saved")), sink.got)
    }

    @Test
    fun aShareBegunInThisProcessIsNotReplacedByARestoredOne() {
        val relay = IncomingShareRelay()
        relay.fill(relay.begin(), text("newer"))
        relay.restore(text("saved"))
        assertEquals(text("newer"), relay.peek())

        val delivered = IncomingShareRelay()
        val sink = Sink()
        delivered.attach(sink, sink::emit)
        delivered.fill(delivered.begin(), text("newer"))
        delivered.restore(text("saved"))
        assertEquals(listOf(text("newer")), sink.got)
    }

    @Test
    fun keptForTheSavedStateUntilJSIsDone() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::emit)
        relay.fill(relay.begin(), text("a"))
        assertNull(relay.peek())
        assertEquals(text("a"), relay.unfinished())

        relay.done(sink.ids[0] + 1)
        assertEquals(text("a"), relay.unfinished())
        relay.done(sink.ids[0])
        assertNull(relay.unfinished())
    }

    @Test
    fun doneWithAnOlderShareKeepsTheNewer() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::emit)
        relay.fill(relay.begin(), text("a"))
        relay.fill(relay.begin(), text("b"))
        relay.done(sink.ids[0])
        assertEquals(text("b"), relay.unfinished())
    }

    @Test
    fun aNewRuntimeDoesNotGetADeliveredShareAgain() {
        val relay = IncomingShareRelay()
        val first = Sink()
        relay.attach(first, first::emit)
        relay.fill(relay.begin(), text("a"))
        val second = Sink()
        relay.attach(second, second::emit)
        relay.flush()
        assertEquals(listOf(text("a")), first.got)
        assertEquals(emptyList<IncomingShareRelay.Share>(), second.got)
    }

    @Test
    fun aRestoredShareCountsPurgedCopiesAsDropped() {
        val relay = IncomingShareRelay()
        relay.restore(IncomingShareRelay.Share(null, listOf("/kept", "/purged"), 1)) { it == "/kept" }
        assertEquals(IncomingShareRelay.Share(null, listOf("/kept"), 2), relay.peek())

        val allGone = IncomingShareRelay()
        allGone.restore(IncomingShareRelay.Share(null, listOf("/purged"), 0)) { false }
        assertEquals(IncomingShareRelay.Share(null, emptyList(), 1), allGone.peek())
    }
}
