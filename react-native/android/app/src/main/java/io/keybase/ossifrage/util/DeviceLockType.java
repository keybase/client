package io.keybase.ossifrage.util;

import android.app.admin.DevicePolicyManager;
import android.content.ContentResolver;
import android.os.Environment;
import android.provider.Settings;

import java.io.File;

/**
 * Code to check if the device has some lockscreen setup.
 * Adapted from: http://stackoverflow.com/questions/7768879/check-whether-lock-was-enabled-or-not
 */
public class DeviceLockType {
    private final static String PASSWORD_TYPE_KEY = "lockscreen.password_type";

    /**
     * This constant means that android using some unlock method not described here.
     * Possible new methods would be added in the future releases.
     */
    public final static int SOMETHING_ELSE = 0;

    /**
     * Android using "None" or "Slide" unlock method. It seems there is no way to determine which method exactly used.
     * In both cases you'll get "PASSWORD_QUALITY_SOMETHING" and "LOCK_PATTERN_ENABLED" == 0.
     */
    public final static int NONE_OR_SLIDER = 1;

    /**
     * Android using "Face Unlock" with "Pattern" as additional unlock method. Android don't allow you to select
     * "Face Unlock" without additional unlock method.
     */
    public final static int FACE_WITH_PATTERN = 3;

    /**
     * Android using "Face Unlock" with "PIN" as additional unlock method. Android don't allow you to select
     * "Face Unlock" without additional unlock method.
     */
    public final static int FACE_WITH_PIN = 4;

    /**
     * Android using "Face Unlock" with some additional unlock method not described here.
     * Possible new methods would be added in the future releases. Values from 5 to 8 reserved for this situation.
     */
    public final static int FACE_WITH_SOMETHING_ELSE = 9;

    /**
     * Android using "Pattern" unlock method.
     */
    public final static int PATTERN = 10;

    /**
     * Android using "PIN" unlock method.
     */
    public final static int PIN = 11;

    /**
     * Android using "Password" unlock method with password containing only letters.
     */
    public final static int PASSWORD_ALPHABETIC = 12;

    /**
     * Android using "Password" unlock method with password containing both letters and numbers.
     */
    public final static int PASSWORD_ALPHANUMERIC = 13;

    /**
     * Returns current unlock method as integer value. You can see all possible values above
     *
     * @param contentResolver we need to pass ContentResolver to Settings.Secure.getLong(...) and
     *                        Settings.Secure.getInt(...)
     * @return current unlock method as integer value
     */
    public static int getCurrent(ContentResolver contentResolver) {
        long mode = android.provider.Settings.Secure.getLong(contentResolver, PASSWORD_TYPE_KEY,
          DevicePolicyManager.PASSWORD_QUALITY_SOMETHING);
        if (mode == DevicePolicyManager.PASSWORD_QUALITY_SOMETHING) {
            if (android.provider.Settings.Secure.getInt(contentResolver, Settings.Secure.LOCK_PATTERN_ENABLED, 0) == 1) {
                return PATTERN;
            } else return NONE_OR_SLIDER;
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_BIOMETRIC_WEAK) {
            String dataDirPath = Environment.getDataDirectory().getAbsolutePath();
            if (nonEmptyFileExists(dataDirPath + "/system/gesture.key")) {
                return FACE_WITH_PATTERN;
            } else if (nonEmptyFileExists(dataDirPath + "/system/password.key")) {
                return FACE_WITH_PIN;
            } else return FACE_WITH_SOMETHING_ELSE;
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_ALPHANUMERIC) {
            return PASSWORD_ALPHANUMERIC;
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_ALPHABETIC) {
            return PASSWORD_ALPHABETIC;
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_NUMERIC) {
            return PIN;
        } else return SOMETHING_ELSE;
    }

    private static boolean nonEmptyFileExists(String filename) {
        File file = new File(filename);
        return file.exists() && file.length() > 0;
    }

    public static boolean isDeviceLockEnabled(ContentResolver contentResolver) {
        switch (getCurrent(contentResolver)) {
            case PIN:
            case PASSWORD_ALPHANUMERIC:
            case PASSWORD_ALPHABETIC:
            case FACE_WITH_PIN:
            case FACE_WITH_PATTERN:
            case PATTERN:
                return true;
            default:
                return false;
        }
    }
}
