package io.keybase.ossifrage;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.os.Bundle;
import android.support.v4.app.NotificationCompat;
import android.support.v4.app.NotificationCompat.MessagingStyle;
import android.support.v4.app.NotificationManagerCompat;
import android.support.v4.app.Person;
import android.support.v4.graphics.drawable.IconCompat;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import keybase.ChatNotification;
import keybase.Message;
import keybase.PushNotifier;

public class KBPushNotifier implements PushNotifier {
  private final Context context;
  private Bundle bundle;

  private SmallMsgRingBuffer convMsgCache;

  private MessagingStyle buildStyle(Person person) {
    MessagingStyle style = new MessagingStyle(person);
    if (convMsgCache != null) {
      for (MessagingStyle.Message msg : convMsgCache.summary()) {
        style.addMessage(msg);
      }
    }

    return style;
  }

  public KBPushNotifier(Context ctx, Bundle bundle) {
    this.context = ctx;
    this.bundle = bundle;
  }

  public void setMsgCache(SmallMsgRingBuffer convMsgCache) {
    this.convMsgCache = convMsgCache;
  }

  // From: https://stackoverflow.com/questions/11932805/cropping-circular-area-from-bitmap-in-android
  private static Bitmap getCroppedBitmap(Bitmap bitmap) {
    Bitmap output = Bitmap.createBitmap(bitmap.getWidth(),
      bitmap.getHeight(), Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(output);

    final int color = 0xff424242;
    final Paint paint = new Paint();
    final Rect rect = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());

    paint.setAntiAlias(true);
    canvas.drawARGB(0, 0, 0, 0);
    paint.setColor(color);
    canvas.drawCircle(bitmap.getWidth() / 2, bitmap.getHeight() / 2,
      bitmap.getWidth() / 2, paint);
    paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
    canvas.drawBitmap(bitmap, rect, rect, paint);
    return output;
  }

  // Controls the Intent that gets built
  private PendingIntent buildPendingIntent(Bundle bundle) {
    Intent open_activity_intent = new Intent(context, MainActivity.class);
    open_activity_intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    open_activity_intent.setPackage(context.getPackageName());
    open_activity_intent.putExtra("notification", bundle);

    PendingIntent pending_intent = PendingIntent.getActivity(this.context, 0, open_activity_intent,
      PendingIntent.FLAG_UPDATE_CURRENT);

    return pending_intent;
  }

  private IconCompat getKeybaseAvatar(String avatarUri) {
    IconCompat icon = null;

    if (!avatarUri.isEmpty()) {
      HttpURLConnection urlConnection = null;
      try {
        URL url = new URL(avatarUri);
        urlConnection = (HttpURLConnection) url.openConnection();
      } catch (IOException e) {
        e.printStackTrace();
      }

      try {
        if (urlConnection != null) {
          InputStream in = new BufferedInputStream(urlConnection.getInputStream());
          Bitmap bitmap = BitmapFactory.decodeStream(in);
          Bitmap croppedBitmap = getCroppedBitmap(bitmap);
          icon = IconCompat.createWithBitmap(croppedBitmap);
        }
      } catch (IOException e) {
        e.printStackTrace();
      } finally {
        if (urlConnection != null) {
          urlConnection.disconnect();
        }
      }
    }

    return icon;
  }

  @Override
  public void displayChatNotification(ChatNotification chatNotification) {
    // We need to specify these parameters so that the data returned
    // from the launching intent is processed correctly.
    // https://github.com/keybase/client/blob/95959e12d76612f455ab4a90835debff489eacf4/shared/actions/platform-specific/push.native.js#L363-L381
    Bundle bundle = (Bundle) this.bundle.clone();
    bundle.putBoolean("userInteraction", true);
    bundle.putString("type", "chat.newmessage");
    bundle.putString("convID", chatNotification.getConvID());
    PendingIntent pending_intent = buildPendingIntent(bundle);


    NotificationCompat.Builder builder =
      new NotificationCompat.Builder(this.context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notif)
        .setContentIntent(pending_intent)
        .setAutoCancel(true);

    Message msg = chatNotification.getMessage();
    Person.Builder personBuilder = new Person.Builder().setName(msg.getFrom().getKeybaseUsername()).setBot(msg.getFrom().getIsBot());

    String avatarUri = chatNotification.getMessage().getFrom().getKeybaseAvatar();
    IconCompat icon = getKeybaseAvatar(avatarUri);
    if (icon != null) {
      personBuilder.setIcon(icon);
    }

    Person fromPerson = personBuilder.build();

    if (this.convMsgCache != null) {
      String msgText = chatNotification.getIsPlaintext() ? chatNotification.getMessage().getPlaintext() : "Encrypted Message...";
      convMsgCache.add(new MessagingStyle.Message(msgText, msg.getAt(), fromPerson));
    }

    NotificationCompat.MessagingStyle style = buildStyle(fromPerson);
    style.setConversationTitle(chatNotification.getConversationName());
    style.setGroupConversation(chatNotification.getIsGroupConversation());

    builder.setStyle(style);

    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
    notificationManager.notify(chatNotification.getConvID(), 0, builder.build());
  }

  void followNotification(String username, String notificationMsg) {
    Bundle bundle = (Bundle) this.bundle.clone();
    bundle.putBoolean("userInteraction", true);
    bundle.putString("type", "follow");
    bundle.putString("username", username);

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this.context, KeybasePushNotificationListenerService.DEVICE_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_notif)
      .setContentTitle("Keybase - New Follower")
      .setContentText(notificationMsg)
      // Set the intent that will fire when the user taps the notification
      .setContentIntent(buildPendingIntent(bundle))
      .setAutoCancel(true);

    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
    notificationManager.notify("follow:" + username, 0, builder.build());
  }

  void deviceNotification() {
    Bundle bundle = (Bundle) this.bundle.clone();
    bundle.putBoolean("userInteraction", true);
    genericNotification(bundle.getString("device_id") + bundle.getString("type"), bundle.getString("message"), "", bundle, KeybasePushNotificationListenerService.DEVICE_CHANNEL_ID);
  }

  void generalNotification() {
    Bundle bundle = (Bundle) this.bundle.clone();
    bundle.putBoolean("userInteraction", true);
    genericNotification(bundle.getString("device_id") + bundle.getString("type"), bundle.getString("title"), bundle.getString("message"), bundle, KeybasePushNotificationListenerService.GENERAL_CHANNEL_ID);
  }

  private void genericNotification(String uniqueTag, String notificationTitle, String notificationMsg, Bundle bundle, String channelID) {
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this.context, channelID)
      .setSmallIcon(R.drawable.ic_notif)
      // Set the intent that will fire when the user taps the notification
      .setContentIntent(buildPendingIntent(bundle))
      .setAutoCancel(true);

    if (!notificationMsg.isEmpty()) {
      builder.setContentText(notificationMsg);
    }
    if (!notificationTitle.isEmpty()) {
      builder.setContentTitle(notificationTitle);
    }

    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
    notificationManager.notify(uniqueTag, 0, builder.build());

  }

  public void localNotification(String ident, String msg, long badgeCount, String soundName, String convID,
                                String typ) {
    genericNotification(ident, "", msg, this.bundle, KeybasePushNotificationListenerService.GENERAL_CHANNEL_ID);
  }

}

