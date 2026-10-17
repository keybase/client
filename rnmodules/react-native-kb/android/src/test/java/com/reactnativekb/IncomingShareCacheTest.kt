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

    @Test
    fun purgingKeepsTheRestoredSharesCopiesHoweverOld() {
        val dir = tmp.newFolder("incoming-shares")
        val old = { share: String -> IncomingShareCache.newItemFile(dir, "photo.jpg", share).also { it.writeText("x") }.parentFile!! }
        val restored = old("restored")
        val stale = old("stale")
        val now = System.currentTimeMillis()
        listOf(restored, stale).forEach { it.setLastModified(now - 25L * 60 * 60 * 1000) }
        val fresh = old("fresh")

        IncomingShareCache.purgeOld(dir, setOf(restored), now)

        assertTrue(restored.exists())
        assertFalse(stale.exists())
        assertTrue(fresh.exists())
    }
}
