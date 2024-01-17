// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"net/http"
	"testing"
	"time"

	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPClient(t *testing.T) {
	req, err := http.NewRequest("GET", "https://api-1.core.keybaseapi.com/_/api/1.0/user/lookup.json?github=gabriel", nil)
	require.NoError(t, err)
	client, err := httpClient(time.Minute)
	require.NoError(t, err)
	resp, err := client.Do(req)
	defer util.DiscardAndCloseBodyIgnoreError(resp)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestHTTPClientWithOtherCert(t *testing.T) {
	otherCert := `-----BEGIN CERTIFICATE-----
MIIHgzCCBmugAwIBAgIIM0yeg6/uf0swDQYJKoZIhvcNAQEFBQAwSTELMAkGA1UE
BhMCVVMxEzARBgNVBAoTCkdvb2dsZSBJbmMxJTAjBgNVBAMTHEdvb2dsZSBJbnRl
cm5ldCBBdXRob3JpdHkgRzIwHhcNMTUwMjExMTIwNzIzWhcNMTUwNTEyMDAwMDAw
WjBmMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwN
TW91bnRhaW4gVmlldzETMBEGA1UECgwKR29vZ2xlIEluYzEVMBMGA1UEAwwMKi5n
b29nbGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxHRttIni
mH4jfS8UAj/JdFvNCq1e9Fq/25aVhGQTgbdB3rR78Xg9BI7KCc9THq55VNXoovSS
3GE+mnUura7yd1e7JRhZJDcB/ybMuxcYpwZhZoOPxD12mmflZYMj5/ucgza6ahTX
WfSlNxHno7Ktc/Qv/tC6vDF8lKU7u+xGtJatA7bKYvoSFTQHBLIxLYT+zfuzlqEM
mXY7qoIanWuDTMKRWiBDkPxIjKMbHUBXYINvXciG2R41962JbV/T/pkk9oW4+XcI
r2DOh2vDyzHN9Eg/dTS1h4XdRQ3MnTZjQOCbyfgo/bUAzRMsPnLzK6XeRFR1DfUo
uoJNi6ikD0PGjQIDAQABo4IEUDCCBEwwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsG
AQUFBwMCMIIDJgYDVR0RBIIDHTCCAxmCDCouZ29vZ2xlLmNvbYINKi5hbmRyb2lk
LmNvbYIWKi5hcHBlbmdpbmUuZ29vZ2xlLmNvbYISKi5jbG91ZC5nb29nbGUuY29t
ghYqLmdvb2dsZS1hbmFseXRpY3MuY29tggsqLmdvb2dsZS5jYYILKi5nb29nbGUu
Y2yCDiouZ29vZ2xlLmNvLmlugg4qLmdvb2dsZS5jby5qcIIOKi5nb29nbGUuY28u
dWuCDyouZ29vZ2xlLmNvbS5hcoIPKi5nb29nbGUuY29tLmF1gg8qLmdvb2dsZS5j
b20uYnKCDyouZ29vZ2xlLmNvbS5jb4IPKi5nb29nbGUuY29tLm14gg8qLmdvb2ds
ZS5jb20udHKCDyouZ29vZ2xlLmNvbS52boILKi5nb29nbGUuZGWCCyouZ29vZ2xl
LmVzggsqLmdvb2dsZS5mcoILKi5nb29nbGUuaHWCCyouZ29vZ2xlLml0ggsqLmdv
b2dsZS5ubIILKi5nb29nbGUucGyCCyouZ29vZ2xlLnB0ghIqLmdvb2dsZWFkYXBp
cy5jb22CDyouZ29vZ2xlYXBpcy5jboIUKi5nb29nbGVjb21tZXJjZS5jb22CESou
Z29vZ2xldmlkZW8uY29tggwqLmdzdGF0aWMuY26CDSouZ3N0YXRpYy5jb22CCiou
Z3Z0MS5jb22CCiouZ3Z0Mi5jb22CFCoubWV0cmljLmdzdGF0aWMuY29tggwqLnVy
Y2hpbi5jb22CECoudXJsLmdvb2dsZS5jb22CFioueW91dHViZS1ub2Nvb2tpZS5j
b22CDSoueW91dHViZS5jb22CFioueW91dHViZWVkdWNhdGlvbi5jb22CCyoueXRp
bWcuY29tggthbmRyb2lkLmNvbYIEZy5jb4IGZ29vLmdsghRnb29nbGUtYW5hbHl0
aWNzLmNvbYIKZ29vZ2xlLmNvbYISZ29vZ2xlY29tbWVyY2UuY29tggp1cmNoaW4u
Y29tggh5b3V0dS5iZYILeW91dHViZS5jb22CFHlvdXR1YmVlZHVjYXRpb24uY29t
MGgGCCsGAQUFBwEBBFwwWjArBggrBgEFBQcwAoYfaHR0cDovL3BraS5nb29nbGUu
Y29tL0dJQUcyLmNydDArBggrBgEFBQcwAYYfaHR0cDovL2NsaWVudHMxLmdvb2ds
ZS5jb20vb2NzcDAdBgNVHQ4EFgQUdPnb3QnnxO5TWnRfHV+VMTczAk8wDAYDVR0T
AQH/BAIwADAfBgNVHSMEGDAWgBRK3QYWG7z2aLV29YG2u2IaulqBLzAXBgNVHSAE
EDAOMAwGCisGAQQB1nkCBQEwMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL3BraS5n
b29nbGUuY29tL0dJQUcyLmNybDANBgkqhkiG9w0BAQUFAAOCAQEAOXT8s6bpqgKy
VTPw0oQMTdIyE8Q9RN1Tsrl9UfF4tELCW+WaEzhtgSpzVcMYJZQOK7Nc2feG0oxs
L6BmChjtD10HVO7GPfsIkg52TBmDV1kBiJlfT3DtJvUcO4HN/4wCyCVQUEWd+YpK
nwWmpXUuNO4qoX0H8QgTiPNu/rmNlYanXmQmn+KsJenf5qgnmFMVFk+86MeWPbRs
KRX1qernJeMz9dsC7h7jGAYfKMQ+LHyAEPNNwyFL8HxrcuQAf9vO1caj27xgBDNl
tUa2UA5ETydhoj3BcgHJoiP7m+GZABeyaFwtuf4fD2Dm8FtG1owFubUkGo8Bulv4
OtWvrDGSUA==
-----END CERTIFICATE-----`

	req, err := http.NewRequest("GET", "https://api-1.core.keybaseapi.com/_/api/1.0/user/lookup.json?github=gabriel", nil)
	require.NoError(t, err)
	client, err := httpClientWithCert(otherCert, time.Minute)
	require.NoError(t, err)
	resp, err := client.Do(req)
	defer util.DiscardAndCloseBodyIgnoreError(resp)
	require.ErrorContains(t, err, "x509: certificate signed by unknown authority")
}
