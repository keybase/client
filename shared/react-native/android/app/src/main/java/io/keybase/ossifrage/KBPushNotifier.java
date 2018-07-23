package io.keybase.ossifrage;

import android.content.Intent;
import android.content.Context;
import keybase.PushNotifier;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationManagerCompat;

import com.dieam.reactnativepushnotification.modules.RNPushNotification;

public class KBPushNotifier implements PushNotifier {
    private final Context context;

    public KBPushNotifier(Context ctx) {
        this.context = ctx;
    }

    public void localNotification(String ident, String msg, long badgeCount, String soundName, String convID,
            String typ) {
        NotificationCompat.Builder mBuilder = new NotificationCompat.Builder(this.context,
                RNPushNotification.CHANNEL_ID).setSmallIcon(R.drawable.ic_notif).setContentTitle("Keybase")
                        .setContentText(msg).setPriority(NotificationCompat.PRIORITY_HIGH);
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
        notificationManager.notify(1, mBuilder.build());
    }
}
