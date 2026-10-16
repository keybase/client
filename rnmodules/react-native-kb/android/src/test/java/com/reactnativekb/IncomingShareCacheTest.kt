package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class IncomingShareCacheTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun discardingAShareRemovesOnlyItsCopies() {
        val dir = tmp.newFolder("incoming-shares")
        listOf("a-1", "a-2", "ab-1", "1234").forEach { name ->
            File(dir, name).mkdirs()
            File(File(dir, name), "photo.jpg").writeText("partial")
        }
        IncomingShareCache.discardShare(dir, "a")
        assertEquals(listOf("1234", "ab-1"), dir.list()!!.sorted())
    }
}
