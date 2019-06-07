package libkb

import (
	"net/url"
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

func TestMakeProxy(t *testing.T) {
	f := MakeProxy(noProxy, "localhost:8090")
	retUrl, err := f(nil)

	// A nil retUrl means no proxy
	require.Equal(t, (*url.URL)(nil), retUrl)
	require.Equal(t, nil, err)

	f = MakeProxy(socks, "localhost:8090")
	retUrl, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "socks5://localhost:8090", retUrl.String())

	f = MakeProxy(httpConnect, "localhost:8090")
	retUrl, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "localhost:8090", retUrl.String())
}
