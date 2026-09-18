package io.keybase.ossifrage
import kotlin.concurrent.thread
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat
import keybase.ChatNotification
import keybase.PushNotifier
import java.io.BufferedInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class KBPushNotifier internal constructor(private val context: Context, private val bundle: Bundle) : PushNotifier {
    private var convMsgCache: SmallMsgRingBuffer? = null
    private fun buildStyle(person: Person): NotificationCompat.MessagingStyle {
        val style = NotificationCompat.MessagingStyle(person)
        convMsgCache?.summary()?.forEach { style.addMessage(it) }
        return style
    }

    fun setMsgCache(convMsgCache: SmallMsgRingBuffer?) {
        this.convMsgCache = convMsgCache
    }

    // A tap goes through PushTapActivity, which hands the push to the service. The payload rides
    // in the extras, and the data is a digest of it: PendingIntent.getActivity hands back an
    // existing PendingIntent for any Intent that filterEquals the new one, and extras are not part
    // of filterEquals, so two notifications with different payloads must differ in the data or the
    // second tap would open the first one's target. A digest rather than the payload itself
    // because a data URI is printed by `dumpsys activity`, where an extra is not. Immutable, so
    // whoever holds this PendingIntent can't substitute another payload.
    //
    // The whole push goes in rather than a projection of it, since which fields matter is the
    // service's business. A push is a few hundred bytes against the ~1MB a Binder transaction
    // allows, but it is the sender who decides how big, so a payload that grows without bound is
    // the thing that would break this.
    private fun tapIntent(bundle: Bundle): Intent =
        Intent(context, PushTapActivity::class.java)
            .setData(Uri.parse("kbpushtap:" + payloadDigest(bundle)))
            .putExtras(bundle)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    private fun payloadDigest(bundle: Bundle): String {
        val digest = MessageDigest.getInstance("SHA-256")
        for (key in bundle.keySet().sorted()) {
            @Suppress("DEPRECATION")
            val value = bundle.get(key)?.toString() ?: ""
            // Length-prefixed so no pair of keys and values can run together into the same digest
            // input as a different pair would.
            digest.update("${key.length}:$key${value.length}:$value".toByteArray())
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun buildPendingIntent(bundle: Bundle): PendingIntent =
        PendingIntent.getActivity(context, 0, tapIntent(bundle), PendingIntent.FLAG_IMMUTABLE)

    private fun getKeybaseAvatar(avatarUri: String): IconCompat? {
        if (avatarUri.isEmpty()) return null

        return try {
            URL(avatarUri).openConnection().run {
                this as HttpURLConnection
                try {
                    BufferedInputStream(inputStream).use { input ->
                        BitmapFactory.decodeStream(input)?.let { bitmap ->
                            IconCompat.createWithBitmap(getCroppedBitmap(bitmap))
                        }
                    }
                } finally {
                    disconnect()
                }
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun newReplyAction(context: Context, convData: ConvData, openConv: PendingIntent): NotificationCompat.Action {
        val replyLabel = "Reply"
        val remoteInput = RemoteInput.Builder(ChatBroadcastReceiver.KEY_TEXT_REPLY)
                .setLabel(replyLabel)
                .build()
        val intent = convData.intoIntent(context)
        intent.putExtra("openConvPendingIntent", openConv)

        // Our pending intent which will be sent to the broadcast receiver
        val replyPendingIntent = PendingIntent.getBroadcast(context,
                convData.convID.hashCode(),
                intent,
                PendingIntent.FLAG_MUTABLE)
        return NotificationCompat.Action.Builder(R.drawable.ic_notif, "Reply", replyPendingIntent)
                .addRemoteInput(remoteInput)
                .build()
    }

    override fun displayChatNotification(chatNotification: ChatNotification) {
        // We need to specify these parameters so that the data returned
        // from the launching intent is processed correctly.
        // https://github.com/keybase/client/blob/95959e12d76612f455ab4a90835debff489eacf4/shared/actions/platform-specific/push.native.js#L363-L381

        // needs to be in the background since we make network calls
        thread(start = true) {
            try {
                displayChatNotification2(chatNotification)
            } catch (e: Exception) {
                io.keybase.ossifrage.modules.NativeLogger.error("KBPushNotifier.displayChatNotification failed: " + e.message)
            }
        }
    }
    private fun displayChatNotification2(chatNotification: ChatNotification) {
        try {
            KeybasePushNotificationListenerService.createNotificationChannel(context)
            bundle.putString("type", "chat.newmessage")
            bundle.putString("convID", chatNotification.convID)
            if (chatNotification.uid.isNotEmpty()) {
                bundle.putString("uid", chatNotification.uid)
            }
            val pending_intent = buildPendingIntent(bundle)
            val convData = ConvData(chatNotification.convID, chatNotification.tlfName ?: "", chatNotification.message.id)
            val builder = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(chatNotification.title ?: "")
                .setContentIntent(pending_intent)
                .setAutoCancel(true)
        var notificationDefaults = NotificationCompat.DEFAULT_LIGHTS or NotificationCompat.DEFAULT_VIBRATE

        // Set notification sound
        if (chatNotification.soundName == "default") {
            notificationDefaults = notificationDefaults or NotificationCompat.DEFAULT_SOUND
        } else {
            val soundResource = filenameResourceName(chatNotification.soundName)
            val soundUriStr = "android.resource://${context.packageName}/raw/$soundResource"
            val soundUri = Uri.parse(soundUriStr)
            builder.setSound(soundUri)
        }
        builder.setDefaults(notificationDefaults)
        builder.addAction(newReplyAction(context, convData, pending_intent))
        val msg = chatNotification.message
        val from = msg.from
        val personBuilder = Person.Builder()
                .setName(from?.keybaseUsername ?: "")
                .setBot(from?.isBot ?: false)
        val avatarUri = chatNotification.message.from?.keybaseAvatar
        avatarUri?.takeIf { it.isNotEmpty() }?.let { getKeybaseAvatar(it) }?.let { personBuilder.setIcon(it) }
        val fromPerson = personBuilder.build()
        convMsgCache?.let { cache ->
            var msgText = if (chatNotification.isPlaintext) chatNotification.message.plaintext else ""
            if (msgText.isEmpty()) {
                msgText = chatNotification.message.serverMessage
            }
            cache.add(NotificationCompat.MessagingStyle.Message(msgText, msg.at, fromPerson))
        }
        val style = buildStyle(fromPerson)
        style.setConversationTitle(chatNotification.conversationName ?: "")
        style.setGroupConversation(chatNotification.isGroupConversation)
        builder.setStyle(style)
        val notificationManager = NotificationManagerCompat.from(context)
        val areNotificationsEnabled = notificationManager.areNotificationsEnabled()
        if (!areNotificationsEnabled) {
            io.keybase.ossifrage.modules.NativeLogger.error("KBPushNotifier.displayChatNotification2 notifications are disabled!")
            return
        }
        if (chatNotification.badgeCount >= 0) {
            builder.setNumber(chatNotification.badgeCount.toInt())
        }
        val notification = builder.build()
        notificationManager.notify(chatNotification.convID, 0, notification)
        } catch (e: Exception) {
            io.keybase.ossifrage.modules.NativeLogger.error("KBPushNotifier.displayChatNotification2 exception: " + e.message)
        }
    }

    // Return the resource name of the specified file (i.e. name and no extension),
    // suitable for use in a resource URI.
    fun filenameResourceName(filename: String): String {
        return if (filename.indexOf(".") >= 0) {
            filename.substring(0, filename.lastIndexOf("."))
        } else {
            // Not all filenames have an extension to be stripped.
            filename
        }
    }

    fun followNotification(username: String, notificationMsg: String?) {
        val bundle = bundle.clone() as Bundle
        bundle.putString("type", "follow")
        bundle.putString("username", username)
        val builder = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.FOLLOW_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("Keybase - New Follower")
                .setContentText(notificationMsg) // Set the intent that will fire when the user taps the notification
                .setContentIntent(buildPendingIntent(bundle))
                .setAutoCancel(true)
        val notificationManager = NotificationManagerCompat.from(context)
        notificationManager.notify("follow:$username", 0, builder.build())
    }

    fun deviceNotification() {
        val bundle = bundle.clone() as Bundle
        genericNotification(bundle.getString("device_id") + bundle.getString("type"), bundle.getString("message"), "", bundle, KeybasePushNotificationListenerService.DEVICE_CHANNEL_ID)
    }

    fun generalNotification() {
        val bundle = bundle.clone() as Bundle
        genericNotification(bundle.getString("device_id") + bundle.getString("type"), bundle.getString("title"), bundle.getString("message"), bundle, KeybasePushNotificationListenerService.GENERAL_CHANNEL_ID)
    }

    fun genericNotification(uniqueTag: String?, notificationTitle: String?, notificationMsg: String?, bundle: Bundle, channelID: String?) {
        val builder = NotificationCompat.Builder(context, channelID!!)
                .setSmallIcon(R.drawable.ic_notif) // Set the intent that will fire when the user taps the notification
                .setContentIntent(buildPendingIntent(bundle))
                .setAutoCancel(true)
        if (!notificationMsg!!.isEmpty()) {
            builder.setContentText(notificationMsg)
        }
        if (!notificationTitle!!.isEmpty()) {
            builder.setContentTitle(notificationTitle)
        }
        val notificationManager = NotificationManagerCompat.from(context)
        notificationManager.notify(uniqueTag, 0, builder.build())
    }

    override fun localNotification(ident: String, title: String, msg: String, badgeCount: Long, soundName: String, convID: String,
                                   typ: String, uid: String) {
        if (uid.isNotEmpty()) {
            bundle.putString("uid", uid)
        }
        genericNotification(ident, title, msg, bundle, KeybasePushNotificationListenerService.GENERAL_CHANNEL_ID)
    }

    companion object {
        // From: https://stackoverflow.com/questions/11932805/cropping-circular-area-from-bitmap-in-android
        private fun getCroppedBitmap(bitmap: Bitmap): Bitmap {
            val output = Bitmap.createBitmap(bitmap.width,
                    bitmap.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val color = -0xbdbdbe
            val paint = Paint()
            val rect = Rect(0, 0, bitmap.width, bitmap.height)
            paint.isAntiAlias = true
            canvas.drawARGB(0, 0, 0, 0)
            paint.color = color
            canvas.drawCircle((bitmap.width / 2).toFloat(), (bitmap.height / 2).toFloat(),
                    (
                            bitmap.width / 2).toFloat(), paint)
            paint.setXfermode(PorterDuffXfermode(PorterDuff.Mode.SRC_IN))
            canvas.drawBitmap(bitmap, rect, rect, paint)
            return output
        }
    }
}
