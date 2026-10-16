package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class IncomingShareCacheTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun discardingAShareRemovesOnlyItsCopies() {
        val dir = tmp.newFolder("incoming-shares")
        val copy = { share: String? -> IncomingShareCache.newItemFile(dir, "photo.jpg", share).also { it.writeText("partial") } }
        val a = listOf(copy("a"), copy("a"))
        val others = listOf(copy("ab"), copy(null))

        IncomingShareCache.discardShare(dir, "a")

        a.forEach { assertFalse(it.parentFile!!.exists()) }
        others.forEach { assertTrue(it.exists()) }
        assertEquals(2, dir.list()!!.size)
    }
}
