package io.keybase.ossifrage.modules;

import android.content.Intent;
import android.net.Uri;
import android.support.v4.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;

import io.keybase.ossifrage.R;


public class ShareFiles extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public ShareFiles(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "ShareFiles";
    }

    @ReactMethod
    public void share(String uriPath, String mimeType, Promise promise) {
        Uri uri = Uri.parse(uriPath);
        File file = new File(reactContext.getCacheDir(), uri.getLastPathSegment());
        Uri fileUri = FileProvider.getUriForFile(reactContext, "io.keybase.ossifrage.fileprovider", file);

        Intent intent = new Intent(Intent.ACTION_SEND)
                .putExtra(Intent.EXTRA_STREAM, fileUri)
                .setType(mimeType);
        Intent chooser = Intent.createChooser(intent, reactContext.getResources().getText(R.string.send_to));
        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
            reactContext.startActivity(chooser);
            promise.resolve(true);
        } else {
            promise.reject(new Exception("Invalid chooser"));
        }
    }
}
