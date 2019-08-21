package io.keybase.ossifrage;

import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.RequiresApi;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationManagerCompat;

import keybase.Keybase;

public class ChatBroadcastReceiver extends BroadcastReceiver {
  public static String KEY_TEXT_REPLY = "key_text_reply";

  @RequiresApi(api = Build.VERSION_CODES.KITKAT_WATCH)
  private String getMessageText(Intent intent) {
    Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
    if (remoteInput != null) {
        return remoteInput.getCharSequence(KEY_TEXT_REPLY).toString();
    }
    return null;
 }


  @RequiresApi(api = Build.VERSION_CODES.KITKAT_WATCH)
  @Override
  public void onReceive(Context context, Intent intent) {
    String messageBody = getMessageText(intent);
    if (messageBody != null) {
      ConvData convData = new ConvData(intent);
      PendingIntent openConv = intent.getParcelableExtra("openConvPendingIntent");

      NotificationCompat.Builder repliedNotification = new NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
        .setContentIntent(openConv)
        .setTimeoutAfter(1000)
        .setSmallIcon(R.drawable.ic_notif);

      try {
        Keybase.setAppStateBackgroundActive();
        Keybase.handlePostTextReply(convData.convID, convData.tlfName, messageBody);
        if (Keybase.appDidEnterBackground()) {
          Keybase.appBeginBackgroundTaskNonblock(new KBPushNotifier(context, new Bundle()));
        } else {
          Keybase.setAppStateBackground();
        }
        repliedNotification.setContentText("Replied");
      } catch (Exception e) {
        repliedNotification.setContentText("Couldn't send reply");
        e.printStackTrace();
      }

      NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
      notificationManager.notify(convData.convID, 0, repliedNotification.build());
    }
  }
}

class ConvData {
  String convID;
  String tlfName;

  ConvData(String convId, String tlfName) {
    this.convID = convId;
    this.tlfName = tlfName;
  }

  ConvData (Intent intent) {
    Bundle data = intent.getBundleExtra("ConvData");
    this.convID = data.getString("convID");
    this.tlfName = data.getString("tlfName");
  }

  public Intent intoIntent(Context context) {
    Bundle data = new Bundle();
    data.putString("convID", this.convID);
    data.putString("tlfName", this.tlfName);
    Intent intent = new Intent(context, ChatBroadcastReceiver.class);
    intent.putExtra("ConvData", data);
    return intent;
  }


}
