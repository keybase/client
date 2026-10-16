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

    @Test
    fun bidiAndFormatControlsAreReplaced() {
        // U+202E would show "evil\u202Efdp.exe" as "evilexe.pdf"
        assertEquals("evil_fdp.exe", IncomingShareFileName.make("evil\u202Efdp.exe", null))
        assertEquals("a_b_c_d.txt", IncomingShareFileName.make("a\u200Eb\u2066c\uFEFFd.txt", null))
        assertEquals("a_b_c.txt", IncomingShareFileName.make("a\u2028b\u2029c.txt", null))
    }

    @Test
    fun joinersInsideEmojiAreKept() {
        val family = "\uD83D\uDC68\u200D\uD83D\uDC69"
        assertEquals("$family.png", IncomingShareFileName.make("$family.png", null))
    }

    @Test
    fun aHugeNameIsCappedQuickly() {
        val start = System.nanoTime()
        val made = IncomingShareFileName.make("\u00E9".repeat(1_000_000) + ".pdf", null)
        val elapsedMs = (System.nanoTime() - start) / 1_000_000
        assertTrue(bytes(made) <= IncomingShareFileName.MAX_NAME_BYTES)
        assertTrue(made.endsWith(".pdf"))
        assertTrue("took ${elapsedMs}ms", elapsedMs < 2000)
    }

    @Test
    fun truncateUtf8CutsOnCodePoints() {
        assertEquals("ab", IncomingShareFileName.truncateUtf8("abc", 2))
        // e-acute is 2 bytes: 3 bytes fits one, not one and a half
        assertEquals("\u00E9", IncomingShareFileName.truncateUtf8("\u00E9\u00E9", 3))
        assertEquals("", IncomingShareFileName.truncateUtf8("\uD83D\uDE00", 3))
        assertEquals("\uD83D\uDE00", IncomingShareFileName.truncateUtf8("\uD83D\uDE00x", 4))
    }
}
