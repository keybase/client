package io.keybase.ossifrage;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationCompat.MessagingStyle;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import me.leolin.shortcutbadger.ShortcutBadger;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import io.keybase.ossifrage.modules.NativeLogger;
import keybase.Keybase;

public class KeybasePushNotificationListenerService extends FirebaseMessagingService {
    public static String CHAT_CHANNEL_ID = "kb_chat_channel";
    public static String FOLLOW_CHANNEL_ID = "kb_follow_channel";
    public static String DEVICE_CHANNEL_ID = "kb_device_channel";
    public static String GENERAL_CHANNEL_ID = "kb_rest_channel";

    // This keeps a small ring buffer cache of the last 5 messages per conversation the user
    // was notified about to give context to future notifications.
    private HashMap<String, SmallMsgRingBuffer> msgCache = new HashMap<String, SmallMsgRingBuffer>();
    // Avoid ever showing doubles
    private HashSet<String> seenChatNotifications = new HashSet<String>();

    private NotificationCompat.Style buildStyle(String convID, Person person) {
        MessagingStyle style = new MessagingStyle(person);
        SmallMsgRingBuffer buf = msgCache.get(convID);
        if (buf != null) {
            for (MessagingStyle.Message msg: buf.summary()) {
                style.addMessage(msg);
            }
        }

        return style;
    }

    @Override
    public void onCreate() {
        MainActivity.setupKBRuntime(this, false);
        NativeLogger.info("KeybasePushNotificationListenerService created");
        createNotificationChannel(this);
    }


    public static void createNotificationChannel(Context context) {
        // Create the NotificationChannel, but only on API 26+ because
        // the NotificationChannel class is new and not in the support library
        // Safe to call this multiple times - no ops afterwards
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);

            if (notificationManager.getNotificationChannel("keybase_all") != null) {
                notificationManager.deleteNotificationChannel("keybase_all");
            }

            // Chat Notifications
            {
                CharSequence name = context.getString(R.string.channel_name);
                String description = context.getString(R.string.channel_description);
                int importance = NotificationManager.IMPORTANCE_HIGH;
                NotificationChannel chat_channel = new NotificationChannel(CHAT_CHANNEL_ID, name, importance);
                chat_channel.setDescription(description);
                // Register the channel with the system; you can't change the importance
                // or other notification behaviors after this
                notificationManager.createNotificationChannel(chat_channel);
            }


            // Follow Notifications
            {
                CharSequence follow_name = context.getString(R.string.notif_follows_name);
                String follow_description = context.getString(R.string.notif_follow_desc);
                int follow_importance = NotificationManager.IMPORTANCE_DEFAULT;
                NotificationChannel follow_channel = new NotificationChannel(FOLLOW_CHANNEL_ID, follow_name, follow_importance);
                follow_channel.setDescription(follow_description);
                notificationManager.createNotificationChannel(follow_channel);
            }

            // Device Notifications
            {
                CharSequence device_name = context.getString(R.string.notif_devices_name);
                String device_description = context.getString(R.string.notif_device_description);
                int device_importance = NotificationManager.IMPORTANCE_HIGH;
                NotificationChannel device_channel = new NotificationChannel(DEVICE_CHANNEL_ID, device_name, device_importance);
                device_channel.setDescription(device_description);
                notificationManager.createNotificationChannel(device_channel);
            }

