package io.keybase.ossifrage

import java.net.URLDecoder
import java.net.URLEncoder

// A tapped notification's payload rides in the tap Intent's data URI rather than only in an
// extra. PendingIntent.getActivity hands back an existing PendingIntent for any Intent that
// filterEquals the new one, and extras are not part of filterEquals, so without distinct data
// two notifications built with the same request code would share the first one's target.
object PushTapData {
    private const val SCHEME = "kbpushtap:"

    fun encode(payloadJSON: String): String = SCHEME + URLEncoder.encode(payloadJSON, "UTF-8")

    fun decode(dataString: String?): String =
        if (dataString != null && dataString.startsWith(SCHEME)) {
            URLDecoder.decode(dataString.substring(SCHEME.length), "UTF-8")
        } else {
            ""
        }
}
