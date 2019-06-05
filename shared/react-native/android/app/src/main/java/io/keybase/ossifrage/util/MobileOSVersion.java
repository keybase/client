package io.keybase.ossifrage.util;

public final class MobileOSVersion {
    public static String Get() {
        return Integer.toString(android.os.Build.VERSION.SDK_INT);
    }
}
