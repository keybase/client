package io.keybase.ossifrage;

import android.content.Intent;
import android.app.PendingIntent;
import android.content.Context;
import keybase.PushNotifier;

import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.dieam.reactnativepushnotification.modules.RNPushNotificationHelper;

public class KBPushNotifier implements PushNotifier {
    private final Context context;
    private Bundle bundle;
    private static final String NOTIFICATION_CHANNEL_ID = "rn-push-notification-channel-id";

    public KBPushNotifier(Context ctx) {
        this.context = ctx;
    }

    public void setBundle(Bundle bundle) {
        this.bundle = bundle;
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

        Intent open_activity_intent = new Intent(context, MainActivity.class);
        open_activity_intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open_activity_intent.setPackage(context.getPackageName());
        open_activity_intent.putExtra("notification", bundle);

        PendingIntent pending_intent = PendingIntent.getActivity(this.context, 0, open_activity_intent,
            PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder mBuilder =
            new NotificationCompat.Builder(this.context, NOTIFICATION_CHANNEL_ID )
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("Keybase")
            .setContentText(msg)
            .setContentIntent(pending_intent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setGroup(convID)
            .setGroupSummary(true)
            .setAutoCancel(true);
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
        notificationManager.notify(ident, 0, mBuilder.build());
    }
}
