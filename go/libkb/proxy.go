/*

Proxy support is implemented using golang's http library's built in support for proxies. This supports http connect
based proxies and socks5 proxies. Proxies can be configured using: CLI flags, config.json, or environment variables.
See `keybase help advanced` for information on using CLI flags. To configure a proxy using config.json run:

``` bash
keybase config set proxy-type <"socks" or "http_connect">
keybase config set proxy <"localhost:8080" or "username:password@localhost:8080">
```

To configure a proxy using environment variables run:

``` bash
export PROXY_TYPE=<"socks" or "http_connect">
export PROXY=<"localhost:8080" or "username:password@localhost:8080">
```

Internally, we support proxies by setting the HTTP_PROXY and HTTPS_PROXY environment variables which
http.ProxyFromEnvironment automatically reads from. Note that http.ProxyFromEnvironment does support
socks5 proxies and basic auth.

 */

package libkb

import "os"

// Represents the different types of supported proxies
type ProxyType int
const (
	No_Proxy ProxyType = iota
	Socks
	HTTP_Connect
)
// Maps a string to an enum. Used to list the different types of supported proxies and to convert
// config options into the enum
var ProxyTypeStrToEnum = map[string]ProxyType{"socks": Socks, "http_connect": HTTP_Connect}

// Enable the proxy configured by this environment by setting the HTTP_PROXY and HTTPS_PROXY environment variables
func EnableProxy(e *Env) error {
	proxyType := e.GetProxyType()

	if proxyType == No_Proxy {
		// No proxy so nothing to do
		return nil
	}

	realProxyAddress := ""
	if proxyType == Socks {
		realProxyAddress = "socks5://" + e.GetProxy()
	} else {
		realProxyAddress = e.GetProxy()
	}

	e1 := os.Setenv("HTTP_PROXY", realProxyAddress)
	if e1 != nil {
		return e1
	}
	e2 := os.Setenv("HTTPS_PROXY", realProxyAddress)
	if e2 != nil {
		return e2
	}
	return nil
}

