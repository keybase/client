// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"net"
	"os"
)

// TestRootCert is a CA cert which can be used for testing TLS support.
// 127.0.0.1 is the only supported address.
const TestRootCert = `Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            df:57:8e:02:e8:e3:a2:04:e4:3f:ab:a4:3c:50:42:53
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: O=Keybase, Inc. **TEST CA**
        Validity
            Not Before: Aug  4 03:36:58 2015 GMT
            Not After : Aug  1 03:36:58 2025 GMT
        Subject: O=Keybase, Inc. **TEST CA**
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
            RSA Public Key: (2048 bit)
                Modulus (2048 bit):
                    00:dc:aa:08:3a:f9:03:11:58:aa:d0:81:e4:ca:11:
                    97:ef:42:fb:c6:83:e2:de:df:c0:63:ae:0e:79:f6:
                    be:eb:70:8d:f0:1b:73:fb:f2:99:af:04:56:ff:f2:
                    c3:26:7c:fb:eb:fc:fc:fd:23:3e:9d:e5:c2:67:de:
                    59:29:42:71:24:f8:3f:e8:91:82:4d:64:81:90:a4:
                    30:46:ed:c4:25:76:3d:ba:4e:70:06:b1:ee:78:ac:
                    48:95:f1:e8:94:7d:f4:9b:b7:1e:cd:9d:9c:fd:48:
                    59:50:eb:f1:29:1f:b6:34:e4:e7:d1:85:11:67:bb:
                    08:fa:3b:c4:29:a1:a7:10:8a:0e:44:85:be:88:9f:
                    e8:e0:af:87:33:21:ea:a6:d1:24:c4:b2:8f:59:f5:
                    02:4f:b2:59:67:e3:ad:be:7e:ee:3b:ee:71:23:e1:
                    6e:66:7c:18:16:c3:18:f5:68:1d:42:f9:32:2e:67:
                    e4:08:66:8a:2e:d2:f5:26:98:70:4b:c4:14:ef:77:
                    2e:95:4b:fc:0b:32:03:f1:5f:d7:ba:06:e9:71:c4:
                    dc:a3:6a:d1:4c:f5:6a:cd:7c:96:82:df:ad:b2:9d:
                    14:26:d1:dd:dd:40:59:1f:dd:86:34:45:0e:91:51:
                    2c:42:76:57:42:61:82:c2:02:f1:c7:b0:47:06:f8:
                    f8:63
                Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Key Usage: critical
                Digital Signature, Key Encipherment, Certificate Sign
            X509v3 Extended Key Usage: 
                TLS Web Server Authentication
            X509v3 Basic Constraints: critical
                CA:TRUE
            X509v3 Subject Alternative Name: 
                IP Address:127.0.0.1
    Signature Algorithm: sha256WithRSAEncryption
        03:72:7e:8f:b8:72:e1:ce:1e:67:92:71:e8:f7:9d:cd:ce:cc:
        e1:6f:29:69:3d:17:59:66:95:11:23:6a:eb:82:76:c9:b4:83:
        c2:50:e5:5a:55:2b:fd:c4:92:56:db:91:42:2a:29:56:30:5f:
        ae:6b:ae:69:a6:61:98:51:c2:c4:88:d6:58:11:4b:e5:05:ae:
        5d:29:74:0f:1f:05:5e:f9:33:3a:3a:98:dc:a1:0f:71:b2:8b:
        74:fd:fb:f2:c7:38:93:0b:22:80:ac:08:d1:3f:8f:bf:32:93:
        8a:a0:85:9a:e7:1d:d9:af:fa:94:e0:9f:6f:b4:e6:e6:98:91:
        b8:a1:b2:f4:6d:9c:29:8b:3e:fc:f5:61:7b:e1:6d:ad:2f:fd:
        8e:1e:ad:6d:f7:6c:75:29:48:b5:5b:01:cc:4a:a1:06:b9:03:
        19:7f:a9:b6:7f:86:94:32:4c:5f:59:3c:b8:74:b6:aa:63:80:
        44:59:3d:d9:61:35:01:75:52:0a:2c:ff:f5:fe:df:13:e5:d9:
        79:3a:77:d9:d9:11:b4:40:e0:8a:b1:df:a4:19:52:1f:f1:bb:
        3b:ac:35:96:17:de:78:dc:ed:b8:79:a1:2f:f9:9d:31:1b:9e:
        6c:93:17:b7:fe:f1:fe:a4:00:45:eb:85:f8:82:85:6f:0d:93:
        93:f0:d3:8c
-----BEGIN CERTIFICATE-----
MIIDGDCCAgKgAwIBAgIRAN9XjgLo46IE5D+rpDxQQlMwCwYJKoZIhvcNAQELMCQx
IjAgBgNVBAoTGUtleWJhc2UsIEluYy4gKipURVNUIENBKiowHhcNMTUwODA0MDMz
NjU4WhcNMjUwODAxMDMzNjU4WjAkMSIwIAYDVQQKExlLZXliYXNlLCBJbmMuICoq
VEVTVCBDQSoqMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3KoIOvkD
EViq0IHkyhGX70L7xoPi3t/AY64Oefa+63CN8Btz+/KZrwRW//LDJnz76/z8/SM+
neXCZ95ZKUJxJPg/6JGCTWSBkKQwRu3EJXY9uk5wBrHueKxIlfHolH30m7cezZ2c
/UhZUOvxKR+2NOTn0YURZ7sI+jvEKaGnEIoORIW+iJ/o4K+HMyHqptEkxLKPWfUC
T7JZZ+Otvn7uO+5xI+FuZnwYFsMY9WgdQvkyLmfkCGaKLtL1JphwS8QU73culUv8
CzID8V/XugbpccTco2rRTPVqzXyWgt+tsp0UJtHd3UBZH92GNEUOkVEsQnZXQmGC
wgLxx7BHBvj4YwIDAQABo0kwRzAOBgNVHQ8BAf8EBAMCAKQwEwYDVR0lBAwwCgYI
KwYBBQUHAwEwDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwR/AAABMAsGCSqG
SIb3DQEBCwOCAQEAA3J+j7hy4c4eZ5Jx6Pedzc7M4W8paT0XWWaVESNq64J2ybSD
wlDlWlUr/cSSVtuRQiopVjBfrmuuaaZhmFHCxIjWWBFL5QWuXSl0Dx8FXvkzOjqY
3KEPcbKLdP378sc4kwsigKwI0T+PvzKTiqCFmucd2a/6lOCfb7Tm5piRuKGy9G2c
KYs+/PVhe+FtrS/9jh6tbfdsdSlItVsBzEqhBrkDGX+ptn+GlDJMX1k8uHS2qmOA
RFk92WE1AXVSCiz/9f7fE+XZeTp32dkRtEDgirHfpBlSH/G7O6w1lhfeeNztuHmh
L/mdMRuebJMXt/7x/qQAReuF+IKFbw2Tk/DTjA==
-----END CERTIFICATE-----`

