package libkb_test

import (
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := libkb.ProxyTypeStrToEnum["socks"]
	require.Equal(t, libkb.Socks, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = libkb.ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, libkb.HTTP_Connect, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = libkb.ProxyTypeStrToEnum["bogus"]
	require.Equal(t, false, ok)
}

func TestEnableProxy(t *testing.T) {
	require.Equal(t, "", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "", os.Getenv("HTTPS_PROXY"))

	e := libkb.EnableProxy(libkb.No_Proxy, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "", os.Getenv("HTTPS_PROXY"))

	e = libkb.EnableProxy(libkb.Socks, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "socks5://localhost:8090", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "socks5://localhost:8090", os.Getenv("HTTPS_PROXY"))

	e = libkb.EnableProxy(libkb.HTTP_Connect, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "localhost:8090", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "localhost:8090", os.Getenv("HTTPS_PROXY"))
}

func TestGetProxyType(t *testing.T) {

}