            // The rest of the notifications
            {
                CharSequence general_name = context.getString(R.string.general_channel_name);
                String general_description = context.getString(R.string.general_channel_description);
                int general_importance = NotificationManager.IMPORTANCE_LOW;
                NotificationChannel general_channel = new NotificationChannel(GENERAL_CHANNEL_ID, general_name, general_importance);
                general_channel.setDescription(general_description);
                notificationManager.createNotificationChannel(general_channel);
            }

        }
    }

    @RequiresApi(api = Build.VERSION_CODES.HONEYCOMB_MR1)
    @Override
    public void onMessageReceived(RemoteMessage message) {
        final Bundle bundle = new Bundle();
        for (Map.Entry<String, String> entry : message.getData().entrySet()) {
            bundle.putString(entry.getKey(), entry.getValue());
        }
        JSONObject data = parseJSONObject(bundle.getString("data"));
        if (data != null) {
            if (!bundle.containsKey("message")) {
                bundle.putString("message", data.optString("alert", null));
            }
            if (!bundle.containsKey("title")) {
                bundle.putString("title", data.optString("title", null));
            }
            if (!bundle.containsKey("sound")) {
                bundle.putString("soundName", data.optString("sound", null));
            }
            if (!bundle.containsKey("color")) {
                bundle.putString("color", data.optString("color", null));
            }

            final int badge = data.optInt("badge", -1);
            if (badge >= 0) {
                ShortcutBadger.applyCount(this, badge);
            }
        }

        NativeLogger.info("KeybasePushNotificationListenerService.onMessageReceived");

        try {
            String type = bundle.getString("type");
            String payload = bundle.getString("m");
            KBPushNotifier notifier = new KBPushNotifier(getApplicationContext(), bundle);
            switch (type) {
                case "chat.newmessage":
                case "chat.newmessageSilent_2": {
                    NotificationData n = new NotificationData(type, bundle);

                    // Blow the cache if we aren't displaying plaintext
                    if (!msgCache.containsKey(n.convID) || !n.displayPlaintext) {
                        msgCache.put(n.convID, new SmallMsgRingBuffer());
                    }

                    // We've shown this notification already
                    if (seenChatNotifications.contains(n.convID + n.messageId)) {
                        return;
                    }

                    // If we aren't displaying the plain text version in a silent notif drop this.
                    // We'll get the non-silent version with a servermessagebody that we can display
                    // later.
                    boolean dontNotify = (type.equals("chat.newmessageSilent_2") && !n.displayPlaintext);

                    notifier.setMsgCache(msgCache.get(n.convID));
                    WithBackgroundActive withBackgroundActive = () -> {
                      try {
                          Keybase.handleBackgroundNotification(n.convID, payload, n.serverMessageBody, n.sender,
                            n.membersType, n.displayPlaintext, n.messageId, n.pushId,
                            n.badgeCount, n.unixTime, n.soundName, dontNotify ? null : notifier, true);
                          if (!dontNotify) {
                              seenChatNotifications.add(n.convID + n.messageId);
                          }
                      } catch (Exception ex) {
                        NativeLogger.error("Go Couldn't handle background notification2: " + ex.getMessage());
                      }
                    };
                    withBackgroundActive.whileActive(getApplicationContext());

                }
                break;
                case "follow": {
                    notifier.followNotification(bundle.getString("username"), bundle.getString("message"));
                }
                break;
                case "device.revoked":
                case "device.new": {
                    notifier.deviceNotification();
                }
                break;
                case "chat.readmessage": {
                    String convID = bundle.getString("c");
                    // Clear the cache of msgs for this conv id
                    if (msgCache.containsKey(convID)) {
                        msgCache.put(convID, new SmallMsgRingBuffer());
                    }
                    // Cancel any push notifications.
                    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getApplicationContext());
                    notificationManager.cancelAll();
                }
                break;
                default:
                    notifier.generalNotification();
            }
        } catch (Exception ex) {
            NativeLogger.error("Couldn't handle background notification: " + ex.getMessage());
        }

    }

    private JSONObject parseJSONObject(String str) {
        try {
            return new JSONObject(str);
        } catch (Exception e) {
            return null;
        }
    }

}

class SmallMsgRingBuffer {
    private ArrayList<MessagingStyle.Message> buffer = new ArrayList<MessagingStyle.Message>();

    public void add(MessagingStyle.Message m) {
        while (buffer.size() > 4) {
            buffer.remove(0);
        }
        buffer.add(m);
    }

    public List<MessagingStyle.Message> summary() {
        return buffer;
    }
}

class NotificationData {
    final boolean displayPlaintext;
    final int membersType;
    final String convID;
    final int messageId;
    final String pushId;
    final int badgeCount;
    final long unixTime;
    final String soundName;
    final String serverMessageBody;
    final String sender;

    // Derived from go/gregord/chatpush/push.go
    @RequiresApi(api = Build.VERSION_CODES.HONEYCOMB_MR1)
    NotificationData(String type, Bundle bundle) {
        displayPlaintext = "true".equals(bundle.getString("n"));
        membersType = Integer.parseInt(bundle.getString("t"));
        badgeCount = Integer.parseInt(bundle.getString("b", "0"));
        soundName = bundle.getString("s", "");
        serverMessageBody = bundle.getString("message", "");
        sender = bundle.getString("u", "");
        unixTime = Long.parseLong(bundle.getString("x", "0"));

        if (type.equals("chat.newmessage")) {
            messageId = Integer.parseInt(bundle.getString("msgID", "0"));
            convID = bundle.getString("convID");
            pushId = "";
        } else if (type.equals("chat.newmessageSilent_2"))  {
            messageId = Integer.parseInt(bundle.getString("d", ""));
            convID = bundle.getString("c");

            String pushIdTmp = "";
            try {
                JSONArray pushes = new JSONArray(bundle.getString("p"));
                pushIdTmp = pushes.getString(0);
            } catch (Exception e) {
                e.printStackTrace();
            }
            pushId = pushIdTmp;
        } else {
            throw new Error("Tried to parse notification of unhandled type: " + type );
        }

    }
}

// Interface to run some task while in backgroundActive.
// If already foreground, just runs the task.
interface WithBackgroundActive {
    abstract void task() throws Exception;

    default void whileActive(Context context) throws Exception {
        // We are foreground we don't need to change to background active
        if (Keybase.isAppStateForeground()) {
            this.task();
        } else {
          Keybase.setAppStateBackgroundActive();
          this.task();

          // Check if we are foreground now for some reason. In that case we don't want to go background again
          if (Keybase.isAppStateForeground()) {
              return;
          }

          if (Keybase.appDidEnterBackground()) {
              Keybase.appBeginBackgroundTaskNonblock(new KBPushNotifier(context, new Bundle()));
          } else {
              Keybase.setAppStateBackground();
          }
        }
    }


}
