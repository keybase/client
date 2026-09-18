package io.keybase.ossifrage

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import io.keybase.ossifrage.MainActivity.Companion.setupKBRuntime
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase
import org.json.JSONObject

// Opens the app for a tapped notification. Not exported, so only this app's own notification
// PendingIntents can start it: the payload it hands the service, which may name an account to
// switch to, can't come from another app. MainActivity, which any app can start, never reads it.
class PushTapActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // A tap can be what starts this process, so the service may not be running yet. initOnce
        // is the same call MainActivity makes below and runs at most once, so the cost is moved
        // rather than added.
        runCatching {
            setupKBRuntime(this, false)
            Keybase.deliverPushTap(payloadJSON(intent.extras))
        }.onFailure { NativeLogger.error("PushTapActivity: failed to deliver a tap", it) }
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        // Theme.NoDisplay requires finishing before onResume.
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
