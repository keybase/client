package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingShareSourceTest {
    private val outbox = "io.keybase.ossifrage.shareoutbox"
    private val own = setOf(outbox, "io.keybase.ossifrage.other")
    private fun canCopy(scheme: String?, authority: String?) =
        IncomingShareSource.canCopy(scheme, authority, own, outbox)

    @Test
    fun copiesContentFromAnotherAppsProvider() {
        assertTrue(canCopy("content", "com.android.providers.media.documents"))
        assertTrue(canCopy("CONTENT", "com.android.providers.media.documents"))
    }

    @Test
    fun skipsOtherSchemes() {
        assertFalse(canCopy("file", null))
        assertFalse(canCopy("file", "com.android.providers.media.documents"))
        assertFalse(canCopy("http", "example.com"))
        assertFalse(canCopy(null, "com.android.providers.media.documents"))
    }

    @Test
    fun skipsTheAppsOwnProviders() {
        assertFalse(canCopy("content", "io.keybase.ossifrage.other"))
    }

    @Test
    fun copiesFromTheAppsOwnOutboxProvider() {
        assertTrue(canCopy("content", outbox))
        assertTrue(canCopy("content", "0@$outbox"))
    }

    @Test
    fun matchesTheAuthorityWithoutAUserPrefix() {
        assertFalse(canCopy("content", "0@io.keybase.ossifrage.other"))
        assertFalse(canCopy("content", "10@io.keybase.ossifrage.other"))
        assertTrue(canCopy("content", "0@com.android.providers.media.documents"))
    }

    @Test
    fun skipsAMissingAuthority() {
        assertFalse(canCopy("content", null))
        assertFalse(canCopy("content", ""))
        assertFalse(canCopy("content", "0@"))
    }

    @Test
    fun splitsMultiAuthorityDeclarations() {
        assertEquals(
            setOf("a.one", "a.two", "b"),
            IncomingShareSource.authorities(listOf("a.one;a.two", null, "b", "")),
        )
    }
}
