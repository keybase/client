package io.keybase.ossifrage

import android.app.PendingIntent
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import io.keybase.ossifrage.MainActivity.Companion.setupKBRuntime
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase

class ChatBroadcastReceiver : BroadcastReceiver() {
    @RequiresApi(api = Build.VERSION_CODES.KITKAT_WATCH)
    private fun getMessageText(intent: Intent): String? {
        val remoteInput = RemoteInput.getResultsFromIntent(intent)
        return remoteInput?.getCharSequence(KEY_TEXT_REPLY)?.toString()
    }

    @RequiresApi(api = Build.VERSION_CODES.KITKAT_WATCH)
    override fun onReceive(context: Context, intent: Intent) {
        setupKBRuntime(context, false)
        val convData = ConvData(intent)
        val openConv = intent.getParcelableExtra<PendingIntent>("openConvPendingIntent")
        val repliedNotification = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
                .setContentIntent(openConv)
                .setTimeoutAfter(1000)
                .setSmallIcon(R.drawable.ic_notif)
        val notificationManager = NotificationManagerCompat.from(context)
        val messageBody = getMessageText(intent)
        if (messageBody != null) {
            try {
                val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
                    override fun task() {
                        Keybase.handlePostTextReply(convData.convID, convData.tlfName, convData.lastMsgId, messageBody)
                    }
                }
                withBackgroundActive.whileActive(context)
                repliedNotification.setContentText("Replied")
            } catch (e: Exception) {
                repliedNotification.setContentText("Couldn't send reply")
                NativeLogger.error("Failed to send quick reply", e)
            }
        } else {
            repliedNotification.setContentText("Couldn't send reply - Failed to read input.")
            NativeLogger.error("Message Body in quick reply was null")
        }
        notificationManager.notify(convData.convID, 0, repliedNotification.build())
    }

    companion object {
        @JvmField
        var KEY_TEXT_REPLY = "key_text_reply"
    }
}

internal class ConvData {
    @JvmField
    var convID: String?
    var tlfName: String?
    var lastMsgId: Long

    constructor(convId: String?, tlfName: String?, lastMsgId: Long) {
        convID = convId
        this.tlfName = tlfName
        this.lastMsgId = lastMsgId
    }

    constructor(intent: Intent) {
        val data = intent.getBundleExtra("ConvData")
        convID = data!!.getString("convID")
        tlfName = data.getString("tlfName")
        lastMsgId = data.getLong("lastMsgId")
    }

    fun intoIntent(context: Context?): Intent {
        val data = Bundle()
        data.putString("convID", convID)
        data.putString("tlfName", tlfName)
        data.putLong("lastMsgId", lastMsgId)
        val intent = Intent(context, ChatBroadcastReceiver::class.java)
        intent.putExtra("ConvData", data)
        return intent
    }
}
