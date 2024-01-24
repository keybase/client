package io.keybase.ossifrage.util

import keybase.ExternalDNSNSFetcher

class DNSNSFetcher : ExternalDNSNSFetcher {
    override fun getServers(): ByteArray {
        return try {
            val SystemProperties = Class.forName("android.os.SystemProperties")
            val method = SystemProperties.getMethod("get", *arrayOf<Class<*>>(String::class.java))
            val servers = ArrayList<String>()
            for (name in arrayOf("net.dns1", "net.dns2", "net.dns3", "net.dns4")) {
                val value = method.invoke(null, name) as String
                if (value != null && "" != value && !servers.contains(value)) servers.add(value)
            }
            var srvStr = ""
            for (i in servers.indices) {
                srvStr += servers[i]
                if (i < servers.size - 1) {
                    srvStr += ","
                }
            }
            srvStr.toByteArray()
        } catch (e: Exception) {
            "".toByteArray()
        }
    }
}
