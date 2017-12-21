package io.keybase.ossifrage.modules;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;


public class NativeLogger extends ReactContextBaseJavaModule {
    private static final String NAME = "KBNativeLogger";

    public NativeLogger(final ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void log(String tagPrefix, String toLog) {
        Log.i(tagPrefix + NAME, toLog);
    }

    @ReactMethod
    public void dump(String tagPrefix, Promise promise) {
        try {
            String cmd = "logcat -m 10000 -d " + tagPrefix + NAME + ":I *:S";

            Process process = Runtime.getRuntime().exec(cmd);
            BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            final WritableArray totalArray = Arguments.createArray();
            while ((line = r.readLine()) != null) {
                final int startIdx = line.indexOf(tagPrefix + NAME);
                if (startIdx > 0) {
                    totalArray.pushString(line.substring(startIdx + tagPrefix.length() + NAME.length() + 2)); // + 2 for the ': ' part
                }
            }
            promise.resolve(totalArray);
        } catch (IOException e) {
            promise.reject(e);
            e.printStackTrace();
        }
    }
}
