package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingShareRelayTest {
    private fun text(t: String) = IncomingShareRelay.Share(t, emptyList(), 0)

    // A share's content, without the key the relay gives it.
    private fun IncomingShareRelay.Share?.content() = this?.copy(key = "")
    private val notDone = { _: String -> false }

    private class Sink(var accept: Boolean = true) {
        val ids = mutableListOf<Long>()
        fun notify(id: Long): Boolean {
            ids.add(id)
            return accept
        }
    }

    private fun IncomingShareRelay.add(share: IncomingShareRelay.Share): Long {
        val id = begin()
        fill(id, share)
        return id
    }

    @Test
    fun toldOnceJSIsReady() {
        val relay = IncomingShareRelay()
        val id = relay.add(text("a"))
        val sink = Sink()
        relay.attach(sink, sink::notify)
        relay.flush()
        assertEquals(listOf(id), sink.ids)
        assertEquals(text("a"), relay.share(id).content())
    }

    @Test
    fun toldAtOnceWhenJSIsReady() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::notify)
        val a = relay.add(text("a"))
        val b = relay.add(text("b"))
        assertEquals(listOf(a, b), sink.ids)
    }

    @Test
    fun aFailedNotifyIsRetried() {
        val relay = IncomingShareRelay()
        val sink = Sink(accept = false)
        relay.attach(sink, sink::notify)
        val id = relay.add(text("a"))
        sink.accept = true
        relay.flush()
        relay.flush()
        assertEquals(listOf(id, id), sink.ids)
    }

    @Test
    fun aShareIsReadOnlyByItsOwnID() {
        val relay = IncomingShareRelay()
        val a = relay.add(text("a"))
        val b = relay.add(text("b"))
        assertNull(relay.share(a).content())
        assertEquals(text("b"), relay.share(b).content())
    }

    @Test
    fun keptUntilJSIsDoneWithIt() {
        val relay = IncomingShareRelay()
        val id = relay.add(text("a"))
        relay.done(id + 1)
        assertEquals(text("a"), relay.saved().share.content())
        relay.done(id)
        assertNull(relay.saved().share.content())
        assertNull(relay.share(id).content())
    }

    @Test
    fun doneWithAnOlderShareKeepsTheNewer() {
        val relay = IncomingShareRelay()
        val a = relay.add(text("a"))
        relay.add(text("b"))
        relay.done(a)
        assertEquals(text("b"), relay.saved().share.content())
    }

    @Test
    fun theOpenShareStaysWhileTheNextIsPrepared() {
        val relay = IncomingShareRelay()
        val a = relay.add(text("a"))
        assertNull(relay.saved().preparing)
        val b = relay.begin("resume b")
        assertEquals("resume b", relay.saved().preparing)
        assertEquals(text("a"), relay.saved().share.content())
        assertEquals(text("a"), relay.share(a).content())
        relay.fill(b, text("b"))
        assertNull(relay.saved().preparing)
        assertEquals(text("b"), relay.saved().share.content())
    }

    @Test
    fun aNewerShareSupersedesOneStillBeingPrepared() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::notify)
        val older = relay.begin()
        val newer = relay.add(text("newer"))
        relay.fill(older, text("older"))
        assertEquals(listOf(newer), sink.ids)
        assertEquals(text("newer"), relay.saved().share.content())
    }

    @Test
    fun aNewRuntimeIsToldAboutAShareNotDoneWith() {
        val relay = IncomingShareRelay()
        val first = Sink()
        relay.attach(first, first::notify)
        val id = relay.add(text("a"))
        relay.flush()
        val second = Sink()
        relay.attach(second, second::notify)
        assertEquals(listOf(id), first.ids)
        assertEquals(listOf(id), second.ids)

        relay.done(id)
        val third = Sink()
        relay.attach(third, third::notify)
        assertEquals(emptyList<Long>(), third.ids)
    }

    @Test
    fun aDetachedRuntimeIsNotTold() {
        val relay = IncomingShareRelay()
        val sink = Sink()
        relay.attach(sink, sink::notify)
        relay.detach(sink)
        val id = relay.add(text("a"))
        assertEquals(emptyList<Long>(), sink.ids)
        assertEquals(text("a"), relay.share(id).content())
    }

    @Test
    fun aStaleRuntimeCannotDetachItsSuccessor() {
        val relay = IncomingShareRelay()
        val old = Sink()
        val current = Sink()
        relay.attach(old, old::notify)
        relay.attach(current, current::notify)
        relay.detach(old)
        val id = relay.add(text("a"))
        assertEquals(emptyList<Long>(), old.ids)
        assertEquals(listOf(id), current.ids)
    }

    @Test
    fun aRestoredShareIsOpen() {
        val relay = IncomingShareRelay()
        assertFalse(relay.started())
        relay.restore(text("saved"), notDone)
        assertTrue(relay.started())
        assertEquals(text("saved"), relay.saved().share.content())
    }

    @Test
    fun aShareBegunInThisProcessIsNotReplacedByARestoredOne() {
        val relay = IncomingShareRelay()
        relay.add(text("newer"))
        relay.restore(text("saved"), notDone)
        assertEquals(text("newer"), relay.saved().share.content())

        val preparing = IncomingShareRelay()
        preparing.begin()
        preparing.restore(text("saved"), notDone)
        assertNull(preparing.saved().share.content())
    }

    @Test
    fun aRestoredShareCountsPurgedCopiesAsDropped() {
        val relay = IncomingShareRelay()
        relay.restore(IncomingShareRelay.Share(null, listOf("/kept", "/purged"), 1), notDone) { it == "/kept" }
        assertEquals(IncomingShareRelay.Share(null, listOf("/kept"), 2), relay.saved().share.content())

        val allGone = IncomingShareRelay()
        allGone.restore(IncomingShareRelay.Share(null, listOf("/purged"), 0), notDone) { false }
        assertEquals(IncomingShareRelay.Share(null, emptyList(), 1), allGone.saved().share.content())
    }

    @Test
    fun savedPartsStayWithinOneBudget() {
        assertEquals(listOf(true, true), IncomingShareRelay.withinBudget(listOf(40, 60), 100))
        assertEquals(listOf(true, false), IncomingShareRelay.withinBudget(listOf(60, 60), 100))
        assertEquals(listOf(false, true), IncomingShareRelay.withinBudget(listOf(120, 60), 100))
    }

    @Test
    fun logsHandingOutAndReleasingByIDOnly() {
        val lines = mutableListOf<String>()
        val relay = IncomingShareRelay { lines.add(it) }
        val id = relay.add(text("secret text"))
        relay.share(id)
        relay.done(id)
        relay.share(id)
        assertEquals(
            listOf(
                "IncomingShareRelay: share $id handed out",
                "IncomingShareRelay: share $id released",
                "IncomingShareRelay: share $id not held",
            ),
            lines,
        )
    }

    @Test
    fun whatResumesAShareBeingPreparedOutlivesTheActivityThatBeganIt() {
        // Any Activity saved while the copy runs saves it, read from the relay.
        val relay = IncomingShareRelay()
        val older = relay.begin("resume older")
        val newer = relay.begin("resume newer")
        assertEquals("resume newer", relay.saved().preparing)
        relay.fill(older, text("older"))
        assertEquals("resume newer", relay.saved().preparing)
        relay.fill(newer, text("newer"))
        assertNull(relay.saved().preparing)
        relay.add(text("text"))
        assertNull(relay.saved().preparing)
    }

    @Test
    fun aShareIsGivenAKeyThatOutlivesTheProcess() {
        val relay = IncomingShareRelay()
        val id = relay.add(text("a"))
        val key = relay.saved().share!!.key
        assertTrue(key.isNotEmpty())
        assertEquals(key, relay.done(id))
        assertNull(relay.done(id))

        val restored = IncomingShareRelay()
        restored.restore(text("a").copy(key = "k"), notDone)
        assertEquals("k", restored.saved().share!!.key)
    }

    @Test
    fun aShareDoneWithAfterItWasSavedIsNotRestored() {
        val relay = IncomingShareRelay()
        relay.restore(text("sent").copy(key = "k"), isDone = { it == "k" })
        assertNull(relay.saved().share)
        assertFalse(relay.started())
    }
}
