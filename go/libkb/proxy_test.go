package libkb

import (
	"github.com/stretchr/testify/require"
	"net/url"
	"testing"
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

//func TestDworken1(t *testing.T) {
//	registerHTTPConnectProxies()
//
//	u, err := url.Parse("http://127.0.0.1:8080")
//	if err != nil {
//		panic(err)
//	}
//	dialer, err := proxy.FromURL(u, proxy.Direct)
//	if err != nil {
//		panic(err)
//	}
//	httpClient := &http.Client{Transport: &http.Transport{Dial: dialer.Dial}}
//	req, err := http.NewRequest("GET", "http://icanhazip.com/", nil)
//	if err != nil {
//		panic(err)
//	}
//	resp, err := httpClient.Do(req)
//	if err != nil {
//		panic(err)
//	}
//	fmt.Printf("Status code=%d\n", resp.StatusCode)
//	defer resp.Body.Close()
//	b, err := ioutil.ReadAll(resp.Body)
//	if err != nil {
//		panic(err)
//	}
//	fmt.Println(string(b))
//}
//
//func TestDworken2(t *testing.T) {
//	resetGlobals()
//	registerHTTPConnectProxies()
//
//	mockedEnv := NewEnv(MockedConfigReader{}, MockedConfigReader{}, makeLogGetter(t))
//	globalProxyAddress = "127.0.0.1:8080"
//	globalProxyType = "http_connect"
//
//	conn, err := ProxyDial(mockedEnv, "tcp", "icanhazip.com:80")
//	if err != nil {
//		panic(err)
//	}
//
//	req, err := http.NewRequest("GET", "http://icanhazip.com", nil)
//	if err != nil {
//		panic(err)
//	}
//	err = req.Write(conn)
//	if err != nil {
//		panic(err)
//	}
//
//	resp, err := http.ReadResponse(bufio.NewReader(conn), req)
//	if err != nil {
//		panic(err)
//	}
//	fmt.Printf("Status code=%d\n", resp.StatusCode)
//	defer resp.Body.Close()
//
//	b, err := ioutil.ReadAll(resp.Body)
//	if err != nil {
//		panic(err)
//	}
//	fmt.Println(string(b))
//}
//
//func TestDworken3(t *testing.T) {
//	resetGlobals()
//	registerHTTPConnectProxies()
//
//	mockedEnv := NewEnv(MockedConfigReader{}, MockedConfigReader{}, makeLogGetter(t))
//	globalProxyAddress = "127.0.0.1:8080"
//	globalProxyType = "http_connect"
//
//	conn, err := ProxyDialTimeout(mockedEnv, "tcp", "icanhazip.com:80", 1 * time.Hour)
//	if err != nil {
//		panic(err)
//	}
//
//	req, err := http.NewRequest("GET", "http://icanhazip.com", nil)
//	if err != nil {
//		panic(err)
//	}
//	err = req.Write(conn)
//	if err != nil {
//		panic(err)
//	}
//
//	resp, err := http.ReadResponse(bufio.NewReader(conn), req)
//	if err != nil {
//		panic(err)
//	}
//	fmt.Printf("Status code=%d\n", resp.StatusCode)
//	defer resp.Body.Close()
//
//	b, err := ioutil.ReadAll(resp.Body)
//	if err != nil {
//		panic(err)
//	}
//	fmt.Println(string(b))
//}
//func TestDworken4(t *testing.T) {
//	resetGlobals()
//	registerHTTPConnectProxies()
//
//	mockedEnv := NewEnv(MockedConfigReader{}, MockedConfigReader{}, makeLogGetter(t))
//	globalProxyAddress = "127.0.0.1:8080"
//	globalProxyType = "http_connect"
//
//	_, err := ProxyDialTimeout(mockedEnv, "tcp", "icanhazip.com:80", 1)
//	require.NotEqual(t, nil, err, "It should timeout")
//}
