package com.reactnativekb

// Holds the latest incoming share until JS has taken it. It lives as long as
// the process, not an Activity: a recreated Activity must neither lose a share
// nor wait for a ready signal JS sends only once per runtime. The sink is the
// JS runtime that said it is ready; it is replaced when a new runtime says so.
class IncomingShareRelay {
    data class Share(val text: String?, val paths: List<String>, val droppedCount: Int)

    private var held: Share? = null
    private var lastToken = 0L
    private var sinkOwner: Any? = null
    private var sink: ((Share) -> Boolean)? = null

    // Starts a new share, superseding any held one and any begun earlier whose
    // contents are still being prepared.
    @Synchronized
    fun begin(): Long {
        lastToken++
        held = null
        return lastToken
    }

    // No-op unless token is the latest begin's.
    @Synchronized
    fun fill(token: Long, share: Share) {
        if (token != lastToken) return
        held = share
        deliverLocked()
    }

    // emit returns true only once JS has the share; until then it stays held.
    @Synchronized
    fun attach(owner: Any, emit: (Share) -> Boolean) {
        sinkOwner = owner
        sink = emit
        deliverLocked()
    }

    // No-op unless owner is the attached one, so a stale runtime's teardown
    // can't detach its successor.
    @Synchronized
    fun detach(owner: Any) {
        if (sinkOwner === owner) {
            sinkOwner = null
            sink = null
        }
    }

    // Retries a held share, e.g. after an emit failed.
    @Synchronized
    fun flush() {
        deliverLocked()
    }

    @Synchronized
    fun peek(): Share? = held

    private fun deliverLocked() {
        val share = held ?: return
        val emit = sink ?: return
        if (emit(share)) {
            held = null
        }
    }

    companion object {
        @JvmStatic
        val shared = IncomingShareRelay()
    }
}
