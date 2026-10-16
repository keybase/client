package com.reactnativekb

import java.io.File

// Holds the latest incoming share until JS is done with it. It lives as long as
// the process, not an Activity: a recreated Activity must neither lose a share
// nor wait for a ready signal JS sends only once per runtime. The sink is the
// JS runtime that said it is ready; it is replaced when a new runtime says so.
//
// JS keeps no copy: the sink is told a share's id, a share screen reads the
// share by that id, and the share stays here (and in the Activity's saved
// state) until JS says it is done with that id or a newer share replaces it.
// So nothing JS drops before a screen opens can lose it, and once done it is
// gone for good.
class IncomingShareRelay {
    data class Share(val text: String?, val paths: List<String>, val droppedCount: Int)

    private var open: Share? = null
    private var openID = 0L
    private var lastToken = 0L
    private var lastFilled = 0L
    // Whether the current sink has been told about the open share.
    private var notified = false
    private var sinkOwner: Any? = null
    private var sink: ((Long) -> Boolean)? = null

    // Starts a new share, superseding any begun earlier whose contents are still
    // being prepared. The open share stays until the new one is filled, so it
    // isn't lost if this one never is.
    @Synchronized
    fun begin(): Long {
        lastToken++
        return lastToken
    }

    // No-op unless token is the latest begin's. The token is the share's id.
    @Synchronized
    fun fill(token: Long, share: Share) {
        if (token != lastToken) return
        lastFilled = token
        open = share
        openID = token
        notified = false
        notifyLocked()
    }

    // notify returns true only once JS has been told; until then it is retried.
    // A new runtime is told about the open share again: whatever screen the old
    // one had for it is gone.
    @Synchronized
    fun attach(owner: Any, notify: (Long) -> Boolean) {
        sinkOwner = owner
        sink = notify
        notified = false
        notifyLocked()
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

    // Retries telling JS, e.g. after an emit failed.
    @Synchronized
    fun flush() {
        notifyLocked()
    }

    // The open share, if id is its id.
    @Synchronized
    fun share(id: Long): Share? = if (id == openID) open else null

    // JS is done with the share with this id: it was sent, or left.
    @Synchronized
    fun done(id: Long) {
        if (id == openID) {
            open = null
        }
    }

    // The share JS isn't done with: what the Activity saves.
    @Synchronized
    fun unfinished(): Share? = open

    // Whether a share is begun and not yet filled.
    @Synchronized
    fun preparing(): Boolean = lastToken != lastFilled

    // Whether this process has begun a share. A recreated Activity whose process
    // has not was killed, and puts back what it saved.
    @Synchronized
    fun started(): Boolean = lastToken != 0L

    // Puts back a share saved with an Activity's state, for when the process
    // that held it was killed. A share begun in this process is newer, and wins.
    // Copies purged since (the share cache is swept at startup) count as dropped.
    @Synchronized
    fun restore(share: Share, exists: (String) -> Boolean = { File(it).exists() }) {
        if (started()) return
        val paths = share.paths.filter(exists)
        fill(begin(), share.copy(paths = paths, droppedCount = share.droppedCount + share.paths.size - paths.size))
    }

    private fun notifyLocked() {
        if (open == null || notified) return
        val notify = sink ?: return
        if (notify(openID)) {
            notified = true
        }
    }

    companion object {
        @JvmStatic
        val shared = IncomingShareRelay()
    }
}
