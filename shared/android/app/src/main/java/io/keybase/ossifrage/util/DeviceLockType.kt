package io.keybase.ossifrage.util

import android.app.admin.DevicePolicyManager
import android.content.ContentResolver
import android.os.Environment
import android.provider.Settings
import java.io.File

/**
 * Code to check if the device has some lockscreen setup.
 * Adapted from: http://stackoverflow.com/questions/7768879/check-whether-lock-was-enabled-or-not
 */
object DeviceLockType {
    private const val PASSWORD_TYPE_KEY = "lockscreen.password_type"

    /**
     * This constant means that android using some unlock method not described here.
     * Possible new methods would be added in the future releases.
     */
    const val SOMETHING_ELSE = 0

    /**
     * Android using "None" or "Slide" unlock method. It seems there is no way to determine which method exactly used.
     * In both cases you'll get "PASSWORD_QUALITY_SOMETHING" and "LOCK_PATTERN_ENABLED" == 0.
     */
    const val NONE_OR_SLIDER = 1

    /**
     * Android using "Face Unlock" with "Pattern" as additional unlock method. Android don't allow you to select
     * "Face Unlock" without additional unlock method.
     */
    const val FACE_WITH_PATTERN = 3

    /**
     * Android using "Face Unlock" with "PIN" as additional unlock method. Android don't allow you to select
     * "Face Unlock" without additional unlock method.
     */
    const val FACE_WITH_PIN = 4

    /**
     * Android using "Face Unlock" with some additional unlock method not described here.
     * Possible new methods would be added in the future releases. Values from 5 to 8 reserved for this situation.
     */
    const val FACE_WITH_SOMETHING_ELSE = 9

    /**
     * Android using "Pattern" unlock method.
     */
    const val PATTERN = 10

    /**
     * Android using "PIN" unlock method.
     */
    const val PIN = 11

    /**
     * Android using "Password" unlock method with password containing only letters.
     */
    const val PASSWORD_ALPHABETIC = 12

    /**
     * Android using "Password" unlock method with password containing both letters and numbers.
     */
    const val PASSWORD_ALPHANUMERIC = 13

    /**
     * Returns current unlock method as integer value. You can see all possible values above
     *
     * @param contentResolver we need to pass ContentResolver to Settings.Secure.getLong(...) and
     * Settings.Secure.getInt(...)
     * @return current unlock method as integer value
     */
    fun getCurrent(contentResolver: ContentResolver?): Int {
        val mode = Settings.Secure.getLong(contentResolver, PASSWORD_TYPE_KEY,
                DevicePolicyManager.PASSWORD_QUALITY_SOMETHING.toLong())
        return if (mode == DevicePolicyManager.PASSWORD_QUALITY_SOMETHING.toLong()) {
            @Suppress("DEPRECATION")
            if (Settings.Secure.getInt(contentResolver, Settings.Secure.LOCK_PATTERN_ENABLED, 0) == 1) {
                PATTERN
            } else NONE_OR_SLIDER
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_BIOMETRIC_WEAK.toLong()) {
            val dataDirPath = Environment.getDataDirectory().absolutePath
            if (nonEmptyFileExists("$dataDirPath/system/gesture.key")) {
                FACE_WITH_PATTERN
            } else if (nonEmptyFileExists("$dataDirPath/system/password.key")) {
                FACE_WITH_PIN
            } else FACE_WITH_SOMETHING_ELSE
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_ALPHANUMERIC.toLong()) {
            PASSWORD_ALPHANUMERIC
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_ALPHABETIC.toLong()) {
            PASSWORD_ALPHABETIC
        } else if (mode == DevicePolicyManager.PASSWORD_QUALITY_NUMERIC.toLong()) {
            PIN
        } else SOMETHING_ELSE
    }

    private fun nonEmptyFileExists(filename: String): Boolean {
        val file = File(filename)
        return file.exists() && file.length() > 0
    }

    fun isDeviceLockEnabled(contentResolver: ContentResolver?): Boolean {
        return when (getCurrent(contentResolver)) {
            PIN, PASSWORD_ALPHANUMERIC, PASSWORD_ALPHABETIC, FACE_WITH_PIN, FACE_WITH_PATTERN, PATTERN -> true
            else -> false
        }
    }
}
