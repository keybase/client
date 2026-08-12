// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/tls"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestIsReddit(t *testing.T) {
	// Test both with and without a subdomain.
	req, _ := http.NewRequest("GET", "http://reddit.com", nil)
	require.True(t, isReddit(req),
		"should be a reddit URL")
	req, _ = http.NewRequest("GET", "http://www.reddit.com", nil)
	require.True(t, isReddit(req),
		"should be a reddit URL")
	// Test a non-reddit URL.
	req, _ = http.NewRequest("GET", "http://github.com", nil)
	require.False(t, isReddit(req),
		"should NOT be a reddit URL")
}

const (
	uriExpected  = "https://api-1.core.keybaseapi.com"
	pingExpected = "https://api-1.core.keybaseapi.com/_/api/1.0/ping.json"
)

func TestProductionCA(t *testing.T) {
	tc := SetupTest(t, "prod_ca", 1)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	t.Log("WARNING: setting run mode to production, be careful:")
	tc.G.Env.Test.UseProductionRunMode = true

	serverURI, err := tc.G.Env.GetServerURI()
	require.NoError(t, err)

	require.Equal(t, uriExpected, serverURI, "production server uri: %s, expected %s", serverURI, uriExpected)

	err = tc.G.ConfigureAPI()
	require.NoError(t, err)

	// make sure endpoint is correct:
	arg := APIArg{Endpoint: "ping"}
	internal, ok := tc.G.API.(*InternalAPIEngine)
	require.True(t, ok,
		"failed to cast API to internal api engine")
	url := internal.getURL(arg, false)
	require.Equal(t, pingExpected, url.String(), "api url: %s, expected %s", url.String(), pingExpected)

	_, err = tc.G.API.Post(mctx, arg)
	require.NoError(t, err)

	_, err = tc.G.API.Get(mctx, arg)
	require.NoError(t, err)
}

func TestProductionBadCA(t *testing.T) {
	tc := SetupTest(t, "prod_ca", 1)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	t.Log("WARNING: setting run mode to production, be careful:")
	tc.G.Env.Test.UseProductionRunMode = true

	serverURI, err := tc.G.Env.GetServerURI()
	require.NoError(t, err)

	require.Equal(t, uriExpected, serverURI, "production server uri: %s, expected %s", serverURI, uriExpected)

	// change the api CA to one that api.keybase.io doesn't know:
	apiCAOverrideForTest = unknownCA
	defer func() {
		apiCAOverrideForTest = ""
	}()

	err = tc.G.ConfigureAPI()
	require.NoError(t, err)

	// make sure endpoint is correct:
	arg := APIArg{Endpoint: "ping"}
	internal, ok := tc.G.API.(*InternalAPIEngine)
	require.True(t, ok,
		"failed to cast API to internal api engine")
	iurl := internal.getURL(arg, false)
	require.Equal(t, pingExpected, iurl.String(), "api url: %s, expected %s", iurl.String(), pingExpected)

	_, err = tc.G.API.Post(mctx, arg)
	require.NotNil(t, err, "api ping POST worked with unknown CA")
	checkX509Err(t, err)

	_, err = tc.G.API.Get(mctx, arg)
	require.NotNil(t, err, "api ping GET worked with unknown CA")
	if err != nil {
		checkX509Err(t, err)
	}
}

// this error is buried, so dig for it:
func checkX509Err(t *testing.T, err error) {
	require.Error(t, err,
		"isX509Err called with nil error")

	a, ok := err.(APINetError)
	require.True(t, ok, "invalid error type: %T, expected libkb.APINetError", err)

	b, ok := a.Err.(*url.Error)
	require.True(t, ok, "APINetError err field type: %T, expected *url.Error", a.Err)

	_, ok = b.Err.(*tls.CertificateVerificationError)
	require.True(t, ok, "url.Error Err field type: %T, expected x509.UnknownAuthorityError", b.Err)
}

