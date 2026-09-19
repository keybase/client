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
                val lifecycleReporter = (context.applicationContext as MainApplication).lifecycleReporter
                lifecycleReporter.reportHeadlessStart()
                // Go's push window must see the state after the process start
                // or stop that came before this reply.
                lifecycleReporter.awaitReported(2000)
                sendQuickReply({ msg, e -> NativeLogger.error(msg, e) }) {
                    Keybase.handlePostTextReply(convData.convID, convData.tlfName, convData.lastMsgId, messageBody,
                            KBPushNotifier(context, Bundle()))
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
