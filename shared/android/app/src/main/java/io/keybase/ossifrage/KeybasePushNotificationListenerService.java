package io.keybase.ossifrage;

import android.content.Context;
import android.os.Bundle;
import android.support.v4.app.NotificationManagerCompat;

import com.dieam.reactnativepushnotification.helpers.ApplicationBadgeHelper;
import com.dieam.reactnativepushnotification.modules.RNPushNotificationListenerService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.Map;

import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.util.DNSNSFetcher;
import io.keybase.ossifrage.util.VideoHelper;
import keybase.Keybase;
import keybase.PushNotifier;

import static keybase.Keybase.initOnce;

public class KeybasePushNotificationListenerService extends RNPushNotificationListenerService {
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

                    Keybase.handleBackgroundNotification(convID, payload, membersType, displayPlaintext, messageId, pushId, badgeCount, unixTime, soundName, notifier);
                }
                break;
                case "chat.newmessage": {
                    String convID = bundle.getString("convID");
                    Integer membersType = Integer.parseInt(bundle.getString("t"));
                    Integer messageId = Integer.parseInt(bundle.getString("msgID"));
                    Keybase.handleBackgroundNotification(convID, payload, membersType, false, messageId, "", 0, 0, "", notifier);
                    // FIXME: this seems to be sending phantom notifications...
                    super.onMessageReceived(message);
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
