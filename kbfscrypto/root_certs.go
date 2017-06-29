// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"net"
	"os"
	"strings"
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

// DevRootCerts are the root CA certificates for the dev VPC.
// During rotation multiple certificates are expected in the PEM blob.
const DevRootCerts = `Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            d4:4c:7a:84:73:dd:78:39:73:c9:13:d9:fe:64:f7:03
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: DC=io, DC=dev.keybase, CN=Keybase KBFS CA dev
        Validity
            Not Before: Sep 23 19:47:37 2015 GMT
            Not After : Sep 22 19:47:37 2017 GMT
        Subject: DC=io, DC=dev.keybase, CN=Keybase KBFS CA dev
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
            RSA Public Key: (2048 bit)
                Modulus (2048 bit):
                    00:b5:82:4e:9a:3c:34:d7:86:33:a9:c8:90:d5:be:
                    e2:a8:8c:f2:87:2e:16:30:f0:d8:4a:fa:5c:98:67:
                    72:08:fb:c6:34:c6:7f:ff:72:66:a9:d7:78:61:f2:
                    1c:64:fa:e8:0b:4a:97:96:dc:f2:ca:27:e3:e9:e9:
                    5a:6b:ec:e3:b3:97:39:11:7b:60:68:bc:f5:df:4a:
                    06:52:02:e0:d0:9e:b5:92:c1:49:55:a2:48:6f:97:
                    5d:22:ab:98:87:df:8b:a0:f4:52:88:e9:65:cd:9b:
                    96:7c:e0:7a:31:0e:8a:2d:6e:08:34:9a:8f:a4:d1:
                    2d:c0:bc:cf:f7:97:2a:af:83:b4:f7:1f:36:73:cb:
                    d2:9b:b9:0a:25:0d:ac:7d:5c:03:d3:d2:fa:33:b5:
                    3a:89:c2:18:f1:b9:c9:58:d6:6c:1c:34:9d:07:d3:
                    86:16:a9:9b:d2:28:86:d7:5b:63:39:50:89:26:c4:
                    d7:ed:dc:b4:dc:02:3c:b6:ac:de:69:94:5a:47:2b:
                    ad:56:e7:d4:56:b9:e0:b9:df:35:1d:ae:a6:76:51:
                    35:9e:dc:cd:f0:7f:be:dc:a6:50:9e:bf:cb:c7:4b:
                    61:39:a7:cc:c1:45:63:2e:35:e8:53:a6:be:be:0d:
                    a8:b0:64:68:c5:a0:f7:1a:7e:29:e4:77:d3:4e:38:
                    02:27
                Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Basic Constraints: critical
                CA:TRUE
            X509v3 Key Usage: critical
                Certificate Sign, CRL Sign
            X509v3 Subject Key Identifier: 
                17:5B:EB:E8:7E:42:AE:6F:5D:45:A8:F7:D4:1B:6A:D4:13:5F:AB:BE
            X509v3 Authority Key Identifier: 
                keyid:17:5B:EB:E8:7E:42:AE:6F:5D:45:A8:F7:D4:1B:6A:D4:13:5F:AB:BE

    Signature Algorithm: sha256WithRSAEncryption
        2b:86:9d:0a:5d:f2:47:12:15:5c:51:7a:98:62:37:67:a5:94:
        23:ab:7f:b4:68:a8:cc:8e:09:d5:59:e9:31:c3:00:40:46:1e:
        32:73:2d:9e:ef:4e:ba:ae:ed:5e:0d:9a:fa:9b:21:98:2b:ef:
        ef:8d:78:ad:b9:6b:6a:ef:f7:3f:16:27:de:ce:08:de:ea:8f:
        65:07:54:cf:6a:68:10:78:4f:2c:96:aa:80:81:cd:ce:c5:3a:
        9b:00:07:fe:af:12:5e:95:c2:3a:68:e9:bb:b6:a5:f4:e2:4f:
        00:8a:e8:66:76:be:b8:70:cf:cd:b1:94:ca:51:ba:c2:1c:25:
        4d:1c:f3:63:f3:05:a4:ad:bf:69:6d:71:ff:ab:4f:86:b7:f8:
        30:e0:c8:8b:ea:9d:58:b9:2a:f8:48:81:0d:a8:3a:4f:54:58:
        8e:09:c6:ce:4a:2c:39:38:73:de:fd:5c:0b:b6:cf:e0:dd:ed:
        cd:49:7a:9d:e7:79:d0:5b:5f:c2:82:94:81:75:3e:f7:a1:6c:
        3e:48:17:ef:db:52:ae:24:de:4a:ef:8e:52:f1:df:49:7d:b2:
        c8:b5:68:0c:ef:7a:3d:e0:c4:8b:3a:95:04:97:61:7b:aa:a5:
        e3:d9:e3:81:11:85:88:31:b4:63:30:c6:7b:57:39:ae:a3:9c:
        28:dc:cf:22
-----BEGIN CERTIFICATE-----
MIIDjDCCAnSgAwIBAgIRANRMeoRz3Xg5c8kT2f5k9wMwDQYJKoZIhvcNAQELBQAw
TzESMBAGCgmSJomT8ixkARkWAmlvMRswGQYKCZImiZPyLGQBGRYLZGV2LmtleWJh
c2UxHDAaBgNVBAMME0tleWJhc2UgS0JGUyBDQSBkZXYwHhcNMTUwOTIzMTk0NzM3
WhcNMTcwOTIyMTk0NzM3WjBPMRIwEAYKCZImiZPyLGQBGRYCaW8xGzAZBgoJkiaJ
k/IsZAEZFgtkZXYua2V5YmFzZTEcMBoGA1UEAwwTS2V5YmFzZSBLQkZTIENBIGRl
djCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALWCTpo8NNeGM6nIkNW+
4qiM8ocuFjDw2Er6XJhncgj7xjTGf/9yZqnXeGHyHGT66AtKl5bc8son4+npWmvs
47OXORF7YGi89d9KBlIC4NCetZLBSVWiSG+XXSKrmIffi6D0UojpZc2blnzgejEO
ii1uCDSaj6TRLcC8z/eXKq+DtPcfNnPL0pu5CiUNrH1cA9PS+jO1OonCGPG5yVjW
bBw0nQfThhapm9IohtdbYzlQiSbE1+3ctNwCPLas3mmUWkcrrVbn1Fa54LnfNR2u
pnZRNZ7czfB/vtymUJ6/y8dLYTmnzMFFYy416FOmvr4NqLBkaMWg9xp+KeR30044
AicCAwEAAaNjMGEwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYD
VR0OBBYEFBdb6+h+Qq5vXUWo99QbatQTX6u+MB8GA1UdIwQYMBaAFBdb6+h+Qq5v
XUWo99QbatQTX6u+MA0GCSqGSIb3DQEBCwUAA4IBAQArhp0KXfJHEhVcUXqYYjdn
pZQjq3+0aKjMjgnVWekxwwBARh4ycy2e7066ru1eDZr6myGYK+/vjXituWtq7/c/
Fifezgje6o9lB1TPamgQeE8slqqAgc3OxTqbAAf+rxJelcI6aOm7tqX04k8Aiuhm
dr64cM/NsZTKUbrCHCVNHPNj8wWkrb9pbXH/q0+Gt/gw4MiL6p1YuSr4SIENqDpP
VFiOCcbOSiw5OHPe/VwLts/g3e3NSXqd53nQW1/CgpSBdT73oWw+SBfv21KuJN5K
745S8d9JfbLItWgM73o94MSLOpUEl2F7qqXj2eOBEYWIMbRjMMZ7Vzmuo5wo3M8i
-----END CERTIFICATE-----`

