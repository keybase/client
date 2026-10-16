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
        // Cut whole code points so a multi-byte one is never split.
        while (base.isNotEmpty() && utf8Len(base) + extBytes > MAX_NAME_BYTES) {
            base = base.substring(0, base.offsetByCodePoints(base.length, -1))
        }
        base = base.trimEnd('.', ' ')
        if (base.isEmpty()) {
            base = FALLBACK_BASE
        }
        return if (keptExt != null) "$base.$keptExt" else base
    }

    // A path separator would escape the item's directory, a leading dot would
    // hide the file, and control characters (newlines) garble it in the UI.
    private fun sanitize(candidate: String?): String? {
        if (candidate == null) return null
        val trimmed = candidate.trim { it.isWhitespace() || it == '/' || it == '\\' || it == '.' }
        val cleaned = buildString {
            trimmed.forEach { c -> append(if (isReplaced(c)) '_' else c) }
        }
        return cleaned.takeIf { it.isNotEmpty() }
    }

    private fun isReplaced(c: Char): Boolean =
        c == '/' || c == '\\' || c == ':' || c == ' ' || c == ' ' ||
            c.code in 0x00..0x1F || c.code in 0x7F..0x9F

    private fun utf8Len(s: String): Int = s.toByteArray(Charsets.UTF_8).size
}
