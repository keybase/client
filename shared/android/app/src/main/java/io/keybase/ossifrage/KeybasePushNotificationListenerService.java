package io.keybase.ossifrage;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationCompat.MessagingStyle;
import android.support.v4.app.NotificationManagerCompat;
import android.support.v4.app.Person;

import com.dieam.reactnativepushnotification.helpers.ApplicationBadgeHelper;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.util.DNSNSFetcher;
import io.keybase.ossifrage.util.VideoHelper;
import keybase.Keybase;

import static keybase.Keybase.initOnce;

public class KeybasePushNotificationListenerService extends FirebaseMessagingService {
    public static String CHAT_CHANNEL_ID = "kb_chat_channel";
    public static String FOLLOW_CHANNEL_ID = "kb_follow_channel";
    public static String DEVICE_CHANNEL_ID = "kb_device_channel";
    public static String GENERAL_CHANNEL_ID = "kb_rest_channel";

    // This keeps a small ring buffer cache of the last 5 messages per conversation the user
    // was notified about to give context to future notifications.
    private HashMap<String, SmallMsgRingBuffer> msgCache = new HashMap<String, SmallMsgRingBuffer>();

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

    private void cacheMsg(String convID, MessagingStyle.Message msg) {
        SmallMsgRingBuffer buf = msgCache.get(convID);
        if (buf != null) {
            buf.add(msg);
        } else {
            buf = new SmallMsgRingBuffer();
            buf.add(msg);
            msgCache.put(convID, buf);
        }
    }


    @Override
    public void onCreate() {
        try {
            Keybase.setGlobalExternalKeyStore(new KeyStore(getApplicationContext(), getSharedPreferences("KeyStore", MODE_PRIVATE)));
        } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
            NativeLogger.error("Exception in KeybasePushNotificationListenerService.onCreate while trying to link the Android KeyStore to go bind", e);
        }
        String mobileOsVersion = Integer.toString(android.os.Build.VERSION.SDK_INT);
        initOnce(getApplicationContext().getFilesDir().getPath(), "", getApplicationContext().getFileStreamPath("service.log").getAbsolutePath(), "prod", false,
          new DNSNSFetcher(), new VideoHelper(), mobileOsVersion);
        NativeLogger.info("KeybasePushNotificationListenerService created. path: " + getApplicationContext().getFilesDir().getPath());

        createNotificationChannel(this);

    }


    public static void createNotificationChannel(Context context) {
        // Create the NotificationChannel, but only on API 26+ because
        // the NotificationChannel class is new and not in the support library
        // Safe to call this multiple times - no ops afterwards
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);

            // Chat Notifications
            {
                CharSequence name = context.getString(R.string.channel_name);
                String description = context.getString(R.string.channel_description);
                int importance = NotificationManager.IMPORTANCE_DEFAULT;
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
                ApplicationBadgeHelper.INSTANCE.setApplicationIconBadgeNumber(this, badge);
            }
        }

        NativeLogger.info("KeybasePushNotificationListenerService.onMessageReceived: " + bundle);

        try {
            String type = bundle.getString("type");
            String payload = bundle.getString("m");
            KBPushNotifier notifier = new KBPushNotifier(getApplicationContext(), bundle);
            switch (type) {
                case "chat.newmessageSilent_2": {
                    boolean displayPlaintext = "true".equals(bundle.getString("n"));
                    int membersType = Integer.parseInt(bundle.getString("t"));
                    String convID = bundle.getString("c");
                    int messageId = Integer.parseInt(bundle.getString("d"));
                    JSONArray pushes = parseJSONArray(bundle.getString("p"));
                    String pushId = pushes.getString(0);
                    int badgeCount = Integer.parseInt(bundle.getString("b"));
                    int unixTime = Integer.parseInt(bundle.getString("x"));
                    String soundName = bundle.getString("s");

                    // Blow the cache if we aren't displaying plaintext
                    if (!msgCache.containsKey(convID) || !displayPlaintext) {
                        msgCache.put(convID, new SmallMsgRingBuffer());
                    }
                    notifier.setMsgCache(msgCache.get(convID));

                    Keybase.handleBackgroundNotification(convID, payload, membersType, displayPlaintext, messageId, pushId, badgeCount, unixTime, soundName, notifier);
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
                    // Cancel any push notifications.
                    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getApplicationContext());
                    notificationManager.cancelAll();
                }
                break;
                case "chat.newmessage": {
                  // Ignore this
                  // We are just using chat.newmessageSilent_2
                }
                break;
                default:
                    notifier.generalNotification();
            }
        } catch (JSONException jex) {
            NativeLogger.error("Couldn't parse json: " + jex.getMessage());
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

    private JSONArray parseJSONArray(String str) {
        try {
            return new JSONArray(str);
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
