package libkb

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := ProxyTypeStrToEnum["socks"]
	require.Equal(t, Socks, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, HTTP_Connect, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["bogus"]
	require.Equal(t, false, ok)
}

func TestEnableProxy(t *testing.T) {
	require.Equal(t, "", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "", os.Getenv("HTTPS_PROXY"))

	e := EnableProxy(No_Proxy, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "", os.Getenv("HTTPS_PROXY"))

	e = EnableProxy(Socks, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "socks5://localhost:8090", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "socks5://localhost:8090", os.Getenv("HTTPS_PROXY"))

	e = EnableProxy(HTTP_Connect, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "localhost:8090", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "localhost:8090", os.Getenv("HTTPS_PROXY"))
}
