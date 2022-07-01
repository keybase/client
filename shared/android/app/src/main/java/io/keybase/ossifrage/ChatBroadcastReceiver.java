package io.keybase.ossifrage;

import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import io.keybase.ossifrage.modules.NativeLogger;
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
    MainActivity.setupKBRuntime(context, false);
    ConvData convData = new ConvData(intent);
    PendingIntent openConv = intent.getParcelableExtra("openConvPendingIntent");
    NotificationCompat.Builder repliedNotification = new NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
      .setContentIntent(openConv)
      .setTimeoutAfter(1000)
      .setSmallIcon(R.drawable.ic_notif);
    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);

    String messageBody = getMessageText(intent);
    if (messageBody != null) {

      try {
        WithBackgroundActive withBackgroundActive = () -> Keybase.handlePostTextReply(convData.convID, convData.tlfName, convData.lastMsgId, messageBody);
        withBackgroundActive.whileActive(context);
        repliedNotification.setContentText("Replied");
      } catch (Exception e) {
        repliedNotification.setContentText("Couldn't send reply");
        NativeLogger.error("Failed to send quick reply", e);
      }

    } else {
      repliedNotification.setContentText("Couldn't send reply - Failed to read input.");
      NativeLogger.error("Message Body in quick reply was null");
    }

    notificationManager.notify(convData.convID, 0, repliedNotification.build());
  }
}

class ConvData {
  String convID;
  String tlfName;
  long lastMsgId;

  ConvData(String convId, String tlfName, long lastMsgId) {
    this.convID = convId;
    this.tlfName = tlfName;
    this.lastMsgId = lastMsgId;
  }

  ConvData (Intent intent) {
    Bundle data = intent.getBundleExtra("ConvData");
    this.convID = data.getString("convID");
    this.tlfName = data.getString("tlfName");
    this.lastMsgId = data.getLong("lastMsgId");
  }

  public Intent intoIntent(Context context) {
    Bundle data = new Bundle();
    data.putString("convID", this.convID);
    data.putString("tlfName", this.tlfName);
    data.putLong("lastMsgId", this.lastMsgId);
    Intent intent = new Intent(context, ChatBroadcastReceiver.class);
    intent.putExtra("ConvData", data);
    return intent;
  }
}
