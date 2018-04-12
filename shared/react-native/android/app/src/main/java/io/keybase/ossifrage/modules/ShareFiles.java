package io.keybase.ossifrage.modules;

import android.content.Intent;
import android.net.Uri;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;


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
    public void share(String uriPath, String mimeType) {
        Intent intent = new Intent();
        intent.setAction(Intent.ACTION_SEND);
        Uri uri = Uri.parse(uriPath);
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        intent.setType(mimeType);
        reactContext.startActivity(intent);
    }
}
