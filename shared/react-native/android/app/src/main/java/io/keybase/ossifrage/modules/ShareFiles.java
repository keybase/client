package io.keybase.ossifrage.modules;

import android.content.Intent;
import android.net.Uri;
import android.support.v4.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;

import io.keybase.ossifrage.R;


public class ShareFiles extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;
    private static final int MAX_TEXT_FILE_LINES = 1000;

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
        File file = new File(uriPath);
        Intent intent = new Intent(Intent.ACTION_SEND).setType(mimeType);
        if (mimeType.startsWith("text/")) {
            try {
                BufferedReader br = new BufferedReader(new FileReader(file));
                StringBuilder textBuilder = new StringBuilder();
                String text;
                for (int i=0; i < MAX_TEXT_FILE_LINES && (text = br.readLine()) != null; i++) {
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
            Uri fileUri = FileProvider.getUriForFile(reactContext, "io.keybase.ossifrage.fileprovider", file);
            intent.putExtra(Intent.EXTRA_STREAM, fileUri);
        }
        Intent chooser = Intent.createChooser(intent, reactContext.getResources().getText(R.string.send_to));
        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
            reactContext.startActivity(chooser);
            promise.resolve(true);
        } else {
            promise.reject(new Exception("Invalid chooser"));
        }
    }
}
