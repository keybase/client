package com.reactnativekb

// Holds the latest incoming share until JS is done with it. It lives as long as
// the process, not an Activity, so a recreated Activity doesn't lose a share.
//
// JS keeps no copy: it is told a share's id (by notify, and by asking for
// heldID once it listens, for a share held before then), a share screen reads
// the share by that id, and the share stays here until JS says it is done with
// that id or a newer share replaces it. So nothing JS drops before a screen
// opens can lose it, and once done it is gone for good.
// log: where it says which share it hands out or releases, by id only.
class IncomingShareRelay(
    private val log: (String) -> Unit = {},
    private val notify: (Long) -> Unit = {},
) {
    data class Share(val text: String?, val paths: List<String>, val droppedCount: Int)

    private var open: Share? = null
    private var openID = 0L
    private var lastToken = 0L

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
        open = share
        openID = token
        notify(token)
    }

    // The open share's id, if there is one.
    @Synchronized
    fun heldID(): Long? = if (open != null) openID else null

    // The open share, if id is its id.
    @Synchronized
    fun share(id: Long): Share? {
        val share = if (id == openID) open else null
        log("IncomingShareRelay: share $id ${if (share != null) "handed out" else "not held"}")
        return share
    }

    // JS is done with the share with this id: it was sent, or left.
    @Synchronized
    fun done(id: Long) {
        if (id != openID || open == null) return
        log("IncomingShareRelay: share $id released")
        open = null
    }

    companion object {
        @JvmStatic
        val shared = IncomingShareRelay({ NativeLogger.info(it) }, { KbModule.instance?.emitShare(it) })
    }
}
