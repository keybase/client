package com.reactnativekb

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingShareFileNameTest {
    private fun bytes(s: String) = s.toByteArray(Charsets.UTF_8).size

    @Test
    fun keepsAnOrdinaryName() {
        assertEquals("document.pdf", IncomingShareFileName.make("document.pdf", "pdf"))
    }

    @Test
    fun keepsTheNamesOwnExtensionOverTheMimeOne() {
        assertEquals("notes.md", IncomingShareFileName.make("notes.md", "txt"))
    }

    @Test
    fun addsTheMimeExtensionWhenTheNameHasNone() {
        assertEquals("IMG_0001.jpg", IncomingShareFileName.make("IMG_0001", "jpg"))
    }

    @Test
    fun noNameFallsBackWithTheMimeExtension() {
        assertEquals("file.pdf", IncomingShareFileName.make(null, "pdf"))
        assertEquals("file.png", IncomingShareFileName.make("  ", "png"))
    }

    @Test
    fun noNameAndNoMimeExtensionHasNoExtension() {
        assertEquals("file", IncomingShareFileName.make(null, null))
        assertEquals("file", IncomingShareFileName.make("...", ""))
    }

    @Test
    fun pathSeparatorsCannotEscapeTheItemDirectory() {
        assertEquals("etc_passwd", IncomingShareFileName.make("../../etc/passwd", null))
        val made = IncomingShareFileName.make("a/../b\\c:d.txt", null)
        assertEquals("a_.._b_c_d.txt", made)
        assertTrue(!made.contains('/') && !made.contains('\\'))
    }

    @Test
    fun leadingDotsAndSlashesAreTrimmed() {
        assertEquals("hidden", IncomingShareFileName.make("/.hidden", null))
    }

    @Test
    fun controlCharactersAreReplaced() {
        assertEquals("a_b_c.txt", IncomingShareFileName.make("a\nb\u0000c.txt", null))
    }

    @Test
    fun aLongExtensionIsPartOfTheName() {
        assertEquals("x.averyveryverylongext.bin", IncomingShareFileName.make("x.averyveryverylongext", "bin"))
    }

    @Test
    fun longNamesAreCappedInBytesKeepingTheExtension() {
        val made = IncomingShareFileName.make("a".repeat(500) + ".pdf", "pdf")
        assertEquals(IncomingShareFileName.MAX_NAME_BYTES, bytes(made))
        assertTrue(made.endsWith(".pdf"))
    }

    @Test
    fun capNeverSplitsAMultiByteCharacter() {
        // 4 bytes each, a surrogate pair in UTF-16; the room left (195 bytes) is not a
        // multiple of 4, so cutting by UTF-16 unit would leave half a pair
        val made = IncomingShareFileName.make("\uD83D\uDE00".repeat(100) + ".jpeg", null)
        assertTrue(bytes(made) <= IncomingShareFileName.MAX_NAME_BYTES)
        assertTrue(made.endsWith(".jpeg"))
        val base = made.removeSuffix(".jpeg")
        assertEquals(0, base.length % 2)
        assertTrue(base.chunked(2).all { it == "\uD83D\uDE00" })
    }

    @Test
    fun aMimeExtensionWithASeparatorIsIgnored() {
        assertEquals("file", IncomingShareFileName.make(null, "a/b"))
    }
}
