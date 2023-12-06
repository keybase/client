package com.reactnativekb;

import android.app.Activity;
import android.app.DownloadManager;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.text.format.DateFormat;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import keybase.Keybase;
import me.leolin.shortcutbadger.ShortcutBadger;
import static keybase.Keybase.readArr;
import static keybase.Keybase.version;
import static keybase.Keybase.writeArr;

public class KbModule extends KbSpec {
  public static final String NAME = "Kb";
    private static final String RN_NAME = "ReactNativeJS";
    private static final String RPC_META_EVENT_NAME = "kb-meta-engine-event";
    private static final String RPC_META_EVENT_ENGINE_RESET = "kb-engine-reset";
    private static final int MAX_TEXT_FILE_SIZE = 100 * 1024; // 100 kiB
    private static final String LINE_SEPARATOR = System.getProperty("line.separator");
    private Boolean started = false;
    private boolean misTestDevice;
    private HashMap<String, String> initialIntent;
    private final ReactApplicationContext reactContext;

    private native void nativeInstallJSI(long jsiPtr);
    private native void nativeEmit(long jsiPtr, CallInvokerHolderImpl jsInvoker, byte[] data);
    private ExecutorService executor;
    private Boolean jsiInstalled = false;

  KbModule(ReactApplicationContext reactContext) {
    super(reactContext);
        this.reactContext = reactContext;
        this.misTestDevice = isTestDevice(reactContext);
        this.setSecureFlag();

        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                setSecureFlag();
            }

            @Override
            public void onHostPause() { }

