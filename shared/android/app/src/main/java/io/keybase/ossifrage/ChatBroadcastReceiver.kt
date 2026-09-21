package io.keybase.ossifrage

import android.app.PendingIntent
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import io.keybase.ossifrage.MainActivity.Companion.setupKBRuntime
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase

class ChatBroadcastReceiver : BroadcastReceiver() {
    private fun getMessageText(intent: Intent): String? {
        val remoteInput = RemoteInput.getResultsFromIntent(intent)
        return remoteInput?.getCharSequence(KEY_TEXT_REPLY)?.toString()
    }

    override fun onReceive(context: Context, intent: Intent) {
        val convData = ConvData.fromIntent(intent)
        val openConv = intent.getParcelableExtra<PendingIntent>("openConvPendingIntent")
        val messageBody = getMessageText(intent)
        val pendingResult = goAsync()
        runReceiverWork(RECEIVER_BUDGET_MS, { Thread(it).start() }, { NativeLogger.warn(it) }, { msg, e -> NativeLogger.error(msg, e) },
                { pendingResult.finish() }) {
            val status = if (messageBody == null) {
                NativeLogger.error("Message Body in quick reply was null")
                "Couldn't send reply - Failed to read input."
            } else {
                setupKBRuntime(context, false)
                sendQuickReply({ msg, e -> NativeLogger.error(msg, e) }) {
                    postTextReplyInPushWindow(context, convData, messageBody)
                }
            }
            val repliedNotification = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
                    .setContentIntent(openConv)
                    .setTimeoutAfter(1000)
                    .setSmallIcon(R.drawable.ic_notif)
                    .setContentText(status)
            NotificationManagerCompat.from(context).notify(convData.convID, 0, repliedNotification.build())
        }
    }

    // Transitional: the push window is opened here, for the same reason as
    // WithBackgroundActive -- it goes away once the bind layer wraps the reply in the
    // window itself. Unlike WithBackgroundActive this never skips the send while the app
    // is foreground; a reply typed in the notification shade must go out either way.
    private fun postTextReplyInPushWindow(context: Context, convData: ConvData, messageBody: String) {
        // 0 when the app is active and nothing needs holding up.
        val token = Keybase.appPushWindowBegin()
        try {
            Keybase.handlePostTextReply(convData.convID, convData.tlfName, convData.lastMsgId, messageBody)
        } finally {
            if (token > 0) {
                // Hands over to a background task if the UI is still in the background and
                // work must keep going.
                Keybase.appPushWindowEnd(token, KBPushNotifier(context, Bundle()))
            }
        }
    }

    companion object {
        const val KEY_TEXT_REPLY = "key_text_reply"

        // goAsync gives a broadcast 10s; leave margin.
        private const val RECEIVER_BUDGET_MS = 9_000L
    }
}

internal data class ConvData(
    @JvmField val convID: String?,
    val tlfName: String?,
    val lastMsgId: Long
) {
    fun intoIntent(context: Context?): Intent {
        val data = Bundle()
        data.putString("convID", convID)
        data.putString("tlfName", tlfName)
        data.putLong("lastMsgId", lastMsgId)
        val intent = Intent(context, ChatBroadcastReceiver::class.java)
        intent.putExtra("ConvData", data)
        return intent
    }

    companion object {
        fun fromIntent(intent: Intent): ConvData {
            val data = intent.getBundleExtra("ConvData")!!
            return ConvData(
                convID = data.getString("convID"),
                tlfName = data.getString("tlfName"),
                lastMsgId = data.getLong("lastMsgId")
            )
        }
    }
}
