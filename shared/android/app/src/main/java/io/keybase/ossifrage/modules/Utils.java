package io.keybase.ossifrage.modules;

import android.content.Context;
import android.os.Build;
import android.telephony.TelephonyManager;

import androidx.annotation.NonNull;

import com.facebook.react.BuildConfig;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.iid.FirebaseInstanceId;
import com.google.firebase.iid.InstanceIdResult;

public class Utils extends ReactContextBaseJavaModule {
    private static final String NAME = "Utils";

    public Utils(final ReactApplicationContext reactContext) { super(reactContext); }

    @Override
    public String getName() { return NAME; }

    @ReactMethod
    public void getRegistrationToken(Promise promise) {
      boolean firebaseInitialized = FirebaseApp.getApps(getReactApplicationContext()).size() == 1;
      if (!firebaseInitialized) {
        FirebaseApp.initializeApp(getReactApplicationContext(),
          new FirebaseOptions.Builder()
            .setApplicationId(BuildConfig.APPLICATION_ID)
            .setGcmSenderId("9603251415").build()
        );
      }
      FirebaseInstanceId.getInstance().getInstanceId()
        .addOnCompleteListener(new OnCompleteListener<InstanceIdResult>() {
            @Override
            public void onComplete(@NonNull Task<InstanceIdResult> task) {
                if (!task.isSuccessful()) {
                    NativeLogger.warn("getInstanceId failed", task.getException());
                    promise.reject(task.getException());
                    return;
                }


                // Get new Instance ID token
                String token = task.getResult().getToken();
                NativeLogger.info("Got token: " + token);
                promise.resolve(token);
            }
        });
    }



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
}
