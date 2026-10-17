package com.reactnativekb

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingShareCopyTest {
    @Test
    fun onlyContentUrisAreCopied() {
        assertTrue(IncomingShareCopy.isCopyableScheme("content"))
        assertTrue(IncomingShareCopy.isCopyableScheme("CONTENT"))
        assertFalse(IncomingShareCopy.isCopyableScheme("file"))
        assertFalse(IncomingShareCopy.isCopyableScheme("android.resource"))
        assertFalse(IncomingShareCopy.isCopyableScheme(""))
        assertFalse(IncomingShareCopy.isCopyableScheme(null))
    }
}
