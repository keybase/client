package io.keybase.ossifrage

import android.content.Context
import android.os.Bundle
import keybase.Keybase

internal class KeybaseLifecycleBind(private val context: Context?) : LifecycleBind {
    override fun willEnterForeground() = Keybase.appWillEnterForeground()

    override fun didBecomeActive() = Keybase.appDidBecomeActive()

    override fun didEnterBackground(): Boolean = Keybase.appDidEnterBackground()

    override fun willExit() = Keybase.appWillExit(notifier())

    override fun pushWindowBegin(): Long = Keybase.appPushWindowBegin()

    override fun pushWindowEnd(token: Long): Boolean = Keybase.appPushWindowEnd(token)

    override fun pushWindowClose(token: Long) = Keybase.appPushWindowClose(token)

    override fun canBeginBackgroundTask(): Boolean = context != null

    override fun beginBackgroundTask() = Keybase.appBeginBackgroundTaskNonblock(notifier())

    private fun notifier() = KBPushNotifier(context!!, Bundle())
}
