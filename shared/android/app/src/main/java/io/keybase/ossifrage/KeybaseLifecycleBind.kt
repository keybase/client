package io.keybase.ossifrage

import android.content.Context
import android.os.Bundle
import keybase.Keybase

internal class KeybaseLifecycleBind(private val context: Context) : LifecycleBind {
    override fun willEnterForeground() = Keybase.appWillEnterForeground()

    override fun didBecomeActive() = Keybase.appDidBecomeActive()

    override fun didEnterBackground(): Boolean = Keybase.appDidEnterBackground()

    override fun willExit() = Keybase.appWillExit(KBPushNotifier(context, Bundle()))

    override fun pushWindowBegin(): Long = Keybase.appPushWindowBegin()

    override fun pushWindowEnd(token: Long): Boolean = Keybase.appPushWindowEnd(token)

    override fun beginBackgroundTask() = Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
}
