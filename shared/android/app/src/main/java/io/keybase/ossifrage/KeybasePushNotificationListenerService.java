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
import com.dieam.reactnativepushnotification.modules.RNPushNotificationListenerService;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;
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
import keybase.PushNotifier;

import static keybase.Keybase.initOnce;

public class KeybasePushNotificationListenerService extends RNPushNotificationListenerService {
    public static String CHAT_CHANNEL_ID = "kb_chat_channel";
    public static String GENERAL_CHANNEL_ID = "kb_rest_channel";

    // This keeps a small (5 msg) ring buffer cache of the last messages the user was notified about,
    // so we can give context to future notifications
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
            // Chat Notifications
            CharSequence name = context.getString(R.string.channel_name);
            String description = context.getString(R.string.channel_description);
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel chat_channel = new NotificationChannel(CHAT_CHANNEL_ID, name, importance);
            chat_channel.setDescription(description);

            // TODO Add more channels for device notifs, follows, etc
            // The rest of the notifications
            CharSequence general_name = context.getString(R.string.general_channel_name);
            String general_description = context.getString(R.string.general_channel_description);
            int general_importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel general_channel = new NotificationChannel(GENERAL_CHANNEL_ID, general_name, general_importance);
            chat_channel.setDescription(general_description);

            // Register the channel with the system; you can't change the importance
            // or other notification behaviors after this
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(chat_channel);
            notificationManager.createNotificationChannel(general_channel);
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
            KBPushNotifier notifier = new KBPushNotifier(getApplicationContext());
            notifier.setBundle(bundle);
            switch (type) {
                case "chat.newmessageSilent_2": {
                    Boolean displayPlaintext = "true".equals(bundle.getString("n"));
                    Integer membersType = Integer.parseInt(bundle.getString("t"));
                    String convID = bundle.getString("c");
                    Integer messageId = Integer.parseInt(bundle.getString("d"));
                    JSONArray pushes = parseJSONArray(bundle.getString("p"));
                    String pushId = pushes.getString(0);
                    Integer badgeCount = Integer.parseInt(bundle.getString("b"));
                    Integer unixTime = Integer.parseInt(bundle.getString("x"));
                    String soundName = bundle.getString("s");

                    if (!msgCache.containsKey(convID)) {
                        msgCache.put(convID, new SmallMsgRingBuffer());
                    }
                    notifier.setMsgCache(msgCache.get(convID));
                    // unixTime is in seconds android api expects ms
                    notifier.setTs(unixTime * 1000);

                    Keybase.handleBackgroundNotification(convID, payload, membersType, displayPlaintext, messageId, pushId, badgeCount, unixTime, soundName, notifier);
                }
                break;
                case "chat.newmessage": {
                  // We are just using chat.newmessageSilent_2
                }
                break;
                case "chat.readmessage": {
                    // Cancel any push notifications.
                    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getApplicationContext());
                    notificationManager.cancelAll();
                }
                break;
                default:
                    super.onMessageReceived(message);
            }
        } catch (JSONException jex) {
            NativeLogger.error("Couldn't parse json: " + jex.getMessage());
        } catch (Exception ex) {
            NativeLogger.error("Couldn't handle background notification: " + ex.getMessage());
            // Delegate to the RN code so at least something is sent.
            super.onMessageReceived(message);
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
        if (buffer.size() >= 5) {
            buffer.remove(0);
        }
        buffer.add(m);
    }

    public List<MessagingStyle.Message> summary() {
        return buffer.subList(0, buffer.size() >= 5 ? 5 : buffer.size());
    }
}
