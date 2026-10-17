package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class IncomingShareRelayTest {
    private fun text(t: String) = IncomingShareRelay.Share(t, emptyList(), 0)

    private val told = mutableListOf<Long>()

    private fun IncomingShareRelay.add(share: IncomingShareRelay.Share): Long {
        val id = begin()
        fill(id, share)
        return id
    }

    @Test
    fun jsIsToldOfEachShareFilled() {
        val relay = IncomingShareRelay(notify = { told.add(it) })
        val a = relay.add(text("a"))
        val b = relay.add(text("b"))
        assertEquals(listOf(a, b), told)
    }

    @Test
    fun jsThatWasNotListeningAsksForTheHeldShare() {
        val relay = IncomingShareRelay()
        assertNull(relay.heldID())
        relay.begin()
        assertNull(relay.heldID())
        val a = relay.add(text("a"))
        assertEquals(a, relay.heldID())
        val b = relay.add(text("b"))
        assertEquals(b, relay.heldID())
        relay.done(b)
        assertNull(relay.heldID())
    }

    @Test
    fun aShareIsReadOnlyByItsOwnID() {
        val relay = IncomingShareRelay()
        val a = relay.add(text("a"))
        val b = relay.add(text("b"))
        assertNull(relay.share(a))
        assertEquals(text("b"), relay.share(b))
    }

    @Test
    fun keptUntilJSIsDoneWithIt() {
        val relay = IncomingShareRelay()
        val id = relay.add(text("a"))
        relay.done(id + 1)
        assertEquals(text("a"), relay.share(id))
        relay.done(id)
        assertNull(relay.share(id))
    }

    @Test
    fun doneWithAnOlderShareKeepsTheNewer() {
        val relay = IncomingShareRelay()
        val a = relay.add(text("a"))
        val b = relay.add(text("b"))
        relay.done(a)
        assertEquals(text("b"), relay.share(b))
    }

    @Test
    fun theOpenShareStaysWhileTheNextIsPrepared() {
        val relay = IncomingShareRelay()
        val a = relay.add(text("a"))
        val b = relay.begin()
        assertEquals(text("a"), relay.share(a))
        relay.fill(b, text("b"))
        assertNull(relay.share(a))
        assertEquals(text("b"), relay.share(b))
    }

    @Test
    fun aNewerShareSupersedesOneStillBeingPrepared() {
        val relay = IncomingShareRelay(notify = { told.add(it) })
        val older = relay.begin()
        val newer = relay.add(text("newer"))
        relay.fill(older, text("older"))
        assertEquals(listOf(newer), told)
        assertEquals(text("newer"), relay.share(newer))
        assertNull(relay.share(older))
    }

    @Test
    fun logsHandingOutAndReleasingByIDOnly() {
        val lines = mutableListOf<String>()
        val relay = IncomingShareRelay(log = { lines.add(it) })
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
}