// ProductionRootCerts are the root CA certificates for the production VPC.
// During rotation multiple certificates are expected in the PEM blob.
const ProductionRootCerts = `Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            bd:4c:43:70:b7:ec:0b:86:3b:c8:05:a9:f8:6a:6f:d1
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: DC=io, DC=kbfs.keybase, CN=Keybase KBFS CA prod
        Validity
            Not Before: Nov  8 23:37:01 2015 GMT
            Not After : Nov  7 23:37:01 2017 GMT
        Subject: DC=io, DC=kbfs.keybase, CN=Keybase KBFS CA prod
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
            RSA Public Key: (2048 bit)
                Modulus (2048 bit):
                    00:ab:f6:db:53:cc:bd:3d:de:33:ed:5a:cb:73:59:
                    1d:7d:aa:f2:e9:ad:de:fb:f0:02:ea:4a:16:58:66:
                    e8:21:b9:73:d4:2e:03:9c:93:80:10:5b:6e:ef:96:
                    9d:67:63:cf:bb:b0:19:d6:82:cb:73:2f:a1:af:75:
                    34:14:eb:57:b7:e3:23:9e:00:56:32:2a:85:8f:14:
                    7c:9e:a3:f8:35:cb:e2:c0:36:02:dd:2d:b7:8e:6a:
                    d3:a5:5b:23:36:b1:bf:df:d0:ad:d2:2a:9b:ac:a7:
                    ff:49:d3:29:69:0f:29:28:f7:b3:00:23:6f:2c:a7:
                    05:f5:77:b2:ff:aa:50:d5:ea:bc:9c:7b:81:ab:cc:
                    49:69:dc:9f:23:dd:36:77:72:3b:b9:ac:49:5d:9f:
                    c0:52:9c:b6:30:8b:fd:bf:49:cf:77:1b:08:64:8c:
                    8d:37:31:9b:ee:59:a2:50:5d:08:d3:30:02:d5:cf:
                    1e:60:17:3b:21:53:29:95:e3:2a:c9:7d:06:e6:05:
                    3c:0e:0d:fd:72:b9:cb:10:36:b5:83:88:a5:9c:15:
                    77:b9:75:1f:01:58:16:46:ee:5b:25:65:e1:98:68:
                    74:3a:95:cd:d3:80:6c:1a:3e:86:e9:69:9a:73:54:
                    4b:77:0a:b6:fd:1c:0b:93:56:5f:3f:62:79:70:d9:
                    7b:f3
                Exponent: 65537 (0x10001)
        X509v3 extensions:
            X509v3 Basic Constraints: critical
                CA:TRUE
            X509v3 Key Usage: critical
                Certificate Sign, CRL Sign
            X509v3 Subject Key Identifier: 
                A0:F4:06:24:A3:C2:2A:0B:08:36:6B:06:4E:64:EE:93:5B:E2:13:B2
            X509v3 Authority Key Identifier: 
                keyid:A0:F4:06:24:A3:C2:2A:0B:08:36:6B:06:4E:64:EE:93:5B:E2:13:B2

    Signature Algorithm: sha256WithRSAEncryption
        00:9d:a8:3a:56:3e:0c:20:d6:af:bd:e6:4e:b4:77:29:fc:7e:
        6c:3c:ef:53:52:19:be:22:8a:a2:81:86:3e:31:be:6a:97:33:
        e6:b5:a8:2a:18:e4:3b:9f:77:39:10:ab:ca:00:2f:21:39:c0:
        23:8b:f6:11:a8:9c:87:6c:d8:7d:69:0e:9c:22:36:61:8b:d5:
        0a:14:74:4d:22:5f:6b:6f:a0:c5:91:54:ab:14:5b:eb:cc:cc:
        81:c4:f1:19:94:d9:52:89:c4:5f:89:c2:26:39:2b:4b:1d:cc:
        01:36:64:15:62:43:3c:f5:5c:8b:aa:3c:ed:56:e9:9c:a3:9c:
        de:67:a9:de:2d:6c:dc:2b:f0:d0:63:07:3f:ec:95:83:0f:18:
        d0:1a:57:20:8e:61:19:b0:8e:0e:6a:21:77:69:9d:83:68:23:
        94:e5:41:09:f4:c4:01:ee:dc:81:4c:7d:fe:5a:da:43:05:2e:
        ad:48:c3:3b:78:39:e0:d6:68:fe:97:28:73:d9:28:21:6f:80:
        8b:eb:1a:17:98:00:52:71:64:a8:03:ae:13:0d:32:e0:5c:73:
        af:da:70:f6:76:8a:17:72:8c:94:42:5f:e8:28:83:27:8c:6c:
        a4:dc:cf:64:5b:a9:b9:ea:4a:8a:d4:6b:96:bc:e8:7d:8b:96:
        39:78:19:03
-----BEGIN CERTIFICATE-----
MIIDkDCCAnigAwIBAgIRAL1MQ3C37AuGO8gFqfhqb9EwDQYJKoZIhvcNAQELBQAw
UTESMBAGCgmSJomT8ixkARkWAmlvMRwwGgYKCZImiZPyLGQBGRYMa2Jmcy5rZXli
YXNlMR0wGwYDVQQDDBRLZXliYXNlIEtCRlMgQ0EgcHJvZDAeFw0xNTExMDgyMzM3
MDFaFw0xNzExMDcyMzM3MDFaMFExEjAQBgoJkiaJk/IsZAEZFgJpbzEcMBoGCgmS
JomT8ixkARkWDGtiZnMua2V5YmFzZTEdMBsGA1UEAwwUS2V5YmFzZSBLQkZTIENB
IHByb2QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCr9ttTzL093jPt
WstzWR19qvLprd778ALqShZYZughuXPULgOck4AQW27vlp1nY8+7sBnWgstzL6Gv
dTQU61e34yOeAFYyKoWPFHyeo/g1y+LANgLdLbeOatOlWyM2sb/f0K3SKpusp/9J
0ylpDyko97MAI28spwX1d7L/qlDV6ryce4GrzElp3J8j3TZ3cju5rEldn8BSnLYw
i/2/Sc93GwhkjI03MZvuWaJQXQjTMALVzx5gFzshUymV4yrJfQbmBTwODf1yucsQ
NrWDiKWcFXe5dR8BWBZG7lslZeGYaHQ6lc3TgGwaPobpaZpzVEt3Crb9HAuTVl8/
Ynlw2XvzAgMBAAGjYzBhMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEG
MB0GA1UdDgQWBBSg9AYko8IqCwg2awZOZO6TW+ITsjAfBgNVHSMEGDAWgBSg9AYk
o8IqCwg2awZOZO6TW+ITsjANBgkqhkiG9w0BAQsFAAOCAQEAAJ2oOlY+DCDWr73m
TrR3Kfx+bDzvU1IZviKKooGGPjG+apcz5rWoKhjkO593ORCrygAvITnAI4v2Eaic
h2zYfWkOnCI2YYvVChR0TSJfa2+gxZFUqxRb68zMgcTxGZTZUonEX4nCJjkrSx3M
ATZkFWJDPPVci6o87VbpnKOc3mep3i1s3Cvw0GMHP+yVgw8Y0BpXII5hGbCODmoh
d2mdg2gjlOVBCfTEAe7cgUx9/lraQwUurUjDO3g54NZo/pcoc9koIW+Ai+saF5gA
UnFkqAOuEw0y4Fxzr9pw9naKF3KMlEJf6CiDJ4xspNzPZFupuepKitRrlrzofYuW
OXgZAw==
-----END CERTIFICATE-----`

const (
	// EnvTestRootCertPEM is the environment variable name for the
	// CA cert PEM the client uses to verify the KBFS servers when
	// testing. Any certificate present here overrides any
	// certificate inferred from a server address.
	EnvTestRootCertPEM = "KEYBASE_TEST_ROOT_CERT_PEM"
)

// GetRootCerts returns a byte array with the appropriate root certs
// for the given host:port string.
func GetRootCerts(serverAddr string) []byte {
	// Use the environment variable, if set.
	envTestRootCert := os.Getenv(EnvTestRootCertPEM)
	if len(envTestRootCert) != 0 {
		return []byte(envTestRootCert)
	}

	if host, _, err := net.SplitHostPort(serverAddr); err == nil {
		if strings.HasSuffix(host, "dev.keybase.io") {
			return []byte(DevRootCerts)
		}
		if strings.HasSuffix(host, "kbfs.keybase.io") ||
			strings.HasSuffix(host, "core.keybase.io") {
			return []byte(ProductionRootCerts)
		}
	}

	// Fall back to the test cert.
	return []byte(TestRootCert)
}
