package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EngineResetEmitThrottleTest {
    // Stand-in for SystemClock.elapsedRealtime so the backoff windows can be
    // stepped exactly instead of slept through.
    private class FakeClock(var nowMs: Long = 0L) {
        fun advance(ms: Long) {
            nowMs += ms
        }
    }

    private fun throttle(clock: FakeClock) = EngineResetEmitThrottle { clock.nowMs }

    @Test
    fun firstFailureEmitsImmediately() {
        val clock = FakeClock()
        val t = throttle(clock)
        assertTrue(t.shouldEmit(true))
    }

    @Test
    fun secondEmitIsSuppressedUntilTheWindowElapses() {
        val clock = FakeClock()
        val t = throttle(clock)
        assertTrue(t.shouldEmit(true))
        // ~10Hz retry loop: nine more failures inside the first 500ms window.
        for (i in 1..9) {
            clock.advance(49)
            assertFalse("emit at ${clock.nowMs}ms should be suppressed", t.shouldEmit(true))
        }
        clock.advance(EngineResetEmitThrottle.INITIAL_MS - clock.nowMs)
        assertTrue(t.shouldEmit(true))
    }

    @Test
    fun intervalDoublesPerEmit() {
        val clock = FakeClock()
        val t = throttle(clock)
        val expected = listOf(500L, 1000L, 2000L, 4000L)
        var last = 0L
        assertTrue(t.shouldEmit(true))
        for (want in expected) {
            // One tick short of the window: still suppressed.
            clock.nowMs = last + want - 1
            assertFalse("emit at +${want - 1}ms should be suppressed", t.shouldEmit(true))
            clock.nowMs = last + want
            assertTrue("emit at +${want}ms should be allowed", t.shouldEmit(true))
            last = clock.nowMs
        }
    }

    @Test
    fun clampsAtCeiling() {
        val clock = FakeClock()
        val t = throttle(clock)
        assertTrue(t.shouldEmit(true))
        // Drive well past the point where doubling exceeds the ceiling.
        var last = 0L
        var window = EngineResetEmitThrottle.INITIAL_MS
        repeat(20) {
            clock.nowMs = last + window
            assertTrue(t.shouldEmit(true))
            last = clock.nowMs
            window = minOf(window * 2, EngineResetEmitThrottle.CEILING_MS)
        }
        assertEquals(EngineResetEmitThrottle.CEILING_MS, window)
        // Now confirm the live window really is the ceiling and not larger:
        // one tick short is suppressed, exactly the ceiling is allowed.
        clock.nowMs = last + EngineResetEmitThrottle.CEILING_MS - 1
        assertFalse(t.shouldEmit(true))
        clock.nowMs = last + EngineResetEmitThrottle.CEILING_MS
        assertTrue(t.shouldEmit(true))
    }

    @Test
    fun resetOnSuccessfulReadEmitsPromptlyAgain() {
        val clock = FakeClock()
        val t = throttle(clock)
        assertTrue(t.shouldEmit(true))
        clock.advance(500)
        assertTrue(t.shouldEmit(true)) // backoff now 1000ms
        // A successful read lands.
        t.reset()
        // A later, unrelated episode must notify JS immediately, and start
        // over at the initial interval rather than resuming at 2000ms.
        clock.advance(1)
        assertTrue(t.shouldEmit(true))
        clock.nowMs += EngineResetEmitThrottle.INITIAL_MS - 1
        assertFalse(t.shouldEmit(true))
        clock.advance(1)
        assertTrue(t.shouldEmit(true))
    }

    @Test
    fun undeliverableDoesNotAdvanceTheBackoff() {
        val clock = FakeClock()
        val t = throttle(clock)
        // A whole episode's worth of failures while JS can't receive them
        // (reload in flight): none of them may cost a backoff window.
        repeat(100) {
            clock.advance(100)
            assertFalse(t.shouldEmit(false))
        }
        // The moment JS can receive again, the very next failure emits
        // immediately -- not after a multi-second window.
        assertTrue(t.shouldEmit(true))
        // ...and it is the FIRST emit, so the window that follows is the
        // initial one, not a ceiling-sized one grown by the undeliverable run.
        val at = clock.nowMs
        clock.nowMs = at + EngineResetEmitThrottle.INITIAL_MS - 1
        assertFalse(t.shouldEmit(true))
        clock.advance(1)
        assertTrue(t.shouldEmit(true))
    }

    @Test
    fun undeliverableDuringAnOpenWindowStillDoesNotAdvance() {
        val clock = FakeClock()
        val t = throttle(clock)
        assertTrue(t.shouldEmit(true)) // window 500ms
        clock.advance(500) // window is open again
        assertFalse(t.shouldEmit(false)) // ...but nothing can be delivered
        // The open window must survive: the next deliverable failure emits.
        assertTrue(t.shouldEmit(true))
    }
}

class LogThrottleTest {
    @Test
    fun logsFirstFiveThenEveryFiftiethWithTheOccurrenceNumber() {
        val t = LogThrottle()
        for (i in 1..5) {
            assertEquals("occurrence $i should log", i, t.next())
        }
        for (i in 6..49) {
            assertNull("occurrence $i should be throttled", t.next())
        }
        assertEquals(50, t.next())
        for (i in 51..99) {
            assertNull("occurrence $i should be throttled", t.next())
        }
        assertEquals(100, t.next())
    }

    @Test
    fun resetRestartsTheWindow() {
        val t = LogThrottle()
        repeat(300) { t.next() }
        t.reset()
        assertEquals(1, t.next())
    }
}

class ReadErrorLogThrottleTest {
    // The entire point of the split: an EOF flood must not be able to
    // throttle away the FIRST non-EOF exception -- that is the one log line
    // carrying the exception and stack trace, and it arrives at exactly the
    // transition an operator needs. The counters only reset on a successful
    // read, so during an outage there is no upper bound on how far the EOF
    // count has run.
    @Test
    fun eofFloodDoesNotSwallowTheFirstNonEofError() {
        val t = ReadErrorLogThrottle()
        repeat(300) { t.next(isEof = true) }
        assertEquals("first non-EOF error must always log", 1, t.next(isEof = false))
        // ...and so must the next few.
        for (i in 2..5) {
            assertEquals("non-EOF error $i must log", i, t.next(isEof = false))
        }
        assertNull(t.next(isEof = false))
    }

    // A single shared counter is what this guards against: after a 300-deep
    // EOF flood the first non-EOF error lands on occurrence 301, which the
    // every-50th throttle drops. Pinned here so the mutation is visible.
    @Test
    fun aSharedCounterWouldHaveDroppedIt() {
        val shared = LogThrottle()
        repeat(300) { shared.next() }
        assertNull(shared.next())
    }

    @Test
    fun theTwoKindsCountIndependently() {
        val t = ReadErrorLogThrottle()
        assertEquals(1, t.next(isEof = true))
        assertEquals(1, t.next(isEof = false))
        assertEquals(2, t.next(isEof = true))
        assertEquals(2, t.next(isEof = false))
    }

    @Test
    fun resetClearsBothKinds() {
        val t = ReadErrorLogThrottle()
        repeat(300) { t.next(isEof = true) }
        repeat(300) { t.next(isEof = false) }
        t.reset()
        assertEquals(1, t.next(isEof = true))
        assertEquals(1, t.next(isEof = false))
    }
}
