package com.reactnativekb

import java.io.File

// Holds the latest incoming share until JS is done with it. It lives as long as
// the process, not an Activity: a recreated Activity must neither lose a share
// nor wait for a ready signal JS sends only once per runtime. The sink is the
// JS runtime that said it is ready; it is replaced when a new runtime says so.
// A share is handed to JS once, with its id, and kept (for the Activity's saved
// state) until JS says it is done with that id or a newer share replaces it.
class IncomingShareRelay {
    data class Share(val text: String?, val paths: List<String>, val droppedCount: Int)

    private var open: Share? = null
    private var delivered = false
    private var lastToken = 0L
    private var sinkOwner: Any? = null
    private var sink: ((Long, Share) -> Boolean)? = null

    // Starts a new share, superseding any open one and any begun earlier whose
    // contents are still being prepared.
    @Synchronized
    fun begin(): Long {
        lastToken++
        open = null
        return lastToken
    }

    // No-op unless token is the latest begin's. The token is the share's id.
    @Synchronized
    fun fill(token: Long, share: Share) {
        if (token != lastToken) return
        open = share
        delivered = false
        deliverLocked()
    }

    // emit returns true only once JS has the share; until then it is retried.
    @Synchronized
    fun attach(owner: Any, emit: (Long, Share) -> Boolean) {
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

    // Retries a share JS doesn't have yet, e.g. after an emit failed.
    @Synchronized
    fun flush() {
        deliverLocked()
    }

    // JS is done with the share with this id: it was sent, or left.
    @Synchronized
    fun done(id: Long) {
        if (id == lastToken) {
            open = null
        }
    }

    // The share JS doesn't have yet.
    @Synchronized
    fun peek(): Share? = if (delivered) null else open

    // The share JS isn't done with, delivered or not: what the Activity saves.
    @Synchronized
    fun unfinished(): Share? = open

    // Puts back a share saved with an Activity's state, for when the process
    // that held it was killed. A share begun in this process is newer, and wins.
    // Copies purged since (the share cache is swept at startup) count as dropped.
    @Synchronized
    fun restore(share: Share, exists: (String) -> Boolean = { File(it).exists() }) {
        if (lastToken != 0L) return
        val paths = share.paths.filter(exists)
        fill(begin(), share.copy(paths = paths, droppedCount = share.droppedCount + share.paths.size - paths.size))
    }

    private fun deliverLocked() {
        val share = open ?: return
        if (delivered) return
        val emit = sink ?: return
        if (emit(lastToken, share)) {
            delivered = true
        }
    }

    companion object {
        @JvmStatic
        val shared = IncomingShareRelay()
    }
}
