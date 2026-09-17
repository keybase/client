package io.keybase.ossifrage

import android.content.Context
import android.os.Bundle
import keybase.Keybase

internal class KeybaseLifecycleBind(private val context: Context) : LifecycleBind {
    override fun uiActive() = Keybase.appUIActive()

    override fun uiInactive() = Keybase.appUIInactive()

    override fun uiBackground() {
        Keybase.appUIBackground(KBPushNotifier(context, Bundle()))
    }

    override fun willExit() = Keybase.appWillExit(KBPushNotifier(context, Bundle()))

    override fun pushWindowBegin(): Long = Keybase.appPushWindowBegin()

    override fun pushWindowEnd(token: Long) = Keybase.appPushWindowEnd(token, KBPushNotifier(context, Bundle()))
}
