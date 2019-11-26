package io.keybase.ossifrage;

import android.annotation.TargetApi;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;
import android.webkit.MimeTypeMap;

import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.ReactFragmentActivity;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.modules.core.PermissionListener;

import com.facebook.react.ReactRootView;
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.UUID;

import io.keybase.ossifrage.modules.AppearanceModule;
import io.keybase.ossifrage.modules.KeybaseEngine;
import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.util.DNSNSFetcher;
import io.keybase.ossifrage.util.VideoHelper;
import keybase.Keybase;

import static keybase.Keybase.initOnce;

public class MainActivity extends ReactFragmentActivity {
  private static final String TAG = MainActivity.class.getName();
  private PermissionListener listener;
  static boolean createdReact = false;

  @Override
  public void invokeDefaultOnBackPressed() {
    moveTaskToBack(true);
  }

  private static void createDummyFile(Context context) {
    final File dummyFile = new File(context.getFilesDir(), "dummy.txt");
    try {
      if (dummyFile.createNewFile()) {
        dummyFile.setWritable(true);
        final FileOutputStream stream = new FileOutputStream(dummyFile);
        try {
          stream.write("hi".getBytes());
        } finally {
          stream.close();
        }
      } else {
        Log.d(TAG, "dummy.txt exists");
      }
    } catch (Exception e) {
      NativeLogger.error("Exception in createDummyFile", e);
    }
  }

  private ReactContext getReactContext() {
    ReactInstanceManager instanceManager = getReactInstanceManager();
    if (instanceManager == null) {
      NativeLogger.warn("react instance manager not ready");
      return null;
    }

    return instanceManager.getCurrentReactContext();
  }

  // Is this a robot controlled test device? (i.e. pre-launch report?)
  public static boolean isTestDevice(Context context) {
    String testLabSetting = Settings.System.getString(context.getContentResolver(), "firebase.test.lab");
    return "true".equals(testLabSetting);
  }


  public static void setupKBRuntime(Context context, boolean shouldCreateDummyFile) {
    try {
      Keybase.setGlobalExternalKeyStore(new KeyStore(context, context.getSharedPreferences("KeyStore", MODE_PRIVATE)));
    } catch (KeyStoreException | CertificateException | IOException | NoSuchAlgorithmException e) {
      NativeLogger.error("Exception in MainActivity.onCreate", e);
    }

    if (shouldCreateDummyFile) {
      createDummyFile(context);
    }
    String mobileOsVersion = Integer.toString(android.os.Build.VERSION.SDK_INT);
    initOnce(context.getFilesDir().getPath(), "", context.getFileStreamPath("service.log").getAbsolutePath(), "prod", false,
      new DNSNSFetcher(), new VideoHelper(), mobileOsVersion);

  }

  private static final int ANDROID_TEN = 29;

  private String colorSchemeForCurrentConfiguration() {
    // TODO: (hramos) T52929922: Switch to Build.VERSION_CODES.ANDROID_TEN or equivalent
    if (Build.VERSION.SDK_INT >= ANDROID_TEN) {
      int currentNightMode =
        this.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
      switch (currentNightMode) {
        case Configuration.UI_MODE_NIGHT_NO:
          return "light";
        case Configuration.UI_MODE_NIGHT_YES:
          return "dark";
      }
    }

    return "light";
  }


