package io.keybase.ossifrage;

import android.content.Intent;
import android.app.PendingIntent;
import android.content.Context;
import keybase.PushNotifier;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationManagerCompat;

import com.dieam.reactnativepushnotification.modules.RNPushNotificationHelper;

public class KBPushNotifier implements PushNotifier {
    private final Context context;

    public KBPushNotifier(Context ctx) {
        this.context = ctx;
    }

    public void localNotification(String ident, String msg, long badgeCount, String soundName, String convID,
            String typ) {
        Intent open_activity_intent = new Intent(this.context, MainActivity.class);
        PendingIntent pending_intent = PendingIntent.getActivity(this.context, 0, open_activity_intent,
            PendingIntent.FLAG_CANCEL_CURRENT);
        NotificationCompat.Builder mBuilder =
            new NotificationCompat.Builder(this.context, RNPushNotificationHelper.NOTIFICATION_CHANNEL_ID )
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("Keybase")
            .setContentText(msg)
            .setContentIntent(pending_intent)
            .setPriority(NotificationCompat.PRIORITY_HIGH);
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
        notificationManager.notify(1, mBuilder.build());
    }
}
