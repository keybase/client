package io.keybase.ossifrage.util;

import java.lang.reflect.Method;

public class DNSNSFetcher {
    public static String getDNSServer() {
        try {
            Class<?> SystemProperties = Class.forName("android.os.SystemProperties");
            Method method = SystemProperties.getMethod("get", new Class[]{String.class});
            return (String) method.invoke(null, "net.dns1");
        } catch (Exception e) {
            return "";
        }
    }
}
