package io.keybase.ossifrage

import android.content.Context
import android.os.Bundle
import com.reactnativekb.KbModule
import keybase.Keybase

internal class KeybaseLifecycleBind(private val context: Context) : LifecycleBind {
    override fun setAppStateForeground() = Keybase.setAppStateForeground()

    override fun setAppStateBackgroundActive() = Keybase.setAppStateBackgroundActive()

    override fun isAppStateForeground() = Keybase.isAppStateForeground()

    override fun appDidEnterBackground() = Keybase.appDidEnterBackground()

    override fun appBeginBackgroundTaskNonblock() = Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))

    override fun appWillExit() = Keybase.appWillExit(KBPushNotifier(context, Bundle()))

    override fun emitAppLifecycle(state: String) = KbModule.emitAppLifecycle(state)
}