            @Override
            public void onHostDestroy() { }
        });
    }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

    @ReactMethod
    public void addListener(String eventName) { }

    @ReactMethod
    public void removeListeners(Integer count) {
    }

    // Is this a robot controlled test device? (i.e. pre-launch report?)
    private static boolean isTestDevice(ReactApplicationContext context) {
      String testLabSetting = Settings.System.getString(context.getContentResolver(), "firebase.test.lab");
      return "true".equals(testLabSetting);
    }

    /**
     * Gets a field from the project's BuildConfig. This is useful when, for example, flavors
     * are used at the project level to set custom fields.
     * @param context       Used to find the correct file
     * @param fieldName     The name of the field-to-access
     * @return              The value of the field, or {@code null} if the field is not found.
     */
    private Object getBuildConfigValue(String fieldName) {
        try {
            Class<?> clazz = Class.forName(this.reactContext.getPackageName() + ".BuildConfig");
            Field field = clazz.getField(fieldName);
            return field.get(null);
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        } catch (NoSuchFieldException e) {
            e.printStackTrace();
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        }
        return null;
    }


    private String readGuiConfig() {
        return GuiConfig.getInstance(this.reactContext.getFilesDir()).asString();
    }

    // newarch @Override
    protected Map<String, Object> getTypedExportedConstants() {
        String versionCode = String.valueOf(getBuildConfigValue("VERSION_CODE"));
        String versionName = String.valueOf(getBuildConfigValue("VERSION_NAME"));
        boolean isDeviceSecure = false;

        try {
            final KeyguardManager keyguardManager = (KeyguardManager) this.reactContext.getSystemService(Context.KEYGUARD_SERVICE);
            isDeviceSecure = keyguardManager.isKeyguardSecure();
        } catch (Exception e) {
            NativeLogger.warn(": Error reading keyguard secure state", e);
        }

        String serverConfig = "";
        try {
            serverConfig = ReadFileAsString.read(this.reactContext.getCacheDir().getAbsolutePath() + "/Keybase/keybase.app.serverConfig");
        } catch (Exception e) {
            NativeLogger.warn(": Error reading server config", e);
        }

        String cacheDir = "";
        {
            File dir = this.reactContext.getCacheDir();
            if (dir != null) {
                cacheDir = dir.getAbsolutePath();
            }
        }

        String downloadDir = "";
        {
            File dir = this.reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null) {
                downloadDir = dir.getAbsolutePath();
            }
        }

        final Map<String, Object> constants = new HashMap<>();
        constants.put("androidIsDeviceSecure", isDeviceSecure);
        constants.put("androidIsTestDevice", misTestDevice);
        constants.put("appVersionCode", versionCode);
        constants.put("appVersionName", versionName);
        constants.put("darkModeSupported", false);
        constants.put("fsCacheDir", cacheDir);
        constants.put("fsDownloadDir", downloadDir);
        constants.put("guiConfig", readGuiConfig());
        constants.put("serverConfig", serverConfig);
        constants.put("uses24HourClock", DateFormat.is24HourFormat(this.reactContext));
        constants.put("version", version());
        return constants;
    }

    // country code
    @ReactMethod
    public void getDefaultCountryCode(Promise promise) {
        try {
            TelephonyManager tm = (TelephonyManager) this.reactContext.getSystemService(Context.TELEPHONY_SERVICE);
            String countryCode = tm.getNetworkCountryIso();
            promise.resolve(countryCode);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    // Logging
    @ReactMethod
    public void logSend(String status, String feedback, boolean sendLogs, boolean sendMaxBytes, String traceDir, String cpuProfileDir, Promise promise) {
        if (misTestDevice) {
            return;
        }
        try {
          final String logID = Keybase.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir);
            promise.resolve(logID);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    // Settings
    @ReactMethod
    public void androidOpenSettings() {
        Intent intent = new Intent();
        intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", reactContext.getPackageName(), null);
        intent.setData(uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
    }

    // Screen protector
    @ReactMethod
    public void androidSetSecureFlagSetting(boolean setSecure, Promise promise) {
        final SharedPreferences prefs = reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE);
        final boolean success = prefs.edit().putBoolean("setSecure", setSecure).commit();
        promise.resolve(success);
        setSecureFlag();
    }

    @ReactMethod
    public void androidGetSecureFlagSetting(Promise promise) {
        final SharedPreferences prefs = this.reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE);
        final boolean setSecure = prefs.getBoolean("setSecure", !misTestDevice);
        promise.resolve(setSecure);
    }

    private void setSecureFlag() {
        final SharedPreferences prefs = this.reactContext.getSharedPreferences("SecureFlag", Context.MODE_PRIVATE);
        final boolean setSecure = prefs.getBoolean("setSecure", !misTestDevice);
        final Activity activity = this.reactContext.getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    final Window window = activity.getWindow();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH && setSecure) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    }
                }
            });
        }
    }

    // Sharing
    @ReactMethod
    public void androidShare(String uriPath, String mimeType, Promise promise) {
        File file = new File(uriPath);
        Intent intent = new Intent(Intent.ACTION_SEND).setType(mimeType);
        if (mimeType.startsWith("text/")) {
            handleTextFileSharing(file, intent, promise);
        } else {
            handleNonTextFileSharing(file, intent, promise);
        }
    }
    private void handleTextFileSharing(File file, Intent intent, Promise promise) {
        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            StringBuilder textBuilder = new StringBuilder();
            String text;
            boolean isFirst = true;

            while (textBuilder.length() < MAX_TEXT_FILE_SIZE && (text = br.readLine()) != null) {
                if (!isFirst) {
                    textBuilder.append(LINE_SEPARATOR);
                }
                textBuilder.append(text);
                isFirst = false;
            }
            intent.putExtra(Intent.EXTRA_TEXT, textBuilder.toString());
        } catch (FileNotFoundException ex) {
            promise.reject(new Exception("File not found"));
            return;
        } catch (IOException ex) {
            promise.reject(new Exception("Error reading the file"));
            return;
        }
        startSharing(intent, promise);
    }

    private void handleNonTextFileSharing(File file, Intent intent, Promise promise) {
        Uri fileUri = FileProvider.getUriForFile(reactContext, reactContext.getPackageName() + ".fileprovider", file);
        intent.putExtra(Intent.EXTRA_STREAM, fileUri);
        startSharing(intent, promise);
    }

    private void startSharing(Intent intent, Promise promise) {
        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
            Intent chooser = Intent.createChooser(intent, "Send to");
            // Android 5.1.1 fails `startActivity` below without this flag in the Intent.
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(chooser);
            promise.resolve(true);
        } else {
            promise.reject(new Exception("Invalid chooser"));
        }
    }

    @ReactMethod
    public void androidShareText(String text, String mimeType, Promise promise) {
        Intent intent = new Intent(Intent.ACTION_SEND).setType(mimeType);
        intent.putExtra(Intent.EXTRA_TEXT, text);

        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
            Intent chooser = Intent.createChooser(intent, "Send to");
            // Android 5.1.1 fails `startActivity` below without this flag in the Intent.
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(chooser);
            promise.resolve(true);
        } else {
            promise.reject(new Exception("Invalid chooser"));
        }
    }

    // Push

    @ReactMethod
    public void androidCheckPushPermissions(Promise promise) {
        NotificationManagerCompat managerCompat = NotificationManagerCompat.from(this.reactContext);
        promise.resolve(managerCompat.areNotificationsEnabled());
    }

    @ReactMethod
    public void androidRequestPushPermissions(Promise promise) {
        this.ensureFirebase();
        androidCheckPushPermissions(promise);
    }

    private void ensureFirebase() {
        boolean firebaseInitialized = FirebaseApp.getApps(this.reactContext).size() == 1;
        if (!firebaseInitialized) {
            FirebaseApp.initializeApp(this.reactContext,
                    new FirebaseOptions.Builder()
                            .setApplicationId(String.valueOf(getBuildConfigValue("APPLICATION_ID")))
                            .setProjectId("keybase-c30fb")
                            .setGcmSenderId("9603251415")
                            .build()
            );
        }
    }

    @ReactMethod
    public void androidGetRegistrationToken(Promise promise) {
        this.ensureFirebase();
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(new OnCompleteListener<String>() {
                @Override
                public void onComplete(@NonNull Task<String> task) {
                    if (!task.isSuccessful()) {
                        NativeLogger.info("Fetching FCM registration token failed " + task.getException());
                        promise.reject(task.getException());
                        return;
                    }

                    // Get new FCM registration token
                    String token = task.getResult();
                    NativeLogger.info("Got token: " + token);
                    promise.resolve(token);
                }
            });
    }

    // Unlink

    private void deleteRecursive(File fileOrDirectory) throws IOException {
        if (fileOrDirectory.isDirectory()) {
            File[] files = fileOrDirectory.listFiles();
            if (files == null) {
                throw new NullPointerException("Received null trying to list files of directory '" + fileOrDirectory + "'");
            } else {
                for (File child : files) {
                    deleteRecursive(child);
                }
            }
        }
        boolean result = fileOrDirectory.delete();
        if (!result) {
            throw new IOException("Failed to delete '" + fileOrDirectory + "'");
        }
    }

    private static final String FILE_PREFIX_BUNDLE_ASSET = "bundle-assets://";

    private boolean isAsset(String path) {
        return path != null && path.startsWith(FILE_PREFIX_BUNDLE_ASSET);
    }

    private String normalizePath(String path) {
        if (path == null)
            return null;
        if (!path.matches("\\w+\\:.*"))
            return path;
        if (path.startsWith("file://")) {
            return path.replace("file://", "");
        }

        Uri uri = Uri.parse(path);
        if (path.startsWith(FILE_PREFIX_BUNDLE_ASSET)) {
            return path;
        } else
            return PathResolver.getRealPathFromURI(this.reactContext, uri);
    }

    @ReactMethod
    public void androidUnlink(String path, Promise promise) {
        try {
            String normalizedPath = this.normalizePath(path);
            this.deleteRecursive(new File(normalizedPath));
            promise.resolve(true);
        } catch (Exception err) {
            promise.reject("EUNSPECIFIED", err.getLocalizedMessage());
        }
    }

    // download

    private WritableMap statFile(String path) {
        try {
            path = this.normalizePath(path);
            WritableMap stat = Arguments.createMap();
            if (this.isAsset(path)) {
                String name = path.replace(FILE_PREFIX_BUNDLE_ASSET, "");
                AssetFileDescriptor fd = this.reactContext.getAssets().openFd(name);
                stat.putString("filename", name);
                stat.putString("path", path);
                stat.putString("type", "asset");
                stat.putString("size", String.valueOf(fd.getLength()));
                stat.putInt("lastModified", 0);
            } else {
                File target = new File(path);
                if (!target.exists()) {
                    return null;
                }
                stat.putString("filename", target.getName());
                stat.putString("path", target.getPath());
                stat.putString("type", target.isDirectory() ? "directory" : "file");
                stat.putString("size", String.valueOf(target.length()));
                String lastModified = String.valueOf(target.lastModified());
                stat.putString("lastModified", lastModified);

            }
            return stat;
        } catch (Exception err) {
            return null;
        }
    }

    @ReactMethod
    public void androidAddCompleteDownload(ReadableMap config, Promise promise) {
        DownloadManager dm = (DownloadManager) this.reactContext.getSystemService(this.reactContext.DOWNLOAD_SERVICE);
        if (config == null || !config.hasKey("path")) {
            promise.reject("EINVAL", "addCompleteDownload config or path missing.");
            return;
        }
        String path = this.normalizePath(config.getString("path"));
        if (path == null) {
            promise.reject("EINVAL", "addCompleteDownload can not resolve URI:" + config.getString("path"));
            return;
        }
        try {
            WritableMap stat = statFile(path);
            dm.addCompletedDownload(
                    config.hasKey("title") ? config.getString("title") : "",
                    config.hasKey("description") ? config.getString("description") : "",
                    true,
                    config.hasKey("mime") ? config.getString("mime") : null,
                    path,
                    Long.valueOf(stat.getString("size")),
                    config.hasKey("showNotification") && config.getBoolean("showNotification")
            );
            promise.resolve(null);
        } catch (Exception ex) {
            promise.reject("EUNSPECIFIED", ex.getLocalizedMessage());
        }
    }

    // Dark mode
    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
    @ReactMethod
    public void androidAppColorSchemeChanged(String prefString) {
        try {
            final Activity activity = this.reactContext.getCurrentActivity();
            if (activity != null) {
                Method m = activity.getClass().getMethod("setBackgroundColor", DarkModePreference.class);
                final DarkModePreference pref = DarkModePrefHelper.fromString(prefString);
                m.invoke(activity, pref);
            }
        } catch (Exception ex) {
        }
    }

    // Badging

    @ReactMethod
    public void androidSetApplicationIconBadgeNumber(double badge) {
        ShortcutBadger.applyCount(this.reactContext, (int)badge);
    }


    // init bundles
    // This isn't related to the Go Engine, but it's a small thing that wouldn't be worth putting in
    // its own react module. That's because starting up a react module is a bit expensive and we
    // wouldn't be able to lazy load this because we need it on startup.
    @ReactMethod
    public void androidGetInitialBundleFromNotification(Promise promise) {
        try {
        final Activity activity = this.reactContext.getCurrentActivity();
        if (activity != null) {
            Method m = activity.getClass().getMethod("getInitialBundleFromNotification");
            Bundle initialBundleFromNotification = (Bundle)(m.invoke(activity));
            if (initialBundleFromNotification != null) {
                WritableMap map = Arguments.fromBundle(initialBundleFromNotification);
                promise.resolve(map);
                return;
            }
        }
        } catch (Exception ex){ }

        promise.resolve(null);
    }

    @ReactMethod
    public void androidGetInitialShareFileUrls(Promise promise) {
        try {
            final Activity activity = this.reactContext.getCurrentActivity();
            if (activity != null) {
                Method m = activity.getClass().getMethod("getInitialShareFileUrls");
                Object o = m.invoke(activity);
                if (o != null && o instanceof String[]) {
                    String[] us = (String[]) o;
                    WritableArray writableArray = Arguments.createArray();
                    for (String str : us) {
                        writableArray.pushString(str);
                    }
                    promise.resolve(writableArray);
                    return;
                }
            }
        } catch (Exception ex){
             Log.d("androidGetInitialShareFileUrl exception", ex.toString());
        }
        promise.resolve("");
    }

    @ReactMethod
    public void androidGetInitialShareText(Promise promise) {
        try {
            final Activity activity = this.reactContext.getCurrentActivity();
            if (activity != null) {
                Method m = activity.getClass().getMethod("getInitialShareText");
                Object shareText = m.invoke(activity);
                if (shareText != null) {
                    promise.resolve(String.valueOf(shareText));
                    return;
                }
            }
        } catch (Exception ex){}
        promise.resolve("");
    }

    // engine
    private static void relayReset(ReactApplicationContext reactContext) {
        if (!reactContext.hasActiveCatalystInstance()) {
            NativeLogger.info(NAME + ": JS Bridge is dead, Can't send EOF message");
        } else {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(RPC_META_EVENT_NAME, RPC_META_EVENT_ENGINE_RESET);
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public void install() {
        try {
            System.loadLibrary("cpp");
            jsiInstalled = true;
            this.nativeInstallJSI(this.reactContext.getJavaScriptContextHolder().get());
        } catch (Exception exception) {
            NativeLogger.error("Exception in installJSI", exception);
        }
    }

    @ReactMethod
    public void engineReset() {
      try {
          Keybase.reset();
          relayReset(reactContext);
      } catch (Exception e) {
          NativeLogger.error("Exception in engineReset", e);
      }
    }

    @ReactMethod
    public void engineStart() {
        NativeLogger.info("KeybaseEngine started");
        try {
            started = true;
            if (executor == null) {
                executor = Executors.newSingleThreadExecutor();
                executor.execute(new ReadFromKBLib(this.reactContext));
            }
        } catch (Exception e) {
            NativeLogger.error("Exception in engineStart", e);
        }
    }

// JSI
    private class ReadFromKBLib implements Runnable {
        private final ReactApplicationContext reactContext;

        public ReadFromKBLib(ReactApplicationContext reactContext) {
            this.reactContext = reactContext;

            reactContext.addLifecycleEventListener(new LifecycleEventListener() {
                @Override
                public void onHostResume() {
                    if (executor == null) {
                        executor = Executors.newSingleThreadExecutor();
                        executor.execute(new ReadFromKBLib(reactContext));
                    }
                }

                @Override
                public void onHostPause() {
                }

                @Override
                public void onHostDestroy() {
                    destroy();
                }
            });
        }

        @Override
        public void run() {
            do {
                try {

                    Thread.currentThread().setName("ReadFromKBLib");
                    final byte[] data = readArr();

                    if (!reactContext.hasActiveCatalystInstance()) {
                        NativeLogger.info(NAME + ": JS Bridge is dead, dropping engine message: " + data);
                    }

                    CallInvokerHolderImpl callInvoker = (CallInvokerHolderImpl) reactContext.getCatalystInstance().getJSCallInvokerHolder();
                    nativeEmit(reactContext.getJavaScriptContextHolder().get(), callInvoker, data);
                } catch (Exception e) {
                    if (e.getMessage() != null && e.getMessage().equals("Read error: EOF")) {
                        NativeLogger.info("Got EOF from read. Likely because of reset.");
                    } else {
                        NativeLogger.error("Exception in ReadFromKBLib.run", e);
                    }
                }
            } while (!Thread.currentThread().isInterrupted() && reactContext.hasActiveCatalystInstance());
        }
    }

    public void destroy() {
        try {
            Keybase.reset();
            relayReset(reactContext);
        } catch (Exception e) {
            NativeLogger.error("Exception in KeybaseEngine.destroy", e);
        }

        try {
            if (executor != null) {
                executor.shutdownNow();
            }

            // We often hit this timeout during app resume, e.g. hit the back
            // button to go to home screen and then tap Keybase app icon again.
            if (executor != null && !executor.awaitTermination(3, TimeUnit.SECONDS)) {
                NativeLogger.warn(NAME + ": Executor pool didn't shut down cleanly");
            }
            executor = null;
        } catch (Exception e) {
            NativeLogger.error("Exception in JSI.destroy", e);
        }
    }

    @ReactMethod
    public void rpcOnGo(byte[] arr) {
        try {
            writeArr(arr);
        } catch (Exception e) {
            NativeLogger.error("Exception in GoJSIBridge.rpcOnGo", e);
        }
    }


  @ReactMethod
  public void iosGetHasShownPushPrompt(Promise promise) {
      promise.reject(new Exception("wrong platform"));
  }
}
