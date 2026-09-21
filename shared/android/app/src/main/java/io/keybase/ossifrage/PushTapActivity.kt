package io.keybase.ossifrage

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import io.keybase.ossifrage.MainActivity.Companion.setupKBRuntime
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase
import kotlin.concurrent.thread
import org.json.JSONObject

// Opens the app for a tapped notification. Not exported, so only this app's own notification
// PendingIntents can start it: the payload it hands the service, which may name an account to
// switch to, can't come from another app. MainActivity, which any app can start, never reads it.
class PushTapActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Read the Intent here and deliver off the main thread: a tap can be what starts this
        // process, and the initOnce below is a known slow path (leveldb, keychain) while this
        // activity is Theme.NoDisplay and must finish before onResume. Nothing is racing the app
        // coming up: a delivery that lands after the client connected is picked up by the service's
        // nudge, one that lands before it by the peek the client does on connect.
        val payload = runCatching { payloadJSON(intent.extras) }.getOrElse {
            // An empty payload still opens the app, but it opens it nowhere in particular, so the
            // tap has to leave a trace rather than vanish.
            NativeLogger.error("PushTapActivity: could not read a tap payload", it)
            "{}"
        }
        val context = applicationContext
        thread(start = true) {
            runCatching {
                setupKBRuntime(context, false)
                Keybase.deliverPushTap(payload)
            }.onFailure { NativeLogger.error("PushTapActivity: failed to deliver a tap", it) }
        }
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        finish()
    }

    // The push as it arrived, as JSON, which is the shape the service parses. Nothing is picked
    // out of it here: which fields matter is the service's business.
    private fun payloadJSON(extras: Bundle?): String {
        val json = JSONObject()
        extras?.keySet()?.forEach { key ->
            @Suppress("DEPRECATION")
            json.put(key, extras.get(key)?.toString() ?: "")
        }
        return json.toString()
    }
}
