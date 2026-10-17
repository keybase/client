package com.reactnativekb

// The name a shared item's copy is saved under: the sender's display name,
// made safe to use as one path component, or a generated one.
object IncomingShareFileName {
    // ext4/f2fs allow 255 bytes per name; leave room for the suffixes the app
    // adds to its copies (".processed.mp4", ".compressed.jpg", ...).
    const val MAX_NAME_BYTES = 200

    // A longer "extension" is really part of the name.
    private const val MAX_EXT_BYTES = 16

    private const val FALLBACK_BASE = "file"

    // mimeExt is the extension the item's MIME type maps to, if any. It is added
    // when the name has none, so the app can tell what the file is.
    fun make(displayName: String?, mimeExt: String?): String {
        val ext = mimeExt?.trim()?.trimStart('.')?.takeIf { it.isNotEmpty() && sanitize(it) == it }
        val name = sanitize(displayName) ?: return if (ext != null) "$FALLBACK_BASE.$ext" else FALLBACK_BASE

        val dot = name.lastIndexOf('.')
        val current = if (dot > 0) name.substring(dot + 1) else ""
        val keptExt: String?
        var base: String
        if (current.isNotEmpty() && utf8Len(current) <= MAX_EXT_BYTES) {
            keptExt = current
            base = name.substring(0, dot)
        } else {
            keptExt = ext
            base = name
        }
        val extBytes = keptExt?.let { utf8Len(it) + 1 } ?: 0
        base = truncateUtf8(base, MAX_NAME_BYTES - extBytes).trimEnd('.', ' ')
        if (base.isEmpty()) {
            base = FALLBACK_BASE
        }
        return if (keptExt != null) "$base.$keptExt" else base
    }

    // A path separator would escape the item's directory, a leading dot would
    // hide the file, control characters (newlines) garble it in the UI, and
    // bidi/format controls (U+202E) make it display other than it is.
    private fun sanitize(candidate: String?): String? {
        if (candidate == null) return null
        val trimmed = candidate.trim { it.isWhitespace() || it == '/' || it == '\\' || it == '.' }
        // By code point: a format character above U+FFFF is two UTF-16 units,
        // neither of them a format character on its own.
        val cleaned = buildString {
            var i = 0
            while (i < trimmed.length) {
                val cp = trimmed.codePointAt(i)
                if (isReplaced(cp)) append('_') else appendCodePoint(cp)
                i += Character.charCount(cp)
            }
        }
        return cleaned.takeIf { it.isNotEmpty() }
    }

    // The joiners and the tag characters of subdivision flags are format
    // characters too, but they only shape text (emoji sequences, Persian) and
    // can't reorder it.
    private fun isReplaced(cp: Int): Boolean {
        if (cp == 0x200C || cp == 0x200D || cp in 0xE0020..0xE007F) return false
        val type = Character.getType(cp)
        return cp == '/'.code || cp == '\\'.code || cp == ':'.code || cp == 0x2028 || cp == 0x2029 ||
            type == Character.CONTROL.toInt() || type == Character.FORMAT.toInt()
    }

    // The longest prefix of s that fits in maxBytes of UTF-8, cut on a code
    // point boundary, in one pass.
    internal fun truncateUtf8(s: String, maxBytes: Int): String {
        var bytes = 0
        var i = 0
        while (i < s.length) {
            val cp = s.codePointAt(i)
            val n = when {
                cp < 0x80 -> 1
                cp < 0x800 -> 2
                cp < 0x10000 -> 3
                else -> 4
            }
            if (bytes + n > maxBytes) break
            bytes += n
            i += Character.charCount(cp)
        }
        return s.substring(0, i)
    }

    private fun utf8Len(s: String): Int = s.toByteArray(Charsets.UTF_8).size
}
