package io.keybase.ossifrage

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.keybase.ossifrage.MainActivity.Companion.setupKBRuntime
import io.keybase.ossifrage.modules.NativeLogger
import keybase.Keybase
import me.leolin.shortcutbadger.ShortcutBadger
import org.json.JSONArray
import org.json.JSONObject
import android.util.Log

class KeybasePushNotificationListenerService : FirebaseMessagingService() {
    // This keeps a small ring buffer cache of the last 5 messages per conversation the user
    // was notified about to give context to future notifications.
    private val msgCache = HashMap<String?, SmallMsgRingBuffer>()

    // Avoid ever showing doubles
    private val seenChatNotifications = HashSet<String>()
    private fun buildStyle(convID: String, person: Person): NotificationCompat.Style {
        val style = NotificationCompat.MessagingStyle(person)
        val buf = msgCache[convID]
        if (buf != null) {
            for (msg in buf.summary()) {
                style.addMessage(msg)
            }
        }
        return style
    }

    override fun onCreate() {
        setupKBRuntime(this, false)
        NativeLogger.info("KeybasePushNotificationListenerService created")
        createNotificationChannel(this)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val bundle = Bundle()
        for ((key, value) in message.data) {
            bundle.putString(key, value)
        }
        val data = parseJSONObject(bundle.getString("data"))
        if (data != null) {
            if (!bundle.containsKey("message")) {
                bundle.putString("message", data.optString("alert", ""))
            }
            if (!bundle.containsKey("title")) {
                bundle.putString("title", data.optString("title", ""))
            }
            if (!bundle.containsKey("sound")) {
                bundle.putString("soundName", data.optString("sound", ""))
            }
            if (!bundle.containsKey("color")) {
                bundle.putString("color", data.optString("color", ""))
            }
            val badge = data.optInt("badge", -1)
            if (badge >= 0) {
                ShortcutBadger.applyCount(this, badge)
            }
        }
        NativeLogger.info("KeybasePushNotificationListenerService.onMessageReceived")
        try {
            val type = bundle.getString("type")
            val payload = bundle.getString("m")
            val notifier = KBPushNotifier(applicationContext, bundle.clone() as Bundle)
            when (type) {
                "chat.newmessage", "chat.newmessageSilent_2" -> {
                    val n = NotificationData(type, bundle)

                    // Blow the cache if we aren't displaying plaintext
                    if (!msgCache.containsKey(n.convID) || !n.displayPlaintext) {
                        msgCache[n.convID] = SmallMsgRingBuffer()
                    }

                    // We've shown this notification already
                    if (seenChatNotifications.contains(n.convID + n.messageId)) {
                        return
                    }

                    // If we aren't displaying the plain text version in a silent notif drop this.
                    // We'll get the non-silent version with a servermessagebody that we can display
                    // later.
                    val dontNotify = type == "chat.newmessageSilent_2" && !n.displayPlaintext
                    notifier.setMsgCache(msgCache[n.convID])

                    val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
                        override fun task() {
                            try {
                                Keybase.handleBackgroundNotification(n.convID, payload, n.serverMessageBody, n.sender,
                                        n.membersType.toLong(), n.displayPlaintext, n.messageId.toLong(), n.pushId,
                                        n.badgeCount.toLong(), n.unixTime, n.soundName, if (dontNotify) null else notifier, true)
                                if (!dontNotify) {
                                    seenChatNotifications.add(n.convID + n.messageId)
                                }
                            } catch (ex: Exception) {
                                NativeLogger.error("Go Couldn't handle background notification2: " + ex.message)
                            }
                        }
                    }
                    withBackgroundActive.whileActive(applicationContext)
                }

                "follow" -> {
                    val username = bundle.getString("username")
                    val m = bundle.getString("message")
                    if (username != null && m != null) {
                        notifier.followNotification(username, m)
                    }
                }

                "device.revoked", "device.new" -> {
                    notifier.deviceNotification()
                }

                "chat.readmessage" -> {
                    val convID = bundle.getString("c")
                    // Clear the cache of msgs for this conv id
                    if (msgCache.containsKey(convID)) {
                        msgCache[convID] = SmallMsgRingBuffer()
                    }
                    // Cancel any push notifications.
                    val notificationManager = NotificationManagerCompat.from(applicationContext)
                    notificationManager.cancelAll()
                }

                else -> notifier.generalNotification()
            }
        } catch (ex: Exception) {
            NativeLogger.error("Couldn't handle background notification: " + ex.message)
        }
    }

    private fun parseJSONObject(str: String?): JSONObject? {
        return try {
            if (str != null) {
                return JSONObject(str)
            } else {
                return null
            }
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        @JvmField
        var CHAT_CHANNEL_ID = "kb_chat_channel"
        @JvmField
        var FOLLOW_CHANNEL_ID = "kb_follow_channel"
        @JvmField
        var DEVICE_CHANNEL_ID = "kb_device_channel"
        @JvmField
        var GENERAL_CHANNEL_ID = "kb_rest_channel"
        fun createNotificationChannel(context: Context) {
            // Create the NotificationChannel, but only on API 26+ because
            // the NotificationChannel class is new and not in the support library
            // Safe to call this multiple times - no ops afterwards
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val notificationManager = context.getSystemService(NotificationManager::class.java)
                if (notificationManager.getNotificationChannel("keybase_all") != null) {
                    notificationManager.deleteNotificationChannel("keybase_all")
                }

                // Chat Notifications
                run {
                    val name: CharSequence = context.getString(R.string.channel_name)
                    val description = context.getString(R.string.channel_description)
                    val importance = NotificationManager.IMPORTANCE_HIGH
                    val chat_channel = NotificationChannel(CHAT_CHANNEL_ID, name, importance)
                    chat_channel.description = description
                    // Register the channel with the system; you can't change the importance
                    // or other notification behaviors after this
                    notificationManager.createNotificationChannel(chat_channel)
                }


                // Follow Notifications
                run {
                    val follow_name: CharSequence = context.getString(R.string.notif_follows_name)
                    val follow_description = context.getString(R.string.notif_follow_desc)
                    val follow_importance = NotificationManager.IMPORTANCE_DEFAULT
                    val follow_channel = NotificationChannel(FOLLOW_CHANNEL_ID, follow_name, follow_importance)
                    follow_channel.description = follow_description
                    notificationManager.createNotificationChannel(follow_channel)
                }

                // Device Notifications
                run {
                    val device_name: CharSequence = context.getString(R.string.notif_devices_name)
                    val device_description = context.getString(R.string.notif_device_description)
                    val device_importance = NotificationManager.IMPORTANCE_HIGH
                    val device_channel = NotificationChannel(DEVICE_CHANNEL_ID, device_name, device_importance)
                    device_channel.description = device_description
                    notificationManager.createNotificationChannel(device_channel)
                }

                // The rest of the notifications
                run {
                    val general_name: CharSequence = context.getString(R.string.general_channel_name)
                    val general_description = context.getString(R.string.general_channel_description)
                    val general_importance = NotificationManager.IMPORTANCE_LOW
                    val general_channel = NotificationChannel(GENERAL_CHANNEL_ID, general_name, general_importance)
                    general_channel.description = general_description
                    notificationManager.createNotificationChannel(general_channel)
                }
            }
        }
    }
}

