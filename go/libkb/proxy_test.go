package libkb

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := ProxyTypeStrToEnum["socks"]
	require.Equal(t, socks, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, httpConnect, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["bogus"]
	require.Equal(t, false, ok)
}

func TestEnableProxy(t *testing.T) {
	require.Equal(t, "", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "", os.Getenv("HTTPS_PROXY"))

	e := EnableProxy(noProxy, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "", os.Getenv("HTTPS_PROXY"))

	e = EnableProxy(socks, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "socks5://localhost:8090", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "socks5://localhost:8090", os.Getenv("HTTPS_PROXY"))

	e = EnableProxy(httpConnect, "localhost:8090")
	require.Equal(t, nil, e)
	require.Equal(t, "localhost:8090", os.Getenv("HTTP_PROXY"))
	require.Equal(t, "localhost:8090", os.Getenv("HTTPS_PROXY"))
}
