package com.reactnativekb

// Rules for copying a shared item out of the app that shared it.
object IncomingShareCopy {
    // Only content:// is read on the sender's behalf, through its provider and
    // the grant it gave us. Any other scheme names a path that we would open
    // with our own permissions, so it is never copied.
    fun isCopyableScheme(scheme: String?): Boolean = "content".equals(scheme, ignoreCase = true)
}
