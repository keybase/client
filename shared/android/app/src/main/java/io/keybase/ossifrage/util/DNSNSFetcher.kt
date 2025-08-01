package io.keybase.ossifrage.util

import keybase.ExternalDNSNSFetcher

class DNSNSFetcher : ExternalDNSNSFetcher {
    override fun getServers(): ByteArray {
        return try {
            val SystemProperties = Class.forName("android.os.SystemProperties")
            val method = SystemProperties.getMethod("get", *arrayOf<Class<*>>(String::class.java))
            val servers = ArrayList<String>()
            for (name in arrayOf("net.dns1", "net.dns2", "net.dns3", "net.dns4")) {
                val value = method.invoke(null, name) as String?
                if (value != null && "" != value && !servers.contains(value)) servers.add(value)
            }
            val srvStr = servers.joinToString(",")
            srvStr.toByteArray(Charsets.UTF_8)
        } catch (e: Exception) {
            "".toByteArray()
        }
    }
}
