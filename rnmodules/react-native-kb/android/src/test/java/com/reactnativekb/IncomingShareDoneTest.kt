package com.reactnativekb

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class IncomingShareDoneTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun recordsKeysAndKeepsTheRecentOnes() {
        val file = File(tmp.root, "done")
        assertFalse(IncomingShareDone.contains(file, "a"))
        IncomingShareDone.record(file, "a")
        assertTrue(IncomingShareDone.contains(file, "a"))
        assertFalse(IncomingShareDone.contains(file, "b"))
        assertFalse(IncomingShareDone.contains(file, ""))

        (1..16).forEach { IncomingShareDone.record(file, "k$it") }
        assertFalse(IncomingShareDone.contains(file, "a"))
        assertTrue(IncomingShareDone.contains(file, "k1"))
        assertTrue(IncomingShareDone.contains(file, "k16"))
    }
}
