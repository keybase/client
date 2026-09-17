package io.keybase.ossifrage

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.reactnativekb.KbModule

// Opens the app for a tapped notification. Not exported, so only this app's own notification
// PendingIntents can start it: the tap payload it hands to JS, which may switch accounts, can't
// come from another app. MainActivity, which any app can start, never reads it.
class PushTapActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PushTapData.decode(intent.dataString).takeIf { it.isNotEmpty() }?.let { KbModule.deliverPushTap(it) }
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        // Theme.NoDisplay requires finishing before onResume.
        finish()
    }
}
