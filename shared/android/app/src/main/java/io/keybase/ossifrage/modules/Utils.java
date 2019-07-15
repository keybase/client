package io.keybase.ossifrage.modules;

import android.app.DownloadManager;
import android.content.Context;
import android.os.Environment;
import android.telephony.TelephonyManager;
import android.net.Uri;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import java.io.File;

public class Utils extends ReactContextBaseJavaModule {
    private static final String NAME = "Utils";
    static ReactApplicationContext RCTContext;
    public Utils(final ReactApplicationContext reactContext) {
        super(reactContext);
        RCTContext = reactContext;
    }

    @Override
    public String getName() { return NAME; }

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

    @ReactMethod
    public void getDownloadDir(Promise promise) {
        try {
            promise.resolve(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getAbsolutePath());
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    static String normalizePath(String path) {
        if (path == null)
            return null;
        if (!path.matches("\\w+\\:.*"))
            return path;
        if (path.startsWith("file://")) {
            return path.replace("file://", "");
        }
        return null;
    }

    static WritableMap statFile(String path) {
        try {
            path = normalizePath(path);
            WritableMap stat = Arguments.createMap();

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

            return stat;
        } catch(Exception err) {
            return null;
        }
    }

    @ReactMethod
    public void addCompleteDownload (ReadableMap config, Promise promise) {
        DownloadManager dm = (DownloadManager) RCTContext.getSystemService(RCTContext.DOWNLOAD_SERVICE);
        if (config == null || !config.hasKey("path"))
        {
            promise.reject("EINVAL", "RNFetchblob.addCompleteDownload config or path missing.");
            return;
        }
        String path = normalizePath(config.getString("path"));
        if(path == null) {
            promise.reject("EINVAL", "RNFetchblob.addCompleteDownload can not resolve URI:" + config.getString("path"));
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
        }
        catch(Exception ex) {
            promise.reject("EUNSPECIFIED", ex.getLocalizedMessage());
        }

    }

}
