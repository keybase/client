package com.reactnativekb;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import com.facebook.react.BuildConfig;
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
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.iid.FirebaseInstanceId;
import com.google.firebase.iid.InstanceIdResult;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import keybase.Keybase;

@ReactModule(name = KbModule.NAME)
public class KbModule extends ReactContextBaseJavaModule {
    public static final String NAME = "Kb";
    private static final String RN_NAME = "ReactNativeJS";
    private static final int MAX_TEXT_FILE_SIZE = 100 * 1024; // 100 kiB
    private static final String LINE_SEPARATOR = System.getProperty("line.separator");
    private boolean misTestDevice;
    private final ReactApplicationContext reactContext;

    // Is this a robot controlled test device? (i.e. pre-launch report?)
    private static boolean isTestDevice(ReactApplicationContext context) {
      String testLabSetting = Settings.System.getString(context.getContentResolver(), "firebase.test.lab");
      return "true".equals(testLabSetting);
    }

    public KbModule(ReactApplicationContext reactContext) {
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
            public void onHostPause() {
            }

            @Override
            public void onHostDestroy() {
            }
        });
    }

    @Override
    @NonNull
    public String getName() {
        return NAME;
    }

    // country code

    @ReactMethod
    public void getDefaultCountryCode(Promise promise) {
        try {
            TelephonyManager tm = (TelephonyManager) this.getReactApplicationContext().getSystemService(Context.TELEPHONY_SERVICE);
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

    private static String formatLine(String tagPrefix, String toLog) {
        // Copies the Style JS outputs in native/logger.native.tsx
        return tagPrefix + NAME + ": [" + System.currentTimeMillis() + ",\"" + toLog + "\"]";
    }

    @ReactMethod
    public void logDump(String tagPrefix, Promise promise) {
        try {
            String cmd = "logcat -m 10000 -d " + RN_NAME + ":I *:S";

            Process process = Runtime.getRuntime().exec(cmd);
            BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            final WritableArray totalArray = Arguments.createArray();
            final Pattern pattern = Pattern.compile(".*" + tagPrefix + NAME + ": (.*)");
            while ((line = r.readLine()) != null) {
                Matcher m = pattern.matcher(line);
                if (m.matches()) {
                    totalArray.pushString(m.group(1));
                }
            }
            promise.resolve(totalArray);
        } catch (IOException e) {
            promise.reject(e);
            Log.e(RN_NAME, formatLine("e", "Exception in dump: "+ Log.getStackTraceString(e)));
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
            try {
                BufferedReader br = new BufferedReader(new FileReader(file));
                StringBuilder textBuilder = new StringBuilder();
                String text;
                boolean isFirst = true;
                while (textBuilder.length() < MAX_TEXT_FILE_SIZE && (text = br.readLine()) != null) {
                    if (isFirst) {
                        isFirst = false;
                    } else {
                        textBuilder.append(LINE_SEPARATOR);
                    }
                    textBuilder.append(text);
                }
                intent.putExtra(Intent.EXTRA_TEXT, textBuilder.toString());
            } catch (FileNotFoundException ex) {
                // Create our own exceptions for the promise so we don't leak anything.
                promise.reject(new Exception("File not found"));
                return;
            } catch (IOException ex) {
                promise.reject(new Exception("Error reading the file"));
                return;
            }
        } else {
            Uri fileUri = FileProvider.getUriForFile(reactContext, reactContext.getPackageName() + ".fileprovider", file);
            intent.putExtra(Intent.EXTRA_STREAM, fileUri);
        }
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
        ReactApplicationContext reactContext = getReactApplicationContext();
        NotificationManagerCompat managerCompat = NotificationManagerCompat.from(reactContext);
        promise.resolve(managerCompat.areNotificationsEnabled());
    }

    @ReactMethod
    public void androidRequestPushPermissions(Promise promise) {
        this.ensureFirebase();
        FirebaseInstanceId.getInstance().getInstanceId()
                .addOnCompleteListener(new OnCompleteListener<InstanceIdResult>() {
                    @Override
                    public void onComplete(@NonNull Task<InstanceIdResult> task) {
                        androidCheckPushPermissions(promise);
                    }
                });
    }

    private void ensureFirebase() {
        boolean firebaseInitialized = FirebaseApp.getApps(getReactApplicationContext()).size() == 1;
        if (!firebaseInitialized) {
            FirebaseApp.initializeApp(getReactApplicationContext(),
                    new FirebaseOptions.Builder()
                            .setApplicationId(BuildConfig.LIBRARY_PACKAGE_NAME)
                            .setProjectId("keybase-c30fb")
                            .setGcmSenderId("9603251415")
                            .build()
            );
        }
    }

    @ReactMethod
    public void androidGetRegistrationToken(Promise promise) {
        this.ensureFirebase();
        FirebaseInstanceId.getInstance().getInstanceId()
                .addOnCompleteListener(new OnCompleteListener<InstanceIdResult>() {
                    @Override
                    public void onComplete(@NonNull Task<InstanceIdResult> task) {
                        if (!task.isSuccessful()) {
                            Log.i(RN_NAME, formatLine("w", "getInstanceId failed" + Log.getStackTraceString(task.getException())));
                            promise.reject(task.getException());
                            return;
                        }


                        // Get new Instance ID token
                        String token = task.getResult().getToken();
                        Log.i(RN_NAME, formatLine("i", "Got token: " + token));
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
            return PathResolver.getRealPathFromURI(this.getReactApplicationContext(), uri);
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
                AssetFileDescriptor fd = this.getReactApplicationContext().getAssets().openFd(name);
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
        DownloadManager dm = (DownloadManager) this.getReactApplicationContext().getSystemService(this.getReactApplicationContext().DOWNLOAD_SERVICE);
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
}
