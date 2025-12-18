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

                    // We've shown this notification already
                    if (seenChatNotifications.contains(n.convID + n.messageId)) {
                        return
                    }

                    // If we aren't displaying the plain text version in a silent notif drop this.
                    // We'll get the non-silent version with a servermessagebody that we can display
                    // later.
                    val dontNotify = type == "chat.newmessageSilent_2" && !n.displayPlaintext
                    NativeLogger.info("KeybasePushNotificationListenerService dontNotify: $dontNotify, type: $type, displayPlaintext: ${n.displayPlaintext}")
                    NativeLogger.info("KeybasePushNotificationListenerService convID: ${n.convID}, messageId: ${n.messageId}")
                    notifier.setMsgCache(msgCache[n.convID])

                    var goProcessingSucceeded = false
                    try {
                        NativeLogger.info("KeybasePushNotificationListenerService calling withBackgroundActive.whileActive")
                        val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
                            override fun task() {
                                try {
                                    NativeLogger.info("KeybasePushNotificationListenerService calling Keybase.handleBackgroundNotification")
                                    Keybase.handleBackgroundNotification(n.convID, payload, n.serverMessageBody, n.sender,
                                            n.membersType.toLong(), n.displayPlaintext, n.messageId.toLong(), n.pushId,
                                            n.badgeCount.toLong(), n.unixTime, n.soundName, if (dontNotify) null else notifier, true)
                                    NativeLogger.info("KeybasePushNotificationListenerService Keybase.handleBackgroundNotification succeeded")
                                    goProcessingSucceeded = true
                                    if (!dontNotify) {
                                        seenChatNotifications.add(n.convID + n.messageId)
                                    }
                                } catch (ex: Exception) {
                                    NativeLogger.error("Go Couldn't handle background notification2: " + ex.message)
                                    NativeLogger.error("Go exception stack: " + ex.stackTraceToString())
                                    throw ex
                                }
                            }
                        }
                        withBackgroundActive.whileActive(applicationContext)
                        NativeLogger.info("KeybasePushNotificationListenerService withBackgroundActive.whileActive completed")
                    } catch (ex: Exception) {
                        NativeLogger.error("Failed to process notification (app may not be running): " + ex.message)
                        NativeLogger.error("Exception stack: " + ex.stackTraceToString())
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
                        NativeLogger.info("KeybasePushNotificationListenerService app is foreground, skipping notification display")
                    } else if (dontNotify && (!goProcessingSucceeded || !isReactNativeRunning)) {
                        NativeLogger.info("KeybasePushNotificationListenerService silent notification but React Native not running or Go failed, displaying fallback")
                        NativeLogger.info("KeybasePushNotificationListenerService serverMessageBody: '${n.serverMessageBody}', sender: '${n.sender}'")
                        try {
                            val chatNotif = keybase.ChatNotification()
                            chatNotif.convID = n.convID
                            
                            val message = keybase.Message()
                            val serverMsg = if (n.serverMessageBody.isNotEmpty()) {
                                n.serverMessageBody
                            } else {
                                if (n.sender != null && n.sender.isNotEmpty()) {
                                    "New message from ${n.sender}"
                                } else {
                                    "New message"
                                }
                            }
                            message.serverMessage = serverMsg
                            message.at = n.unixTime
                            message.id = n.messageId.toLong()
                            
                            val person = keybase.Person()
                            person.keybaseUsername = n.sender ?: ""
                            message.from = person
                            
                            chatNotif.message = message
                            chatNotif.isPlaintext = false
                            chatNotif.soundName = n.soundName ?: "default"
                            chatNotif.conversationName = ""
                            chatNotif.isGroupConversation = false
                            chatNotif.tlfName = ""
                            
                            NativeLogger.info("KeybasePushNotificationListenerService calling notifier.displayChatNotification for silent fallback with message: '$serverMsg'")
                            notifier.displayChatNotification(chatNotif)
                            seenChatNotifications.add(n.convID + n.messageId)
                            NativeLogger.info("KeybasePushNotificationListenerService silent fallback notification displayed successfully")
                        } catch (e: Exception) {
                            NativeLogger.error("Failed to display silent notification fallback: " + e.message)
                            NativeLogger.error("Silent fallback exception stack: " + e.stackTraceToString())
                        }
                    } else if (!isForeground && (!goProcessingSucceeded || !isReactNativeRunning) && type == "chat.newmessage") {
                        NativeLogger.info("KeybasePushNotificationListenerService goProcessingSucceeded: $goProcessingSucceeded, isReactNativeRunning: $isReactNativeRunning")
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
                            
                            NativeLogger.info("KeybasePushNotificationListenerService calling notifier.displayChatNotification with message: '${n.serverMessageBody}'")
                            notifier.displayChatNotification(chatNotif)
                            seenChatNotifications.add(n.convID + n.messageId)
                            NativeLogger.info("KeybasePushNotificationListenerService fallback notification displayed successfully")
                        } catch (e: Exception) {
                            NativeLogger.error("Failed to display notification fallback: " + e.message)
                            NativeLogger.error("Fallback exception stack: " + e.stackTraceToString())
                        }
                    } else if (dontNotify) {
                        NativeLogger.info("KeybasePushNotificationListenerService silent notification processed by Go, no display needed")
                    }

                    if (type == "chat.newmessage") {
                        NativeLogger.info("KeybasePushNotificationListenerService emitting onPushNotification event")
                        val emitBundle = bundle.clone() as Bundle
                        emitBundle.putBoolean("userInteraction", false)
                        KbModule.emitPushNotification(emitBundle)
                    }
                }

                "follow" -> {
                    NativeLogger.info("KeybasePushNotificationListenerService processing follow notification")
                    val username = bundle.getString("username")
                    val m = bundle.getString("message")
                    if (username != null && m != null) {
                        NativeLogger.info("KeybasePushNotificationListenerService displaying follow notification for: $username")
                        notifier.followNotification(username, m)
                        val emitBundle = bundle.clone() as Bundle
                        emitBundle.putBoolean("userInteraction", false)
                        KbModule.emitPushNotification(emitBundle)
                    } else {
                        NativeLogger.error("KeybasePushNotificationListenerService follow notification missing username or message")
                    }
                }

                "device.revoked", "device.new" -> {
                    NativeLogger.info("KeybasePushNotificationListenerService processing device notification: $type")
                    notifier.deviceNotification()
                    val emitBundle = bundle.clone() as Bundle
                    emitBundle.putBoolean("userInteraction", false)
                    KbModule.emitPushNotification(emitBundle)
                }

                "chat.readmessage" -> {
                    NativeLogger.info("KeybasePushNotificationListenerService processing readmessage notification")
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
                    NativeLogger.info("KeybasePushNotificationListenerService processing general notification: $type")
                    notifier.generalNotification()
                    val emitBundle = bundle.clone() as Bundle
                    emitBundle.putBoolean("userInteraction", false)
                    KbModule.emitPushNotification(emitBundle)
                }
            }
            NativeLogger.info("KeybasePushNotificationListenerService.onMessageReceived END successfully")
        } catch (ex: Exception) {
            NativeLogger.error("Couldn't handle background notification: " + ex.message)
            NativeLogger.error("Exception stack: " + ex.stackTraceToString())
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
