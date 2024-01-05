// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"time"
)

const caCert = `-----BEGIN CERTIFICATE-----
MIIGIzCCBAugAwIBAgIJAPzhpcIBaOeNMA0GCSqGSIb3DQEBCwUAMIGMMQswCQYD
VQQGEwJVUzELMAkGA1UECBMCTlkxETAPBgNVBAcTCE5ldyBZb3JrMRQwEgYDVQQK
EwtLZXliYXNlIExMQzEXMBUGA1UECxMOQ2VydCBBdXRob3JpdHkxLjAsBgNVBAMM
JWtleWJhc2UuaW8vZW1haWxBZGRyZXNzPWNhQGtleWJhc2UuaW8wIBcNMjMxMjMx
MTkwMzE5WhgPNjAyMzEyMzExOTAzMTlaMIGMMQswCQYDVQQGEwJVUzELMAkGA1UE
CBMCTlkxETAPBgNVBAcTCE5ldyBZb3JrMRQwEgYDVQQKEwtLZXliYXNlIExMQzEX
MBUGA1UECxMOQ2VydCBBdXRob3JpdHkxLjAsBgNVBAMMJWtleWJhc2UuaW8vZW1h
aWxBZGRyZXNzPWNhQGtleWJhc2UuaW8wggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAw
ggIKAoICAQDewsDpkby46+aUW8UtUg5RGZxCtnIwUptW739N4OJ6aWzfDf8nNVN2
4P7sqJSL1HtBwJb9XVmlF5N+6ebut8AKInV+kiSNJCuCy8oMuCEjPEhLkUwjy616
3mnpC24mFoDCaZefzFfTkW+pY1utxdF2kviCgV2KA+wUrbGFNSJZq0syy16hKEjv
7OauCTHvkt4swPRsva45/zsmM7NtjzHaxQhksbA+gBPIbxZLfx7LoqQnFGMCEben
45NgSNhKuwC1ADoiZt4Ol9Ico4HwcXedWn/8RvgcSISxbAFFtBe8BaHcNgsa6QVb
TCI7QdUKhZj5scv8yprQ11EY6UuxsvhnikuuGoqBINTy6Zf1i41FFoHQ/mdOTPJT
prEerOr33QZ6n8jrZuOwF1hin4ONI8rjeZdGt9YmXY1NyXzEoDJ+w5b72FD2/ArS
2lKJw3F9i5RmzQGF+NJn9NzpnURF2BRhGJdO2iGX5JEDYiBkyWgcKWVUw2MSNeGC
68eAsA6ty7KFUG6mJRAZQdC+QyyvVTPxU80MU4l53C5xFTYBpHzzVuSedJt2z37M
0uy9QVX4ErtB2e39aQWlgvvysbBjjuayL06h13Hp8/J6DeqQkYzpzCf9ujLD2VB6
V5gOryTIl2LEgDG0CyQ3NE8nicO7aLNN8HJCgzx6nABZuhz+A0U5swIDAQABo4GD
MIGAMA4GA1UdDwEB/wQEAwIChDAdBgNVHSUEFjAUBggrBgEFBQcDAgYIKwYBBQUH
AwEwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQURqpATOw1gVVrzlqqFKbkfaKX
vwowHwYDVR0jBBgwFoAURqpATOw1gVVrzlqqFKbkfaKXvwowDQYJKoZIhvcNAQEL
BQADggIBALjuBecPwt0XJ6rpygOt9r1O6Oyj6WshzD2OvsK/RoHCJLjI32V8xYt3
YubUdFucy5m6dUEeTo6LwDd/7UpX+7NImQdRssHk6GynJJ7Sd2Jqvzlh6t+xFJHG
WqRt/u48T9Bm7pw1Z79QAXXi1L9DnPz8nMzu6gVTS2dzG4FAjXwzKsYV6mLoQW0L
adLKQELboM5hCauSILncD9ujWBZduFr7o4eHrRaZ4FiZ/46nGn/lqDhFTtgvSL53
+thrAiQCVv7sGkg8Niu3WTuJtIDlXzjGFuGli/l9KI9Dnr+RBe1kileQ99VZmayA
PgVFzkicAEd5ZzGnADGWAW0nSA8tOxAyo3qnnJ6Z1e2mNflmGv6+cryIkksfDu7A
oQuFQW0E3wEDmBXFHAGWgNKZQ05nxPY6zDm3FQCzS3v6CZuyJ8iwpDTKZYp4azPb
WLef0IJCGB62/+6YwD3bUunFq6jUR/vCgc5WRrLQd4LAbrrrP8SaLNPIlapZkYIU
Ba88Cg+nfTa7s0ETEJDNV+UyEoZbAMhcjCbua+aMx66WA+iinmZ++ilXxlBPNyFM
XNpVqc8i9YuN5ASXKwR0nna/vFyr2sFYhV/Q+QIBUh6bwZEFF9f3qtgxi908ZSEC
ip88muP7dUJ5jR/XrBLdYqrnMFym5dyHN7AjBdTwjSkTtFKHjAxb
-----END CERTIFICATE-----`

func httpClient(timeout time.Duration) (*http.Client, error) {
	return httpClientWithCert(caCert, timeout)
}

func httpClientWithCert(cert string, timeout time.Duration) (*http.Client, error) {
	certPool := x509.NewCertPool()
	if ok := certPool.AppendCertsFromPEM([]byte(cert)); !ok {
		return nil, fmt.Errorf("Unable to add cert")
	}
	if certPool == nil {
		return nil, fmt.Errorf("No cert pool")
	}
	tlsConfig := &tls.Config{RootCAs: certPool}
	transport := &http.Transport{TLSClientConfig: tlsConfig}
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}, nil
}
