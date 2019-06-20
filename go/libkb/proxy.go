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

Internally, we support proxies by setting the Proxy field of http.Transport in order to use http's
built in support for proxies. Note that http.Transport.Proxy does support socks5 proxies and basic auth.

By default, the client reaches out to api-0.core.keybaseapi.com which has a self-signed certificate. This
is actually more secure than relying on the standard CA system since we pin the client to only accept this
certificate. By pinning this certificate, we make it so that any proxies that MITM TLS cannot intercept the
client's traffic since even though their certificate is "trusted" according to the CA system, it isn't
trusted by the client. In order to disable SSL pinning and allow TLS MITMing proxies to function, it is
possible to switch the client to trust the public CA system. This can be done in one of three ways:

``` bash
keybase config set disable-ssl-pinning true
# OR
export DISABLE_SSL_PINNING="true"
# OR
keybase --disable-ssl-pinning
```

Note that enabling this option is NOT recommended. Enabling this option allows the proxy to view all traffic between
the client and the Keybase servers.

*/

package libkb

import (
	"net/http"
	"net/url"
	"strings"
)

// Represents the different types of supported proxies
type ProxyType int

const (
	NoProxy ProxyType = iota
	Socks
	HTTPConnect
)

// Maps a string to an enum. Used to list the different types of supported proxies and to convert
// config options into the enum
var ProxyTypeStrToEnum = map[string]ProxyType{"socks": Socks, "http_connect": HTTPConnect}
var ProxyTypeEnumToStr = map[ProxyType]string{Socks: "socks", HTTPConnect: "http_connect", NoProxy: "no_proxy"}

func GetCommaSeparatedListOfProxyTypes() string {
	var proxyTypes []string
	for k := range ProxyTypeStrToEnum {
		proxyTypes = append(proxyTypes, k)
	}
	return strings.Join(proxyTypes, ",")
}

// Return a function that can be passed to the http library in order to configure a proxy
func MakeProxy(e *Env) func(r *http.Request) (*url.URL, error) {
	return func(r *http.Request) (*url.URL, error) {
		proxyType := e.GetProxyType()
		proxyAddress := e.GetProxy()

		if proxyType == NoProxy {
			// No proxy so returning nil tells it not to use a proxy
			return nil, nil
		}
		realProxyAddress := proxyAddress
		if proxyType == Socks {
			realProxyAddress = "socks5://" + proxyAddress
		} else if proxyType == HTTPConnect && !strings.Contains(proxyAddress, "http://") && !strings.Contains(proxyAddress, "https://") {
			// If they don't specify a protocol, default to http:// since it is the most common
			realProxyAddress = "http://" + proxyAddress
		}

		realProxyURL, err := url.Parse(realProxyAddress)
		if err != nil {
			return nil, err
		}

		return realProxyURL, nil
	}
}
