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
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.graphics.Insets;

import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.ReactActivity;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.modules.core.PermissionListener;

import com.github.emilioicai.hwkeyboardevent.HWKeyboardEventModule;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.Arrays;
import java.util.Objects;
import java.util.ArrayList;
import java.util.UUID;

import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.util.DNSNSFetcher;
import io.keybase.ossifrage.util.VideoHelper;
import com.reactnativekb.GuiConfig;
import com.reactnativekb.DarkModePreference;
import keybase.Keybase;

import static keybase.Keybase.initOnce;

public class MainActivity extends ReactActivity {
    private static final String TAG = MainActivity.class.getName();
    private PermissionListener listener;
    private boolean isUsingHardwareKeyboard = false;
    static boolean createdReact = false;
    private Bundle initialBundleFromNotification;
    private String[] shareFileUrls;
    private String shareText;

    public void setInitialBundleFromNotification(Bundle bundle) {
        this.initialBundleFromNotification = bundle;
    }
    public void setInitialShareFileUrls(String [] urls) {
        this.shareFileUrls = urls;
    }
    public void setInitialShareText(String text) {
        this.shareText = text;
    }

    public Bundle getInitialBundleFromNotification() {
        Bundle b = this.initialBundleFromNotification;
        this.initialBundleFromNotification = null;
        return b;
    }
    public String []getInitialShareFileUrls() {
        String []s = this.shareFileUrls;
        this.shareFileUrls = null;
        return s;
    }
    public String getInitialShareText() {
        String s = this.shareText;
        this.shareText = null;
        return s;
    }


    @Override
    public void invokeDefaultOnBackPressed() {
        moveTaskToBack(true);
    }

    private static void createDummyFile(Context context) {
        File dummyFile = new File(context.getFilesDir(), "dummy.txt");
        try {
            if (dummyFile.createNewFile()) {
                dummyFile.setWritable(true);
                try (FileOutputStream stream = new FileOutputStream(dummyFile)) {
                    stream.write("hi".getBytes());
                }
            } else {
                Log.d(TAG, "dummy.txt exists");
            }
        } catch (Exception e) {
            NativeLogger.error("Exception in createDummyFile", e);
        }
    }

    private ReactContext getReactContext() {
        ReactInstanceManager instanceManager = ((ReactApplication) getApplication()).getReactNativeHost().getReactInstanceManager();
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
        boolean isIPad = false;
        boolean isIOS = false;
        initOnce(context.getFilesDir().getPath(), "", context.getFileStreamPath("service.log").getAbsolutePath(), "prod", false,
                new DNSNSFetcher(), new VideoHelper(), mobileOsVersion, isIPad, new KBInstallReferrerListener(context), isIOS);
    }

    private String colorSchemeForCurrentConfiguration() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int currentNightMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
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
        NativeLogger.info("Activity onCreate");
        ReactInstanceManager instanceManager = ((ReactApplication) getApplication()).getReactNativeHost().getReactInstanceManager();
        if (!this.createdReact) {
            this.createdReact = true;
            instanceManager.createReactContextInBackground();
        }

        setupKBRuntime(this, true);
        super.onCreate(null);

        new android.os.Handler().postDelayed(new Runnable() {
            public void run() {
                try {
                    setBackgroundColor(GuiConfig.getInstance(getFilesDir()).getDarkMode());
                } catch (Exception e) {}
            }
        }, 300);

        KeybasePushNotificationListenerService.createNotificationChannel(this);
        updateIsUsingHardwareKeyboard();

