package com.reactnativekb

// Rate-limiting state for the permanent RPC reader loop (see
// KbModule.ReadFromKBLib). Kept here, free of any Android/Keybase dependency
// and with an injectable clock, so the arithmetic is exercisable by a plain
// JVM unit test -- the reader loop itself is a blocking, process-lifetime
// thread that cannot be driven from a test.

/**
 * Reports the first [FIRST_ALWAYS] occurrences of a repeating condition, then
 * every [EVERY_NTH]th.
 *
 * A read error retries every ~100ms; if the connection can't be
 * re-established that is a ~10Hz flood into the uploadable log. Unlike a
 * one-shot degenerate case, a recurring read error is exactly what an
 * operator needs to see recur, so this logs the first few occurrences, then
 * backs off to every Nth rather than going silent.
 */
class LogThrottle {
    private var count = 0

    /** The occurrence number to put in the log line, or null if throttled. */
    fun next(): Int? {
        count++
        return if (count <= FIRST_ALWAYS || count % EVERY_NTH == 0) count else null
    }

    fun reset() {
        count = 0
    }

    companion object {
        const val FIRST_ALWAYS = 5
        const val EVERY_NTH = 50
    }
}

/**
 * Log throttling for reader-loop read errors, split by kind.
 *
 * The split is the whole point: the counter only resets on a successful read,
 * so a sustained EOF outage drives it into the hundreds before a genuine
 * non-EOF failure arrives. Sharing one counter would let the every-Nth
 * throttle swallow the very log line (the one with the exception and stack
 * trace) an operator needs at exactly that transition. A dedicated counter
 * per kind guarantees the first few non-EOF exceptions always log regardless
 * of how long the preceding EOF flood ran.
 */
class ReadErrorLogThrottle {
    private val eof = LogThrottle()
    private val nonEof = LogThrottle()

    /** The occurrence number to put in the log line, or null if throttled. */
    fun next(isEof: Boolean): Int? = if (isEof) eof.next() else nonEof.next()

    fun reset() {
        eof.reset()
        nonEof.reset()
    }
}

/**
 * Throttles the kb-engine-reset EMIT, separately from the log throttles above
 * -- they have different cadences and must not share a counter. JS's
 * disconnectCallback does a full session-cancel sweep (with a log of its own)
 * and connectCallback re-dispatches the bootstrap path, so a connection that
 * cannot be re-dialed must not re-trigger those at ~10Hz. The first failure
 * emits immediately so JS learns promptly, then backs off exponentially to a
 * ceiling. [reset] on the next successful read, so a later, unrelated episode
 * again emits promptly.
 *
 * [nowMs] must be a monotonic clock (SystemClock.elapsedRealtime, not
 * System.currentTimeMillis): a backward wall-clock correction during an
 * outage must not push the next allowed emit into the future.
 */
class EngineResetEmitThrottle(private val nowMs: () -> Long) {
    private var backoffMs = 0L
    private var notBeforeMs = 0L

    /**
     * [deliverable] gates the backoff advance itself, not just the emit: an
     * emit that has nowhere to go (no active react instance / can't emit yet)
     * must not cost a full backoff window, or a dropped notification during
     * e.g. a reload delays the next one that could actually be delivered.
     */
    fun shouldEmit(deliverable: Boolean): Boolean {
        val now = nowMs()
        if (now < notBeforeMs || !deliverable) {
            return false
        }
        backoffMs = if (backoffMs == 0L) INITIAL_MS else minOf(backoffMs * 2, CEILING_MS)
        notBeforeMs = now + backoffMs
        return true
    }

    fun reset() {
        backoffMs = 0L
        notBeforeMs = 0L
    }

    companion object {
        const val INITIAL_MS = 500L
        const val CEILING_MS = 5000L
    }
}
