package io.keybase.ossifrage;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationCompat.MessagingStyle;
import android.support.v4.app.NotificationManagerCompat;
import android.support.v4.app.Person;
import android.util.Log;

import keybase.PushNotifier;

public class KBPushNotifier implements PushNotifier {
    private final Context context;
    private Bundle bundle;

    private SmallMsgRingBuffer convMsgCache;
    private int timestamp;

    private NotificationCompat.Style buildStyle(Person person) {
        MessagingStyle style = new MessagingStyle(person);
        if (convMsgCache != null) {
            for (MessagingStyle.Message msg: convMsgCache.summary()) {
                style.addMessage(msg);
            }
        }

        return style;
    }

    public KBPushNotifier(Context ctx) {
        this.context = ctx;
    }

    public void setBundle(Bundle bundle) {
        this.bundle = bundle;
    }

    public void setMsgCache(SmallMsgRingBuffer convMsgCache) {
        this.convMsgCache = convMsgCache;
    }

    public void localNotification(String ident, String msg, long badgeCount, String soundName, String convID,
            String typ) {
        // We need to specify these parameters so that the data returned
        // from the launching intent is processed correctly.
        // https://github.com/keybase/client/blob/95959e12d76612f455ab4a90835debff489eacf4/shared/actions/platform-specific/push.native.js#L363-L381
        Bundle bundle = (Bundle)this.bundle.clone();
        bundle.putBoolean("userInteraction", true);
        bundle.putString("type", typ);
        bundle.putString("convID", convID);

        // TODO check if this is a chat notification

        String from = "Keybase";
        String rest = msg;
        try {
            String[] message = msg.split(":", 2);
            from = message[0];
            rest = message[1];
        } catch (Exception e) {
            Log.e("KBPushNotifier", "Coudn't figure out from");
        }

        Intent open_activity_intent = new Intent(context, MainActivity.class);
        open_activity_intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open_activity_intent.setPackage(context.getPackageName());
        open_activity_intent.putExtra("notification", bundle);

        PendingIntent pending_intent = PendingIntent.getActivity(this.context, 0, open_activity_intent,
            PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder mBuilder =
          new NotificationCompat.Builder(this.context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(from)
            .setContentText(rest)
            .setContentIntent(pending_intent)
            .setAutoCancel(true);

            Person fromPerson = new Person.Builder().setName(from).build();

            if (this.convMsgCache != null ) {
                convMsgCache.add(new MessagingStyle.Message(rest, timestamp, fromPerson));
            }

            NotificationCompat.Style style = buildStyle(fromPerson);
            mBuilder.setStyle(style);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
        notificationManager.notify(convID, 0, mBuilder.build());
    }

    public void setTs(int i) {
      this.timestamp = i;
    }
}

