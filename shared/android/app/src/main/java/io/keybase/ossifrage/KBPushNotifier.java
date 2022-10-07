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
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationCompat.MessagingStyle;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.graphics.drawable.IconCompat;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import io.keybase.ossifrage.modules.NativeLogger;
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

  KBPushNotifier(Context ctx, Bundle bundle) {
    this.context = ctx;
    this.bundle = bundle;
  }

  void setMsgCache(SmallMsgRingBuffer convMsgCache) {
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

    // unique so our intents are deduped, else it'll reuse old ones
    PendingIntent pending_intent = PendingIntent.getActivity(this.context, (int)(System.currentTimeMillis()/1000) , open_activity_intent, PendingIntent.FLAG_MUTABLE);

    return pending_intent;
  }

  private IconCompat getKeybaseAvatar(String avatarUri) {
    if (avatarUri.isEmpty()) {
      return null;
    }

    HttpURLConnection urlConnection = null;
    try {
      URL url = new URL(avatarUri);
      urlConnection = (HttpURLConnection) url.openConnection();
      InputStream in = new BufferedInputStream(urlConnection.getInputStream());
      Bitmap bitmap = BitmapFactory.decodeStream(in);
      Bitmap croppedBitmap = getCroppedBitmap(bitmap);
      return IconCompat.createWithBitmap(croppedBitmap);
    } catch (IOException e) {
      e.printStackTrace();
    } finally {
      if (urlConnection != null) {
        urlConnection.disconnect();
      }
    }

    return null;
  }

  @RequiresApi(api = Build.VERSION_CODES.KITKAT_WATCH)
  private NotificationCompat.Action newReplyAction(Context context, ConvData convData, PendingIntent openConv) {
    String replyLabel = "Reply";
    RemoteInput remoteInput = new RemoteInput.Builder(ChatBroadcastReceiver.KEY_TEXT_REPLY)
        .setLabel(replyLabel)
        .build();

    Intent intent = convData.intoIntent(context);
    intent.putExtra("openConvPendingIntent", openConv);

    // Our pending intent which will be sent to the broadcast receiver
    PendingIntent replyPendingIntent =
        PendingIntent.getBroadcast(context,
                convData.convID.hashCode(),
                intent,
                PendingIntent.FLAG_MUTABLE);

    NotificationCompat.Action action =
      new NotificationCompat.Action.Builder(R.drawable.ic_notif, "Reply", replyPendingIntent)
        .addRemoteInput(remoteInput)
        .build();
    return action;
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

    ConvData convData = new ConvData(chatNotification.getConvID(), chatNotification.getTlfName(), chatNotification.getMessage().getID());

    NotificationCompat.Builder builder =
      new NotificationCompat.Builder(this.context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notif)
        .setContentIntent(pending_intent)
        .setAutoCancel(true);

    int notificationDefaults = NotificationCompat.DEFAULT_LIGHTS | NotificationCompat.DEFAULT_VIBRATE;

    // Set notification sound
    if (chatNotification.getSoundName().equals("default")) {
      notificationDefaults |= NotificationCompat.DEFAULT_SOUND;
    } else {
      String soundResource = filenameResourceName(chatNotification.getSoundName());
      String soundUriStr = "android.resource://" + this.context.getPackageName() + "/raw/" + soundResource;
      Uri soundUri = Uri.parse(soundUriStr);
      builder.setSound(soundUri);
    }

    builder.setDefaults(notificationDefaults);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
      builder.addAction(newReplyAction(this.context, convData, pending_intent));
    }

    Message msg = chatNotification.getMessage();
    keybase.Person from = msg.getFrom();
    Person.Builder personBuilder = new Person.Builder()
      .setName(from.getKeybaseUsername())
      .setBot(from.getIsBot());

    String avatarUri = chatNotification.getMessage().getFrom().getKeybaseAvatar();
    IconCompat icon = getKeybaseAvatar(avatarUri);
    if (icon != null) {
      personBuilder.setIcon(icon);
    }

    Person fromPerson = personBuilder.build();

    if (this.convMsgCache != null) {
      String msgText = chatNotification.getIsPlaintext() ? chatNotification.getMessage().getPlaintext() : "";
      if (msgText.isEmpty()) {
        msgText = chatNotification.getMessage().getServerMessage();
      }
      convMsgCache.add(new MessagingStyle.Message(msgText, msg.getAt(), fromPerson));
    }

    MessagingStyle style = buildStyle(fromPerson);
    style.setConversationTitle(chatNotification.getConversationName());
    style.setGroupConversation(chatNotification.getIsGroupConversation());

    builder.setStyle(style);

    NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this.context);
    notificationManager.notify(chatNotification.getConvID(), 0, builder.build());
  }

  // Return the resource name of the specified file (i.e. name and no extension),
  // suitable for use in a resource URI.
  String filenameResourceName(String filename) {
    if (filename.indexOf(".") >= 0) {
      return filename.substring(0, filename.lastIndexOf("."));
    } else {
      // Not all filenames have an extension to be stripped.
      return filename;
    }
  }

  void followNotification(String username, String notificationMsg) {
    Bundle bundle = (Bundle) this.bundle.clone();
    bundle.putBoolean("userInteraction", true);
    bundle.putString("type", "follow");
    bundle.putString("username", username);

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this.context, KeybasePushNotificationListenerService.FOLLOW_CHANNEL_ID)
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
    genericNotification(bundle.getString("device_id") + bundle.getString("type"), bundle.getString("message"), "", bundle, KeybasePushNotificationListenerService.DEVICE_CHANNEL_ID);
  }

  void generalNotification() {
    Bundle bundle = (Bundle) this.bundle.clone();
    genericNotification(bundle.getString("device_id") + bundle.getString("type"), bundle.getString("title"), bundle.getString("message"), bundle, KeybasePushNotificationListenerService.GENERAL_CHANNEL_ID);
  }

  public void genericNotification(String uniqueTag, String notificationTitle, String notificationMsg, Bundle bundle, String channelID) {
    bundle.putBoolean("userInteraction", true);
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