// TestRootKey can be used with the above cert+public key to test TLS support.
const TestRootKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA3KoIOvkDEViq0IHkyhGX70L7xoPi3t/AY64Oefa+63CN8Btz
+/KZrwRW//LDJnz76/z8/SM+neXCZ95ZKUJxJPg/6JGCTWSBkKQwRu3EJXY9uk5w
BrHueKxIlfHolH30m7cezZ2c/UhZUOvxKR+2NOTn0YURZ7sI+jvEKaGnEIoORIW+
iJ/o4K+HMyHqptEkxLKPWfUCT7JZZ+Otvn7uO+5xI+FuZnwYFsMY9WgdQvkyLmfk
CGaKLtL1JphwS8QU73culUv8CzID8V/XugbpccTco2rRTPVqzXyWgt+tsp0UJtHd
3UBZH92GNEUOkVEsQnZXQmGCwgLxx7BHBvj4YwIDAQABAoIBAQCBB+P8J/PFRuXL
Osk/533CaJa1BBW7YXcsUnEgnEoTfiNhTYxKvRdkodMFozy92sOswKhmlR9eUSWW
ewwD9lgW2Br2sW9SNf0VSQz5zLqvdS6vLIKRR6Y8ZfGjzGrFuck47KFUdl+AM7gW
e4DvHR38XAW6HGeLEnEzcZNJDL+WCS4XP0ylbAoQsasBZz9xWEhQ7CXV0rC2r00b
E30WNnDkTAvMQlErwgDBAcqziIOejSbj2qkjJjPY4IO91718qchOwBwXKl8bP/Zs
7eQmtYdBLGCPXGf9ngcJWB9Fu/kVZbIh1yg/Pxlz9anZ9a0PeTlCiSkzPxjl7H5d
L0dQfiJhAoGBAPcOe5c9N0PHfUqHvMuV6DB/SNgr5IeXvE0jt8VfRVGQpzdrWmzM
NA68ENHGueSdLJw56Y9N2ENxPIbEfhw1Aj8yzTsmR/zJS+/niMk1NOF09TamhkmE
FzQdVKbfcmhQ6irbN7A4+bONJHLhPxfN1awfHHWelD5KZLuw7h0OmZ05AoGBAOSm
92jSpvmVzDtW9IN+JaPEKSA/M80F9Z8s7wXft0KFYbSOEShH3by5qLNXAfhqr/HU
Czy8DnoNCjjmG5a92R2gSI+Rp/69J8KxpT3dRNaFu1DGyilCV2AYrjs/CpJebwen
RfCfKcv9o6xbkFTd+W5zT4rLR7BAsnopo6HGa957AoGAb8TEkxJluys3+ozYE754
8d/Tw8Bvvgwea0Oacxd707++dqsBmLD1aCka7tyZ4txcfz0P9f4Atdo3yLyCVR6C
Krc/89+It8sVqK41ytlgWBNCkHvbysyQdspCLtBuANWCausMEZRlGx7ie3p9wbYk
UZ8tj+SzKk8brXII92pQgrkCgYEAm6dmKX+tl554J7UsQw9vBCsXbBJaaymxaain
FrKTCL/QIZ/M4kT6F+2zgFKszrWiDNgyxienG0MhQFa1VUrsMJTakJGxcWLHXGye
dpzYrcjgGT8ahDfbT1m90is6QSX0I5ulqwZO58VE1KKIgJ2TnbL15SA5Lyz70tnh
wNFYwV0CgYEAqD+ojYP6i7shKJal7U8mi1pPrytjIx6DyMlqY4fl3MQ3IMGdZ1nI
aOOhUtJxzorYWSCcNZKCUFu1esbmDO4PlkfnzaBVCqPZ3CThPnmUBZ2wg9rpZu2S
7Q0sQ3FFXg9WqcsduaKRy5d8LKH8ikRooQw/Q5BpZ1tfKJStU6Xjf9U=
-----END RSA PRIVATE KEY-----`

const (
	// EnvTestRootCertPEM is the environment variable name for the
	// CA cert PEM the client uses to verify the KBFS servers when
	// testing. Any certificate present here overrides any
	// certificate inferred from a server address.
	EnvTestRootCertPEM = "KEYBASE_TEST_ROOT_CERT_PEM"
)

// GetRootCerts returns a byte array with the appropriate root certs
// for the given host:port string.
func GetRootCerts(serverAddr string,
	certGetter func(host string) (certsBundle []byte, ok bool)) []byte {
	// Use the environment variable, if set.
	envTestRootCert := os.Getenv(EnvTestRootCertPEM)
	if len(envTestRootCert) != 0 {
		return []byte(envTestRootCert)
	}

	if host, _, err := net.SplitHostPort(serverAddr); err == nil {
		if rootCA, ok := certGetter(host); ok {
			return rootCA
		}
	}

	// Fall back to the test cert.
	return []byte(TestRootCert)
}