        // fix for keyboard avoiding not working on 35
        if (Build.VERSION.SDK_INT >= 35) {
            View rootView = findViewById(android.R.id.content);
            ViewCompat.setOnApplyWindowInsetsListener(rootView, new OnApplyWindowInsetsListener() {
                @Override
                public WindowInsetsCompat onApplyWindowInsets(View v, WindowInsetsCompat insets) {
                    Insets innerPadding = insets.getInsets(WindowInsetsCompat.Type.ime());
                    rootView.setPadding(
                        innerPadding.left,
                        innerPadding.top,
                        innerPadding.right,
                        innerPadding.bottom
                    );
                    return insets;
                }
            });
        }
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
        NativeLogger.info("Activity onPause");
        super.onPause();
        if (Keybase.appDidEnterBackground()) {
            Keybase.appBeginBackgroundTaskNonblock(new KBPushNotifier(this, new Bundle()));
        } else {
            Keybase.setAppStateBackground();
        }
    }

    private String getFileNameFromResolver(ContentResolver resolver, Uri uri, String extension) {
        // Use a GUID default.
        String filename = String.format("%s.%s", UUID.randomUUID().toString(), extension);

        String[] nameProjection = {MediaStore.MediaColumns.DISPLAY_NAME};
        try (Cursor cursor = resolver.query(uri, nameProjection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                filename = cursor.getString(0);
            }
        }

        int cut = filename.lastIndexOf('/');
        if (cut != -1) {
            filename = filename.substring(cut + 1);
        }

        return filename;
    }

    private File saveFileToCache(ReactContext reactContext, Uri uri, String filename) {
        File file = new File(reactContext.getCacheDir(), filename);

        try (InputStream istream = reactContext.getContentResolver().openInputStream(uri);
                OutputStream ostream = new FileOutputStream(file)) {

            byte[] buf = new byte[64 * 1024];
            int len;

            while ((len = istream.read(buf)) != -1) {
                ostream.write(buf, 0, len);
            }

        } catch (IOException ex) {
            Log.w(TAG, "Error writing shared file " + uri.toString(), ex);
        }

        return file;
    }

    private String readFileFromUri(ReactContext reactContext, Uri uri) {
        if (uri == null) return null;

        String filePath = null;
        if (uri.getScheme().equals("content")) {
            ContentResolver resolver = reactContext.getContentResolver();
            String mimeType = resolver.getType(uri);
            String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);

            // Load the filename from the resolver.
            String filename = getFileNameFromResolver(resolver, uri, extension);

            // Now load the file itself.
            File file = saveFileToCache(reactContext, uri, filename);
            filePath = file.getPath();
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

            String action = intent.getAction();

            Uri [] uris_ = null;
            if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                ArrayList<Uri> alUri = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                uris_ = alUri.toArray(new Uri[0]);
            } else if (Intent.ACTION_SEND.equals(action)) {
                Uri oneUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                uris_ = new Uri[]{oneUri};
            }
            intent.removeExtra(Intent.EXTRA_STREAM);
            final Uri [] uris = uris_;

            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            intent.removeExtra(Intent.EXTRA_SUBJECT);

            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            intent.removeExtra(Intent.EXTRA_TEXT);

            StringBuilder sb = new StringBuilder();
            if (subject != null) {
                sb.append(subject);
            }
            if (subject != null && text != null){
                sb.append(" ");
            }
            if (text != null) {
                sb.append(text);
            }
            String textPayload = sb.toString();

            String[] filePaths;
            if (uris != null) {
                ArrayList<String> filePathList = new ArrayList<String>();
                for (Uri uri : uris) {
                    String filePath = readFileFromUri(getReactContext(), uri);

                    if (filePath != null) {
                        filePathList.add(filePath);
                    }
                }
                filePaths = filePathList.toArray(new String[0]);
            } else {
                filePaths = new String[0];
            }
            if (bundleFromNotification != null) {
                setInitialBundleFromNotification(bundleFromNotification);
            } else if (filePaths.length != 0) {
                setInitialShareFileUrls(filePaths);
            } else if (textPayload.length() > 0){
                setInitialShareText(textPayload);
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
                    ReactContext context = getReactContext();
                    if (context == null) {
                        return;
                    }
                    // assert emitter != null;
                    // If there are any other bundle sources we care about, emit them here
                    if (bundleFromNotification != null) {
                        emitter.emit("initialIntentFromNotification", Arguments.fromBundle(bundleFromNotification));
                    }

                    if (filePaths.length != 0) {
                        WritableMap args = Arguments.createMap();
                        WritableArray lPaths = Arguments.createArray();
                        for (String path : filePaths) {
                            lPaths.pushString(path);
                        }
                        args.putArray("localPaths", lPaths);
                        emitter.emit("onShareData", args);
                    } else if (textPayload.length() > 0) {
                        WritableMap args = Arguments.createMap();
                        args.putString("text", textPayload);
                        emitter.emit("onShareData", args);
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
        NativeLogger.info("Activity onResume");
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
        NativeLogger.info("Activity onStart");
        super.onStart();
        Keybase.setAppStateForeground();
    }

    @Override
    protected void onDestroy() {
        NativeLogger.info("Activity onDestroy");
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

    /**
     * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
     * DefaultReactActivityDelegate} which allows you to easily enable Fabric and Concurrent React
     * (aka React 18) with two boolean flags.
     */
    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
                this,
                getMainComponentName(),
                // If you opted-in for the New Architecture, we enable the Fabric Renderer.
                DefaultNewArchitectureEntryPoint.getFabricEnabled()
                );
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        ReactInstanceManager instanceManager = ((ReactApplication) getApplication()).getReactNativeHost().getReactInstanceManager();

        try {
            setBackgroundColor(GuiConfig.getInstance(getFilesDir()).getDarkMode());
        } catch (Exception e) {}

        if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO) {
            isUsingHardwareKeyboard = true;
        } else if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_YES) {
            isUsingHardwareKeyboard = false;
        }
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

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (isUsingHardwareKeyboard && event.getKeyCode() == KeyEvent.KEYCODE_ENTER) {
            // Detects user pressing the enter key
            if (event.getAction() == KeyEvent.ACTION_DOWN && !event.isShiftPressed()) {
                // Enter is pressed
                HWKeyboardEventModule.getInstance().keyPressed("enter");
                return true;
            }
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.isShiftPressed()) {
                // Shift-Enter is pressed
                HWKeyboardEventModule.getInstance().keyPressed("shift-enter");
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void updateIsUsingHardwareKeyboard()  {
        isUsingHardwareKeyboard = getResources().getConfiguration().keyboard == Configuration.KEYBOARD_QWERTY;
    }
}
