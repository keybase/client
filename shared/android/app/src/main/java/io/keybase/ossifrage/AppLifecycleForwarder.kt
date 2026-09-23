package io.keybase.ossifrage

import android.content.Context
import android.os.Bundle
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.reactnativekb.KbModule
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase

// Reports the whole process's visibility, not one activity's, to Go and JS
// together, so both see the same state. Process ON_STOP only fires once no
// activity is started, so moving between our own activities never looks like a
// trip to the background.
internal class AppLifecycleForwarder(private val context: Context) : DefaultLifecycleObserver {
    override fun onStart(owner: LifecycleOwner) = foreground("onStart")

    override fun onResume(owner: LifecycleOwner) = foreground("onResume")

    override fun onStop(owner: LifecycleOwner) {
        NativeLogger.info("AppLifecycleForwarder: process onStop")
        if (Keybase.appDidEnterBackground()) {
            Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
        } else {
            Keybase.setAppStateBackground()
        }
        KbModule.emitAppLifecycle("background")
    }

    private fun foreground(event: String) {
        NativeLogger.info("AppLifecycleForwarder: process $event")
        Keybase.setAppStateForeground()
        KbModule.emitAppLifecycle("active")
    }
}