class SmallMsgRingBuffer {
    private val buffer = ArrayList<NotificationCompat.MessagingStyle.Message>()
    fun add(m: NotificationCompat.MessagingStyle.Message) {
        while (buffer.size > 4) {
            buffer.removeAt(0)
        }
        buffer.add(m)
    }

    fun summary(): List<NotificationCompat.MessagingStyle.Message> {
        return buffer
    }
}

internal class NotificationData @RequiresApi(api = Build.VERSION_CODES.HONEYCOMB_MR1) constructor(type: String, bundle: Bundle) {
    val displayPlaintext: Boolean
    val membersType: Int
    var convID: String? = null
    var messageId = 0
    var pushId: String? = null
    val badgeCount: Int
    val unixTime: Long
    val soundName: String
    val serverMessageBody: String
    val sender: String

    // Derived from go/gregord/chatpush/push.go
    init {
        displayPlaintext = "true" == bundle.getString("n")
        membersType = bundle.getString("t")!!.toInt()
        badgeCount = bundle.getString("b", "0").toInt()
        soundName = bundle.getString("s", "")
        serverMessageBody = bundle.getString("message", "")
        sender = bundle.getString("u", "")
        unixTime = bundle.getString("x", "0").toLong()
        if (type == "chat.newmessage") {
            messageId = bundle.getString("msgID", "0").toInt()
            convID = bundle.getString("convID")
            pushId = ""
        } else if (type == "chat.newmessageSilent_2") {
            messageId = bundle.getString("d", "").toInt()
            convID = bundle.getString("c")
            var pushIdTmp = ""
            try {
                val pushes = JSONArray(bundle.getString("p"))
                pushIdTmp = pushes.getString(0)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            pushId = pushIdTmp
        } else {
            throw Error("Tried to parse notification of unhandled type: $type")
        }
    }
}

// Interface to run some task while in backgroundActive.
// If already foreground, ignore
internal interface WithBackgroundActive {
    @Throws(Exception::class)
    fun task()

    @Throws(Exception::class)
    fun whileActive(context: Context?) {
        // We are foreground don't show anything
        if (Keybase.isAppStateForeground()) {
            return
        } else {
            Keybase.setAppStateBackgroundActive()
            task()

            // Check if we are foreground now for some reason. In that case we don't want to go background again
            if (Keybase.isAppStateForeground()) {
                return
            }
            if (Keybase.appDidEnterBackground()) {
                if (context != null) {
                    Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
                }
            } else {
                Keybase.setAppStateBackground()
            }
        }
    }
}
