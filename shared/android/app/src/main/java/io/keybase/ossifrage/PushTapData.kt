package io.keybase.ossifrage

import android.os.Bundle
import java.net.URLDecoder
import java.net.URLEncoder

// A push's Bundle reduced to the payload a tap carries. Kept beside PushTapData so both halves
// of the encode have one home.
internal fun bundleTapFields(bundle: Bundle): Map<String, String> =
    PushTapData.tapFields { key ->
        @Suppress("DEPRECATION")
        bundle.get(key)?.toString()
    }

object PushTapData {
    private const val SCHEME = "kbpushtap:"

    // The only fields pushTapTarget (shared/router-v2/deep-link-emitter.tsx) reads. The rest of a
    // push payload stays out of the tap Intent: its data URI is printed by `dumpsys activity`,
    // where an extra was not.
    private val TAP_FIELDS = listOf("type", "convID", "uid", "targetUID", "username")

    // pushTapTarget only tests this prefix, so the rest of a contact message never leaves the app.
    private const val CONTACT_PREFIX = "Your contact"

    fun tapFields(read: (String) -> String?): Map<String, String> {
        val fields = LinkedHashMap<String, String>()
        for (key in TAP_FIELDS) {
            read(key)?.takeIf { it.isNotEmpty() }?.let { fields[key] = it }
        }
        if (read("message")?.startsWith(CONTACT_PREFIX) == true) {
            fields["message"] = CONTACT_PREFIX
        }
        return fields
    }

    // The tap Intent's data. Two notifications opening different targets must produce different
    // data: PendingIntent.getActivity hands back an existing PendingIntent for any Intent that
    // filterEquals the new one, and extras are not part of filterEquals.
    fun tapIntentData(fields: Map<String, String>): String = encode(json(fields))

    fun encode(payloadJSON: String): String = SCHEME + URLEncoder.encode(payloadJSON, "UTF-8")

    fun decode(dataString: String?): String =
        if (dataString != null && dataString.startsWith(SCHEME)) {
            URLDecoder.decode(dataString.substring(SCHEME.length), "UTF-8")
        } else {
            ""
        }

    // Hand-rolled rather than org.json: these values are all plain strings, the field order stays
    // deterministic, and org.json is an android.jar stub that throws in JVM unit tests.
    private fun json(fields: Map<String, String>): String =
        fields.entries.joinToString(",", "{", "}") { quoted(it.key) + ":" + quoted(it.value) }

    private fun quoted(value: String): String {
        val out = StringBuilder("\"")
        for (c in value) {
            when {
                c == '"' -> out.append("\\\"")
                c == '\\' -> out.append("\\\\")
                c == '\n' -> out.append("\\n")
                c == '\r' -> out.append("\\r")
                c == '\t' -> out.append("\\t")
                c < ' ' -> out.append(String.format("\\u%04x", c.code))
                else -> out.append(c)
            }
        }
        return out.append('"').toString()
    }
}
