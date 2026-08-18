package libkb

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := ProxyTypeStrToEnum["socks"]
	require.Equal(t, Socks, proxyType)
	require.True(t, ok)

	proxyType, ok = ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, HTTPConnect, proxyType)
	require.True(t, ok)

	_, ok = ProxyTypeStrToEnum["bogus"]
	require.False(t, ok)
}

func TestMakeProxy(t *testing.T) {
	resetGlobals()
	mockedEnv := NewEnv(MockedConfigReader{}, MockedConfigReader{}, makeLogGetter(t))

	require.Equal(t, NoProxy, mockedEnv.GetProxyType())
	require.Empty(t, mockedEnv.GetProxy())
	f := MakeProxy(mockedEnv)
	retURL, err := f(nil)

	// A nil retURL means no proxy
	require.Equal(t, (*url.URL)(nil), retURL)
	require.NoError(t, err)

	globalProxyType = "Socks"
	require.Equal(t, Socks, mockedEnv.GetProxyType())
	globalProxyAddress = "localhost:8090"
	require.Equal(t, "localhost:8090", mockedEnv.GetProxy())
	f = MakeProxy(mockedEnv)
	retURL, err = f(nil)
	require.NoError(t, err)
	require.Equal(t, "socks5://localhost:8090", retURL.String())

	globalProxyType = "http_connect"
	require.Equal(t, HTTPConnect, mockedEnv.GetProxyType())
	f = MakeProxy(mockedEnv)
	retURL, err = f(nil)
	require.NoError(t, err)
	require.Equal(t, "http://localhost:8090", retURL.String())
}
