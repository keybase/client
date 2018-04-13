package io.keybase.ossifrage.modules;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

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
        Intent intent = new Intent(Intent.ACTION_SEND)
                .putExtra(Intent.EXTRA_STREAM, uri)
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
