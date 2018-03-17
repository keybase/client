package io.keybase.ossifrage.util;

import com.facebook.react.bridge.ReactApplicationContext;
import com.rt2zz.reactnativecontacts.ContactsManager;

/**
 * ContactsManager doesn't set up its callback correctly.
 * This class is used to access the protected callback.
 */

public class ContactsPermissionsWrapper extends ContactsManager {
    public ContactsPermissionsWrapper(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    public static void callbackWrapper(int requestCode, String[] permissions, int[] grantResults) {
        onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
}
