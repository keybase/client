package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PushTapSlotTest {
    @Test
    fun emptyUntilATap() {
        assertNull(PushTapSlot().peek())
    }

    @Test
    fun peekDoesNotClear() {
        val slot = PushTapSlot()
        val id = slot.set("{\"type\":\"chat.newmessage\"}")
        assertEquals(PushTapSlot.Tap("{\"type\":\"chat.newmessage\"}", id), slot.peek())
        assertEquals(PushTapSlot.Tap("{\"type\":\"chat.newmessage\"}", id), slot.peek())
    }

    @Test
    fun ackWithAStaleIdDoesNotClear() {
        val slot = PushTapSlot()
        val older = slot.set("a")
        val newer = slot.set("b")
        slot.ack(older)
        assertEquals(PushTapSlot.Tap("b", newer), slot.peek())
    }

    @Test
    fun ackWithTheCurrentIdClears() {
        val slot = PushTapSlot()
        val id = slot.set("a")
        slot.ack(id)
        assertNull(slot.peek())
        // acking again, or acking once empty, stays a no-op
        slot.ack(id)
        assertNull(slot.peek())
    }

    @Test
    fun aNewTapReplacesWithAHigherId() {
        val slot = PushTapSlot()
        val first = slot.set("a")
        val second = slot.set("b")
        assertTrue(second > first)
        assertEquals(PushTapSlot.Tap("b", second), slot.peek())
    }

    @Test
    fun idsKeepCountingAfterAnAck() {
        val slot = PushTapSlot()
        val first = slot.set("a")
        slot.ack(first)
        val second = slot.set("b")
        assertTrue(second > first)
    }
}
