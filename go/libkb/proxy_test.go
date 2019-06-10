package libkb

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := ProxyTypeStrToEnum["Socks"]
	require.Equal(t, Socks, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, HttpConnect, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["bogus"]
	require.Equal(t, false, ok)
}

func TestMakeProxy(t *testing.T) {
	f := MakeProxy(NoProxy, "localhost:8090")
	retURL, err := f(nil)

	// A nil retURL means no proxy
	require.Equal(t, (*url.URL)(nil), retURL)
	require.Equal(t, nil, err)

	f = MakeProxy(Socks, "localhost:8090")
	retURL, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "socks5://localhost:8090", retURL.String())

	f = MakeProxy(HttpConnect, "localhost:8090")
	retURL, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "localhost:8090", retURL.String())
}