  @Override
  @TargetApi(Build.VERSION_CODES.KITKAT)
  protected void onCreate(Bundle savedInstanceState) {
    ReactInstanceManager instanceManager = this.getReactInstanceManager();
    if (!this.createdReact) {
      this.createdReact = true;
      instanceManager.createReactContextInBackground();
    }

    setupKBRuntime(this, true);
    super.onCreate(null);


    new android.os.Handler().postDelayed(new Runnable() {
      public void run() {
        // TODO, read this pref from go
        setBackgroundColor(DarkModePreference.System);
      }
    }, 300);

    KeybasePushNotificationListenerService.createNotificationChannel(this);
  }

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegate(this, getMainComponentName()) {
      @Override
      protected ReactRootView createRootView() {
        return new RNGestureHandlerEnabledRootView(MainActivity.this);
      }
    };
  }

  @Override
  public boolean onCreateThumbnail(final Bitmap outBitmap, final Canvas canvas) {
    return super.onCreateThumbnail(outBitmap, canvas);
  }

  @Override
  public boolean onKeyUp(int keyCode, KeyEvent event) {
    if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      return super.onKeyUp(KeyEvent.KEYCODE_MENU, null);
    }
    return super.onKeyUp(keyCode, event);
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    if (listener != null) {
      listener.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
  }

  @Override
  protected void onPause() {
    super.onPause();
    if (Keybase.appDidEnterBackground()) {
      Keybase.appBeginBackgroundTaskNonblock(new KBPushNotifier(this, new Bundle()));
    } else {
      Keybase.setAppStateBackground();
    }
  }

  private String readFileFromUri(ReactContext reactContext, Uri uri) {
    if (uri == null) return null;

    String filePath = null;
    if (uri.getScheme().equals("content")) {
      ContentResolver resolver = reactContext.getContentResolver();
      String mimeType = resolver.getType(uri);
      String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);

      // Load the filename from the resolver.
      // Of course, Android makes this super clean and easy.
      // Use a GUID default.
      String filename = String.format("%s.%s", UUID.randomUUID().toString(), extension);
      String[] nameProjection = {MediaStore.MediaColumns.DISPLAY_NAME};
      Cursor cursor = resolver.query(uri, nameProjection, null, null, null);
      if (cursor != null) {
        try {
          if (cursor.moveToFirst()) {
            filename = cursor.getString(0);
          }
        } finally {
          cursor.close();
        }
      }

      // Now load the file itself.
      File file = new File(reactContext.getCacheDir(), filename);
      try {
        InputStream istream = resolver.openInputStream(uri);
        OutputStream ostream = new FileOutputStream(file);

        byte[] buf = new byte[64 * 1024];
        int len;
        while ((len = istream.read(buf)) != -1) {
          ostream.write(buf, 0, len);
        }
        filePath = file.getPath();
      } catch (IOException ex) {
        Log.w(TAG, "error writing shared file " + uri.toString());
      }
    } else {
      filePath = uri.getPath();
    }
    return filePath;
  }

  private class IntentEmitter {
    private final Intent intent;

    private IntentEmitter(Intent intent) {
      this.intent = intent;
    }


    public void emit() {
      // Here we are just reading from the notification bundle.
      // If other sources start the app, we can get their intent data the same way.
      Bundle bundleFromNotification = intent.getBundleExtra("notification");
      intent.removeExtra("notification");

      // TODO this doesn't work and didn't work before
      String fromShareText = intent.getStringExtra(Intent.EXTRA_TEXT);
      intent.removeExtra(Intent.EXTRA_TEXT);
      if (fromShareText == null) {
        fromShareText = "";
      }
      String finalFromShareText = fromShareText;

      Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
      intent.removeExtra(Intent.EXTRA_STREAM);

      // If there isn't any data we care about, let's just return
      if (bundleFromNotification == null && fromShareText.isEmpty() && uri == null) {
        return;
      }

      // Closure like class so we can keep our emit logic together
      class Emit {
        private final ReactContext context;
        private DeviceEventManagerModule.RCTDeviceEventEmitter emitter;

        Emit(DeviceEventManagerModule.RCTDeviceEventEmitter emitter, ReactContext context) {
          this.emitter = emitter;
          this.context = context;
        }

        private void run() {
          KeybaseEngine engine = context.getNativeModule(KeybaseEngine.class);
          if (bundleFromNotification != null) {
            engine.setInitialIntent(Arguments.fromBundle(bundleFromNotification));
          }

          assert emitter != null;
          // If there are any other bundle sources we care about, emit them here
          if (bundleFromNotification != null) {
            emitter.emit("initialIntentFromNotification", Arguments.fromBundle(bundleFromNotification));
          }

          if (!finalFromShareText.isEmpty()) {
            WritableMap args = Arguments.createMap();
            args.putString("text", finalFromShareText);
            emitter.emit("onShareText", args);
          }

          if (uri != null) {
            String filePath = readFileFromUri(getReactContext(), uri);
            if (filePath != null) {
              WritableMap args = Arguments.createMap();
              args.putString("localPath", filePath);
              emitter.emit("onShareData", args);
            }
          }
        }
      }

      // We need to run this on the main thread, as the React code assumes that is true.
      // Namely, DevServerHelper constructs a Handler() without a Looper, which triggers:
      // "Can't create handler inside thread that has not called Looper.prepare()"
      Handler handler = new Handler(Looper.getMainLooper());
      handler.post(() -> {
        // Construct and load our normal React JS code bundle
        ReactInstanceManager reactInstanceManager = ((ReactApplication) getApplication()).getReactNativeHost().getReactInstanceManager();
        ReactContext context = reactInstanceManager.getCurrentReactContext();

        // If it's constructed, send a notification
        if (context != null) {
          DeviceEventManagerModule.RCTDeviceEventEmitter emitter = context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);

          (new Emit(emitter, context)).run();

        } else {
          // Otherwise wait for construction, then send the notification
          reactInstanceManager.addReactInstanceEventListener(rctContext -> {
            DeviceEventManagerModule.RCTDeviceEventEmitter emitter = rctContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class);
            (new Emit(emitter, rctContext)).run();
          });
          if (!reactInstanceManager.hasStartedCreatingInitialContext()) {
            // Construct it in the background
            reactInstanceManager.createReactContextInBackground();
          }
        }
      });


    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    Keybase.setAppStateForeground();

    // Emit the intent data to JS
    Intent intent = getIntent();
    if (intent != null) {
      (new IntentEmitter(intent)).emit();
    }
  }

  @Override
  protected void onStart() {
    super.onStart();
    Keybase.setAppStateForeground();
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
    Keybase.appWillExit(new KBPushNotifier(this, new Bundle()));
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is
   * used to schedule rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "Keybase";
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ReactInstanceManager instanceManager = getReactInstanceManager();

    if (instanceManager != null) {
      //instanceManager.onConfigurationChanged(newConfig);
      ReactContext currentContext = instanceManager.getCurrentReactContext();
      if (currentContext != null) {
        currentContext.getNativeModule(AppearanceModule.class).onConfigurationChanged();
      }
    }

    setBackgroundColor(DarkModePreference.System);
  }

  public void setBackgroundColor(DarkModePreference pref) {
    final int bgColor;
    if (pref == DarkModePreference.System) {
      bgColor = this.colorSchemeForCurrentConfiguration().equals("light") ? R.color.white : R.color.black;
    } else if (pref == DarkModePreference.AlwaysDark) {
      bgColor = R.color.black;
    } else {
      bgColor = R.color.white;
    }
    final Window mainWindow = this.getWindow();
    Handler handler = new Handler(Looper.getMainLooper());
    // Run this on the main thread.
    handler.post(() -> {
      mainWindow.setBackgroundDrawableResource(bgColor);
    });
  }
}
