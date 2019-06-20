package libkb

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := ProxyTypeStrToEnum["socks"]
	require.Equal(t, Socks, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, HTTPConnect, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["bogus"]
	require.Equal(t, false, ok)
}

func TestMakeProxy(t *testing.T) {
	resetGlobals()
	mockedEnv := NewEnv(MockedConfigReader{}, MockedConfigReader{}, makeLogGetter(t))

	require.Equal(t, NoProxy, mockedEnv.GetProxyType())
	require.Equal(t, "", mockedEnv.GetProxy())
	f := MakeProxy(mockedEnv)
	retURL, err := f(nil)

	// A nil retURL means no proxy
	require.Equal(t, (*url.URL)(nil), retURL)
	require.Equal(t, nil, err)

	globalProxyType = "Socks"
	require.Equal(t, Socks, mockedEnv.GetProxyType())
	globalProxyAddress = "localhost:8090"
	require.Equal(t, "localhost:8090", mockedEnv.GetProxy())
	f = MakeProxy(mockedEnv)
	retURL, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "socks5://localhost:8090", retURL.String())

	globalProxyType = "http_connect"
	require.Equal(t, HTTPConnect, mockedEnv.GetProxyType())
	f = MakeProxy(mockedEnv)
	retURL, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "http://localhost:8090", retURL.String())
}
