package io.keybase.ossifrage.util;

import java.lang.reflect.Method;
import java.util.ArrayList;

public class DNSNSFetcher implements go.keybase.ExternalDNSNSFetcher {
    public byte[] getServers() {
        try {
            Class<?> SystemProperties = Class.forName("android.os.SystemProperties");
            Method method = SystemProperties.getMethod("get", new Class[] { String.class });
            ArrayList<String> servers = new ArrayList<String>();
            for (String name : new String[] { "net.dns1", "net.dns2", "net.dns3", "net.dns4", }) {
                String value = (String) method.invoke(null, name);
                if (value != null && !"".equals(value) && !servers.contains(value))
                    servers.add(value);
            }
            String srvStr = new String();
            for (int i = 0; i < servers.size(); i++) {
                srvStr += servers.get(i);
                if (i < servers.size()-1) {
                    srvStr+=",";
                }
            }
            return srvStr.getBytes();
        } catch (Exception e) {
            return "".getBytes();
        }
    }
}
