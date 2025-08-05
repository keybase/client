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
            57:ee:1b:d8:5f:af:c8:29:70:39:3d:36:a5:50:37:1b:d9:40:14:8f
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C=US, ST=Some-State, O=Keybase, Inc. **TEST CA**
        Validity
            Not Before: Aug  5 16:22:18 2025 GMT
            Not After : Dec  6 16:22:18 3024 GMT
        Subject: C=US, ST=Some-State, O=Keybase, Inc. **TEST CA**
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)
                Modulus:
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
            X509v3 Subject Key Identifier:
                C6:0B:C3:7E:8C:0A:0F:F5:66:5D:22:2B:68:83:8A:9D:E3:AC:26:AF
            X509v3 Authority Key Identifier:
                C6:0B:C3:7E:8C:0A:0F:F5:66:5D:22:2B:68:83:8A:9D:E3:AC:26:AF
            X509v3 Basic Constraints: critical
                CA:TRUE
            X509v3 Subject Alternative Name:
                IP Address:127.0.0.1
    Signature Algorithm: sha256WithRSAEncryption
    Signature Value:
        29:1e:82:49:53:2e:e6:a2:9a:e9:a0:fb:83:49:cf:31:8b:5d:
        f1:90:2b:12:86:a0:97:61:69:b9:4a:38:f8:66:21:84:1a:ea:
        ea:de:1b:28:a1:72:5e:73:92:b8:be:31:51:39:d7:d7:3d:89:
        e3:36:40:96:5b:9a:e8:ac:5a:27:58:6e:dd:64:3c:e8:e4:f3:
        89:ef:b5:99:23:1d:7f:57:08:72:c6:94:f0:89:af:de:09:45:
        4a:0d:6e:e6:aa:f0:98:ad:f2:89:17:29:36:30:08:65:3c:f2:
        d0:ce:6e:06:d2:02:54:f9:39:0f:73:03:a1:5e:16:2e:db:41:
        9c:c5:84:fe:70:e2:c5:e7:59:db:df:60:bc:c2:4e:a1:59:b7:
        fb:13:32:80:3c:6b:d0:44:90:ba:a3:a0:3b:db:a0:da:af:52:
        9f:79:43:12:b6:d9:0c:ee:a0:cf:7d:d5:87:35:d6:f7:2b:d7:
        0c:67:1e:fa:6a:b9:1c:57:97:0a:1c:6f:29:6e:ef:9a:ee:99:
        db:ed:ac:cd:b5:79:f2:f7:98:13:b1:6b:31:c5:a1:a7:cb:50:
        3a:f1:ad:87:64:1b:9c:21:b4:aa:63:d1:4f:f6:6f:79:60:f7:
        d4:f3:9b:d2:f7:45:7f:51:71:91:8e:b5:1e:41:6d:6e:95:e0:
        03:50:39:61
-----BEGIN CERTIFICATE-----
MIIDgDCCAmigAwIBAgIUV+4b2F+vyClwOT02pVA3G9lAFI8wDQYJKoZIhvcNAQEL
BQAwRjELMAkGA1UEBhMCVVMxEzARBgNVBAgMClNvbWUtU3RhdGUxIjAgBgNVBAoM
GUtleWJhc2UsIEluYy4gKipURVNUIENBKiowIBcNMjUwODA1MTYyMjE4WhgPMzAy
NDEyMDYxNjIyMThaMEYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRl
MSIwIAYDVQQKDBlLZXliYXNlLCBJbmMuICoqVEVTVCBDQSoqMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3KoIOvkDEViq0IHkyhGX70L7xoPi3t/AY64O
efa+63CN8Btz+/KZrwRW//LDJnz76/z8/SM+neXCZ95ZKUJxJPg/6JGCTWSBkKQw
Ru3EJXY9uk5wBrHueKxIlfHolH30m7cezZ2c/UhZUOvxKR+2NOTn0YURZ7sI+jvE
KaGnEIoORIW+iJ/o4K+HMyHqptEkxLKPWfUCT7JZZ+Otvn7uO+5xI+FuZnwYFsMY
9WgdQvkyLmfkCGaKLtL1JphwS8QU73culUv8CzID8V/XugbpccTco2rRTPVqzXyW
gt+tsp0UJtHd3UBZH92GNEUOkVEsQnZXQmGCwgLxx7BHBvj4YwIDAQABo2QwYjAd
BgNVHQ4EFgQUxgvDfowKD/VmXSIraIOKneOsJq8wHwYDVR0jBBgwFoAUxgvDfowK
D/VmXSIraIOKneOsJq8wDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwR/AAAB
MA0GCSqGSIb3DQEBCwUAA4IBAQApHoJJUy7moprpoPuDSc8xi13xkCsShqCXYWm5
Sjj4ZiGEGurq3hsooXJec5K4vjFROdfXPYnjNkCWW5rorFonWG7dZDzo5POJ77WZ
Ix1/VwhyxpTwia/eCUVKDW7mqvCYrfKJFyk2MAhlPPLQzm4G0gJU+TkPcwOhXhYu
20GcxYT+cOLF51nb32C8wk6hWbf7EzKAPGvQRJC6o6A726Dar1KfeUMSttkM7qDP
fdWHNdb3K9cMZx76arkcV5cKHG8pbu+a7pnb7azNtXny95gTsWsxxaGny1A68a2H
ZBucIbSqY9FP9m95YPfU85vS90V/UXGRjrUeQW1uleADUDlh
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
