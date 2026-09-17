package io.keybase.ossifrage

import android.content.Context
import android.os.Bundle
import keybase.Keybase

internal class KeybaseLifecycleBind(private val context: Context) : LifecycleBind {
    override fun uiActive() = Keybase.appUIActive()

    override fun uiInactive() = Keybase.appUIInactive()

    override fun uiBackground(): Long = Keybase.appUIBackground()

    override fun willExit() = Keybase.appWillExit(KBPushNotifier(context, Bundle()))

    override fun pushWindowBegin(): Long = Keybase.appPushWindowBegin()

    override fun pushWindowEnd(token: Long): Long = Keybase.appPushWindowEnd(token)

    override fun beginBackgroundTask(token: Long) =
        Keybase.appBeginBackgroundTaskNonblock(token, KBPushNotifier(context, Bundle()))
}
