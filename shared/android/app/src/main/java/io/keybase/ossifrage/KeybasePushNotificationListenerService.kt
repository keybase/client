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
import keybase.ChatNotification
import me.leolin.shortcutbadger.ShortcutBadger
import com.reactnativekb.KbModule
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
        NativeLogger.info("KeybasePushNotificationListenerService.onMessageReceived START")
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
        try {
            val type = bundle.getString("type")
            NativeLogger.info("KeybasePushNotificationListenerService.onMessageReceived type: $type")
            val payload = bundle.getString("m")
            val notifier = KBPushNotifier(applicationContext, bundle.clone() as Bundle)
            when (type) {
                "chat.newmessage", "chat.newmessageSilent_2" -> {
                    NativeLogger.info("KeybasePushNotificationListenerService processing chat notification")
                    val n = NotificationData(type, bundle)

                    // Blow the cache if we aren't displaying plaintext
                    if (!msgCache.containsKey(n.convID) || !n.displayPlaintext) {
                        msgCache[n.convID] = SmallMsgRingBuffer()
                    }

                    // Silent notifications should never display - we'll get the non-silent version
                    // (chat.newmessage) with a servermessagebody that we can display later.
                    val dontNotify = type == "chat.newmessageSilent_2"

                    // Only check for duplicates on non-silent notifications that will be displayed
                    // Silent notifications are processed but not marked as seen, allowing the non-silent one to display
                    if (!dontNotify) {
                        val notificationKey = n.convID + n.messageId
                        if (seenChatNotifications.contains(notificationKey)) {
                            NativeLogger.info("KeybasePushNotificationListenerService skipping duplicate notification: $notificationKey")
                            return
                        }
                        // Mark as seen immediately to prevent duplicate processing
                        seenChatNotifications.add(notificationKey)
                        NativeLogger.info("KeybasePushNotificationListenerService marked notification as seen: $notificationKey")
                    }

                    notifier.setMsgCache(msgCache[n.convID])

                    var goProcessingSucceeded = false
                    try {
                        val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
                            override fun task() {
                                try {
                                    Keybase.handleBackgroundNotification(n.convID, payload, n.serverMessageBody, n.sender,
                                            n.membersType.toLong(), n.displayPlaintext, n.messageId.toLong(), n.pushId,
                                            n.badgeCount.toLong(), n.unixTime, n.soundName, if (dontNotify) null else notifier, true)
                                    goProcessingSucceeded = true
                                    if (!dontNotify) {
                                        seenChatNotifications.add(n.convID + n.messageId)
                                    }
                                } catch (ex: Exception) {
                                    NativeLogger.error("Go Couldn't handle background notification2: " + ex.message)
                                    throw ex
                                }
                            }
                        }
                        withBackgroundActive.whileActive(applicationContext)
                    } catch (ex: Exception) {
                        NativeLogger.error("Failed to process notification (app may not be running): " + ex.message)
                        goProcessingSucceeded = false
                    }

                    val isReactNativeRunning = try {
                        com.reactnativekb.KbModule.isReactNativeRunning()
                    } catch (e: Exception) {
                        NativeLogger.info("KeybasePushNotificationListenerService couldn't check if React Native is running: ${e.message}, assuming not")
                        false
                    }
                    NativeLogger.info("KeybasePushNotificationListenerService isReactNativeRunning: $isReactNativeRunning")

                    val isForeground = try {
                        Keybase.isAppStateForeground()
                    } catch (e: Exception) {
                        NativeLogger.info("KeybasePushNotificationListenerService couldn't check if app is foreground: ${e.message}, assuming background")
                        false
                    }
                    NativeLogger.info("KeybasePushNotificationListenerService isForeground: $isForeground")

                    // Don't show notifications if app is foreground - user is already looking at the app
                    if (isForeground) {

                    } else if (dontNotify) {
                        // Silent notifications should never display - they're processed by Go but no notification shown
                    } else if (!goProcessingSucceeded && type == "chat.newmessage") {
                        // Only show fallback if Go processing failed AND it's a non-silent notification
                        // If Go succeeded, it already displayed the notification (via notifier parameter)
                        NativeLogger.info("KeybasePushNotificationListenerService attempting fallback notification display")
                        try {
                            val chatNotif = keybase.ChatNotification()
                            chatNotif.convID = n.convID

                            val message = keybase.Message()
                            message.serverMessage = n.serverMessageBody
                            message.at = n.unixTime
                            message.id = n.messageId.toLong()

                            val person = keybase.Person()
                            person.keybaseUsername = n.sender ?: ""
                            message.from = person

                            chatNotif.message = message
                            chatNotif.isPlaintext = n.displayPlaintext
                            chatNotif.soundName = n.soundName ?: "default"
                            chatNotif.conversationName = ""
                            chatNotif.isGroupConversation = false
                            chatNotif.tlfName = ""

                            notifier.displayChatNotification(chatNotif)
                            seenChatNotifications.add(n.convID + n.messageId)
                            NativeLogger.info("KeybasePushNotificationListenerService fallback notification displayed successfully")
                        } catch (e: Exception) {
                            NativeLogger.error("Failed to display notification fallback: " + e.message)
                        }
                    } else if (dontNotify) {

                    }

                    if (type == "chat.newmessage") {
                        val emitBundle = bundle.clone() as Bundle
                        emitBundle.putBoolean("userInteraction", false)
                        KbModule.emitPushNotification(emitBundle)
                    }
                }

                "follow" -> {
                    val username = bundle.getString("username")
                    val m = bundle.getString("message")
                    if (username != null && m != null) {
                        notifier.followNotification(username, m)
                        val emitBundle = bundle.clone() as Bundle
                        emitBundle.putBoolean("userInteraction", false)
                        KbModule.emitPushNotification(emitBundle)
                    } else {
                    }
                }

                "device.revoked", "device.new" -> {
                    notifier.deviceNotification()
                    val emitBundle = bundle.clone() as Bundle
                    emitBundle.putBoolean("userInteraction", false)
                    KbModule.emitPushNotification(emitBundle)
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
                    val emitBundle = bundle.clone() as Bundle
                    KbModule.emitPushNotification(emitBundle)
                }

                else -> {
                    notifier.generalNotification()
                    val emitBundle = bundle.clone() as Bundle
                    emitBundle.putBoolean("userInteraction", false)
                    KbModule.emitPushNotification(emitBundle)
                }
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
        membersType = bundle.getString("t")?.toIntOrNull() ?: 0
        badgeCount = bundle.getString("b", "0").toIntOrNull() ?: 0
        soundName = bundle.getString("s", "")
        serverMessageBody = bundle.getString("message", "")
        sender = bundle.getString("u", "")
        unixTime = bundle.getString("x", "0").toLongOrNull() ?: 0
        if (type == "chat.newmessage") {
            messageId = bundle.getString("msgID", "0").toIntOrNull() ?: 0
            convID = bundle.getString("convID")
            pushId = ""
        } else if (type == "chat.newmessageSilent_2") {
            messageId = bundle.getString("d", "").toIntOrNull() ?: 0
            convID = bundle.getString("c")
            val pushId: String = try {
                bundle.getString("p")?.let { JSONArray(it).getString(0) } ?: ""
            } catch (e: Exception) {
                ""
            }
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
        try {
            // We are foreground don't show anything
            val isForeground = Keybase.isAppStateForeground()
            NativeLogger.info("WithBackgroundActive.whileActive isForeground: $isForeground")
            if (isForeground) {
                NativeLogger.info("WithBackgroundActive.whileActive app is foreground, returning early")
                return
            } else {
                NativeLogger.info("WithBackgroundActive.whileActive setting background active and calling task")
                Keybase.setAppStateBackgroundActive()
                task()
                NativeLogger.info("WithBackgroundActive.whileActive task completed")

                // Check if we are foreground now for some reason. In that case we don't want to go background again
                val isForegroundNow = Keybase.isAppStateForeground()
                NativeLogger.info("WithBackgroundActive.whileActive isForegroundNow: $isForegroundNow")
                if (isForegroundNow) {
                    NativeLogger.info("WithBackgroundActive.whileActive app became foreground, returning")
                    return
                }
                val didEnterBackground = Keybase.appDidEnterBackground()
                NativeLogger.info("WithBackgroundActive.whileActive didEnterBackground: $didEnterBackground")
                if (didEnterBackground) {
                    if (context != null) {
                        NativeLogger.info("WithBackgroundActive.whileActive beginning background task")
                        Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
                    }
                } else {
                    NativeLogger.info("WithBackgroundActive.whileActive setting app state to background")
                    Keybase.setAppStateBackground()
                }
            }
        } catch (ex: Exception) {
            NativeLogger.error("WithBackgroundActive.whileActive exception: " + ex.message)
            NativeLogger.error("WithBackgroundActive exception stack: " + ex.stackTraceToString())
            throw ex
        }
    }
}
