package libkb

import (
	"net/url"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyTypeStrToEnum(t *testing.T) {
	proxyType, ok := ProxyTypeStrToEnum["socks"]
	require.Equal(t, Socks, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["http_connect"]
	require.Equal(t, HttpConnect, proxyType)
	require.Equal(t, true, ok)

	proxyType, ok = ProxyTypeStrToEnum["bogus"]
	require.Equal(t, false, ok)
}

func TestMakeProxy(t *testing.T) {
	resetGlobals()
	os.Clearenv()
	mocked_env := NewEnv(MockedConfigReader{}, MockedConfigReader{}, makeLogGetter(t))

	require.Equal(t, NoProxy, mocked_env.GetProxyType())
	require.Equal(t, "", mocked_env.GetProxy())
	f := MakeProxy(mocked_env)
	retURL, err := f(nil)

	// A nil retURL means no proxy
	require.Equal(t, (*url.URL)(nil), retURL)
	require.Equal(t, nil, err)

	globalProxyType = "Socks"
	require.Equal(t, Socks, mocked_env.GetProxyType())
	globalProxyAddress = "localhost:8090"
	require.Equal(t, "localhost:8090", mocked_env.GetProxy())
	f = MakeProxy(mocked_env)
	retURL, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "socks5://localhost:8090", retURL.String())

	globalProxyType = "http_connect"
	require.Equal(t, HttpConnect, mocked_env.GetProxyType())
	f = MakeProxy(mocked_env)
	retURL, err = f(nil)
	require.Equal(t, nil, err)
	require.Equal(t, "localhost:8090", retURL.String())
}
