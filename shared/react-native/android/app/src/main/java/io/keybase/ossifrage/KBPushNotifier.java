package io.keybase.ossifrage;

import android.content.Intent;
import android.app.PendingIntent;
import android.content.Context;
import keybase.PushNotifier;

import android.os.Bundle;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationManagerCompat;

import com.dieam.reactnativepushnotification.modules.RNPushNotificationHelper;

public class KBPushNotifier implements PushNotifier {
    private final Context context;
    private Bundle bundle;

    public KBPushNotifier(Context ctx) {
        this.context = ctx;
    }

    public void setBundle(Bundle bundle) {
        this.bundle = bundle;
    }

    public void localNotification(String ident, String msg, long badgeCount, String soundName, String convID,
            String typ) {
        Intent open_activity_intent = new Intent(context, MainActivity.class);
        open_activity_intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open_activity_intent.putExtra("isNotification", true);
        open_activity_intent.putExtra("convID", convID);
        open_activity_intent.setPackage(context.getPackageName());

        this.bundle.putBoolean("userInteraction", true);
        open_activity_intent.putExtra("notification", this.bundle);
        PendingIntent pending_intent = PendingIntent.getActivity(this.context, 0, open_activity_intent,
            PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder mBuilder =
            new NotificationCompat.Builder(this.context, RNPushNotificationHelper.NOTIFICATION_CHANNEL_ID )
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("Keybase")
            .setContentText(msg)
            .setContentIntent(pending_intent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
        notificationManager.notify(1, mBuilder.build());
    }
}
