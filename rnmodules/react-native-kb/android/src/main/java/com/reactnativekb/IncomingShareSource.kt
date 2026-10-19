package com.reactnativekb

// Which shared items are copied in. An item is read with the app's own
// permissions, so only content:// items are copied, and from the app's own
// providers only the outbox one (see ShareOutbox), which serves nothing else.
object IncomingShareSource {
    // ownAuthorities is every authority the app's providers declare.
    fun canCopy(scheme: String?, authority: String?, ownAuthorities: Set<String>, outboxAuthority: String): Boolean {
        if (!"content".equals(scheme, ignoreCase = true)) return false
        // The resolver drops any "userId@" prefix from the authority, so match without it.
        val bare = authority?.substringAfterLast('@')?.takeIf { it.isNotEmpty() } ?: return false
        return bare == outboxAuthority || bare !in ownAuthorities
    }

    // A provider declares its authorities as one ';'-separated string.
    fun authorities(declared: List<String?>): Set<String> =
        declared.flatMap { it?.split(';').orEmpty() }.map { it.trim() }.filter { it.isNotEmpty() }.toSet()
}
