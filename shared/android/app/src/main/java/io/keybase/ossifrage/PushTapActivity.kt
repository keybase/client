package io.keybase.ossifrage

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.reactnativekb.KbModule
import io.keybase.ossifrage.modules.NativeLogger
import org.json.JSONObject

// Opens the app for a tapped notification. Not exported, so only this app's own notification
// PendingIntents can start it: the payload it hands JS, which may name an account to switch to,
// can't come from another app. MainActivity, which any app can start, never reads it.
class PushTapActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val payload = runCatching { payloadJSON(intent.extras) }.getOrElse {
            // An empty payload still opens the app, but it opens it nowhere in particular, so the
            // tap has to leave a trace rather than vanish.
            NativeLogger.error("PushTapActivity: could not read a tap payload", it)
            "{}"
        }
        // Held in KbModule until JS acks it, so a tap that starts the process waits for JS.
        KbModule.setPushTap(payload)
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        finish()
    }

    // The push as it arrived, as JSON. Nothing is picked out of it here: JS resolves where it opens.
    private fun payloadJSON(extras: Bundle?): String {
        val json = JSONObject()
        extras?.keySet()?.forEach { key ->
            @Suppress("DEPRECATION")
            json.put(key, extras.get(key)?.toString() ?: "")
        }
        return json.toString()
    }
}