const unknownCA = `-----BEGIN CERTIFICATE-----
MIIFgDCCA2gCCQDF4YJuQAWDqTANBgkqhkiG9w0BAQsFADCBgTELMAkGA1UEBhMC
VVMxCzAJBgNVBAgMAk1BMQ8wDQYDVQQHDAZCb3N0b24xEzARBgNVBAoMCkV4YW1w
bGUgQ28xEDAOBgNVBAsMB3RlY2hvcHMxCzAJBgNVBAMMAmNhMSAwHgYJKoZIhvcN
AQkBFhFjZXJ0c0BleGFtcGxlLmNvbTAeFw0xNjAyMjUyMTQ3MzhaFw00MzA3MTIy
MTQ3MzhaMIGBMQswCQYDVQQGEwJVUzELMAkGA1UECAwCTUExDzANBgNVBAcMBkJv
c3RvbjETMBEGA1UECgwKRXhhbXBsZSBDbzEQMA4GA1UECwwHdGVjaG9wczELMAkG
A1UEAwwCY2ExIDAeBgkqhkiG9w0BCQEWEWNlcnRzQGV4YW1wbGUuY29tMIICIjAN
BgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA8NScIAfl3DK26CwnMSH1TXKurE/B
BOocNApkH/913F28AgxzsS+blsG1IyjSuG9ls5shqlGpWQs1kM9PqFz6Yl5Y3H8b
cwY0dWk1RmrZ6EWV/lWuLZxiKB8rBJksUVvdcuhnNpvOjYvkTgL9q7OObMdz3lvH
2pqwa8TWgw9EITKCam7i4860qcOoVkhCFitrihg182UmXWmuAZOm5N0R9+Y5t8yQ
7S3XKYZLtKND7ZGD51AfjN6TN1jN8kd9KMii7JITtvqsJDOxl0Kzn9fefgnCQF1G
P7ilLybId4W5pCO/8mKXb0CQlJ9kAYVfxWPNR87ZQA9KLC8nXu3xWaplXZl7T4Tq
wZHD85lbpLurSkJliizwDgs3cootEXs04ssl6SpVnc/Qxat3jomCtmKBtY5Cxvy9
IwHmaYWCYAIiPcru8U1cVg3xsH6i2JTz7uZRFvEjhYNqr1o6QnKcJ6cYGs13tYwA
57Xl1CVJ8hBMmtlzqbA2xMCbmkpWitjzXyArzQjAD0dDeGmStGOOQqy/N4LJaQ6+
+q2bHpx5Cd6DxNf868iWupuKadT923ZDzAn1PhDWugKQ2BSIzM2O57m1HYmGm3be
NpwTYKuZGCDaLwDhnbIICTgQXjyCDTV4TfOKBPzr+i+yAjdjJimXHQ5gy7BMJoO6
fOWYqbs8vgvx4WUCAwEAATANBgkqhkiG9w0BAQsFAAOCAgEAhLLxyfdQdQDdo3YG
s1fKqm5lLu0Dx6uzNtIVY0n7vyyAolBVDlJ7Du84b344/U4kRgjNwAx2ZECvWkEZ
ov6+VMYX6EkV/0nwRNOoADYO8YVlZzBvwZgA12Vkw9NHje18FnQcS3L4nFjJPFoY
UEBhK5qTXqxJ9PK9aBZXIhDT2u/o9xEecuC3kjqNI6bi5zsZ5y04Qulr/1UwWy2e
IFFfySdL7kzZkhQAawg/+pNgentVykRRNgCVmFQ4uytTpp45pAtSNBaLm8RCrNGF
AybVh7HAW+LwjUOPpYQ38j1neiFS8NFJRKNKS2OtbS743NnYWbYOJdGWH4jwOluL
PjckYdTGO82EIjxcGXIF5UPw6W3ozwCqGgO1bCY8tgcjoUPm3hUrTzZ5ueXRUkNI
qwPrmvpLUtJjI7prCAsi3gDoL/+t7LNEAYPYreRc+LdvJTRj90WwWCdXTHfSMVjt
NN9Mt339LkwXGCb6CavmDgE7oVbrFPSTbeFFPhaheQh7pjLFhl9ZBfE7g3d9oNOX
PmyY3I0kAE41RiDMrrxHO3tHv9IaQUUDDcGzIWFJlnbvQRXAsWf/HH56Q0eIAZZp
K++p6Mo0K+KCu0IwKwdcTYKqty6xefK83p0j/IWVW29Lka44f+ZAroUlBn1+W4GO
sB31+boS8zC7SOmgWuaHeOQdLT8=
-----END CERTIFICATE-----
`

type DummyConfigReader struct {
	NullConfiguration
}

var _ ConfigReader = (*DummyConfigReader)(nil)

func (r *DummyConfigReader) GetDeviceID() keybase1.DeviceID {
	return "dummy-device-id"
}

type DummyUpdaterConfigReader struct{}

var _ UpdaterConfigReader = (*DummyUpdaterConfigReader)(nil)

func (r *DummyUpdaterConfigReader) GetInstallID() InstallID {
	return "dummy-install-id"
}

func TestInstallIDHeaders(t *testing.T) {
	tc := SetupTest(t, "test", 1)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	// Hack in the device ID and install ID with dummy readers.
	tc.G.Env.config = &DummyConfigReader{}
	tc.G.Env.updaterConfig = &DummyUpdaterConfigReader{}

	api, err := NewInternalAPIEngine(tc.G)
	require.NoError(t, err)
	res, err := api.Get(mctx, APIArg{
		Endpoint:    "pkg/show",
		SessionType: APISessionTypeOPTIONAL,
		Args:        HTTPArgs{},
	})
	require.NoError(t, err)

	deviceID, err := res.Body.AtKey("device_id").GetString()
	require.NoError(t, err)
	require.Equal(t, "dummy-device-id", deviceID, "expected device ID to be reflected back, got %s", res.Body.MarshalPretty())

	installID, err := res.Body.AtKey("install_id").GetString()
	require.NoError(t, err)
	require.Equal(t, "dummy-install-id", installID, "expected install ID to be reflected back, got %s", res.Body.MarshalPretty())
}

func TestInstallIDHeadersAnon(t *testing.T) {
	tc := SetupTest(t, "test", 1)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	// Hack in the device ID and install ID with dummy readers.
	tc.G.Env.config = &DummyConfigReader{}
	tc.G.Env.updaterConfig = &DummyUpdaterConfigReader{}

	api, err := NewInternalAPIEngine(tc.G)
	require.NoError(t, err)
	res, err := api.Get(mctx, APIArg{
		Endpoint:    "pkg/show",
		SessionType: APISessionTypeNONE,
		Args:        HTTPArgs{},
	})
	require.NoError(t, err)

	_, err = res.Body.AtKey("device_id").GetString()
	require.Error(t, err,
		"Device ID should not be here")

	_, err = res.Body.AtKey("install_id").GetString()
	require.Error(t, err,
		"Install ID should not be here")
}
