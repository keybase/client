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
	"bufio"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"golang.org/x/net/proxy"
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
		realProxyAddress := BuildProxyAddressWithProtocol(proxyType, proxyAddress)

		realProxyURL, err := url.Parse(realProxyAddress)
		if err != nil {
			return nil, err
		}

		return realProxyURL, nil
	}
}

// Get a string that represents a proxy including the protocol needed for the proxy
func BuildProxyAddressWithProtocol(proxyType ProxyType, proxyAddress string) string {
	realProxyAddress := proxyAddress
	if proxyType == Socks {
		realProxyAddress = "socks5://" + proxyAddress
	} else if proxyType == HTTPConnect && !strings.Contains(proxyAddress, "http://") && !strings.Contains(proxyAddress, "https://") {
		// If they don't specify a protocol, default to http:// since it is the most common
		realProxyAddress = "http://" + proxyAddress
	}
	return realProxyAddress
}

// A net.Dialer that dials via TLS
type httpsDialer struct {
	opts *ProxyDialOpts
}

func (d httpsDialer) Dial(network string, addr string) (net.Conn, error) {
	// Start by making a direct dialer and dialing and then wrap TLS around it
	dd := directDialer{opts: d.opts}
	conn, err := dd.Dial(network, addr)
	if err != nil {
		return nil, err
	}
	return tls.Client(conn, &tls.Config{}), err
}

// A net.Dialer that dials via just the standard net.Dial
type directDialer struct {
	opts *ProxyDialOpts
}

func (d directDialer) Dial(network string, addr string) (net.Conn, error) {
	dialer := &net.Dialer{
		Timeout:   d.opts.Timeout,
		KeepAlive: d.opts.KeepAlive,
	}
	return dialer.Dial(network, addr)
}

// Get the correct upstream dialer to use for the given proxyURL
func getUpstreamDialer(proxyURL *url.URL, opts *ProxyDialOpts) proxy.Dialer {
	switch proxyURL.Scheme {
	case "https":
		return httpsDialer{opts: opts}
	case "http":
		fallthrough
	default:
		return directDialer{opts: opts}
	}
}

// A net.Dialer that dials via a HTTP Connect proxy over the given forward dialer
type httpConnectProxy struct {
	proxyURL *url.URL
	forward  proxy.Dialer
}

func newHTTPConnectProxy(proxyURL *url.URL, forward proxy.Dialer) (proxy.Dialer, error) {
	s := httpConnectProxy{proxyURL: proxyURL, forward: forward}
	return &s, nil
}

// Dial a TCP connection to the given addr (network must be TCP) via s.proxyURL
func (s *httpConnectProxy) Dial(network string, addr string) (net.Conn, error) {
	// We only can do TCP proxies with this function (not UDP and definitely not unix)
	if network != "tcp" {
		return nil, fmt.Errorf("Cannot use proxy Dial with network=%s", network)
	}

	// Dial a connection to the proxy using s.forward which is our upstream connection
	// proxyConn is now a TCP connection to the proxy server
	proxyConn, err := s.forward.Dial("tcp", s.proxyURL.Host)
	if err != nil {
		return nil, err
	}

	// HTTP Connect proxies work via the CONNECT verb which signals to the proxy server
	// that it should treat the connection as a raw TCP stream sent to the given address
	req, err := http.NewRequest("CONNECT", "//"+addr, nil)
	if err != nil {
		proxyConn.Close()
		return nil, err
	}

	// We also need to set up auth for the proxy which is done via HTTP basic
	// auth on the CONNECT request we are sending
	if s.proxyURL.User != nil {
		password, _ := s.proxyURL.User.Password()
		req.SetBasicAuth(s.proxyURL.User.Username(), password)
	}

	// Send the HTTP request to the proxy server in order to start the TCP tunnel
	err = req.Write(proxyConn)
	if err != nil {
		proxyConn.Close()
		return nil, err
	}

	// Read a response and confirm that the server replied with HTTP 200 which confirms that we started the
	// TCP tunnel. Note that we don't expect any additional body to the request since this is now just an open
	// TCP tunnel
	resp, err := http.ReadResponse(bufio.NewReader(proxyConn), req)
	if err != nil {
		proxyConn.Close()
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		proxyConn.Close()
		err = fmt.Errorf("Failed to connect to proxy server, status code: %d", resp.StatusCode)
		return nil, err
	}

	// proxyConn is now a TCP connection to the proxy server which forwards to addr. It is the responsibility
	// of the caller to Close() proxyConn
	return proxyConn, nil
}

var registerLock = sync.Mutex{}
var hasBeenRegistered = false

// Must be called in order for the proxy library to support HTTP connect proxies. The proxy library uses a map to store
// this information which can lead to a `fatal error: concurrent map writes` so we use a lock to serialize it and a
// bool to make it so we only register once (avoid acquiring a lock every time we start a proxy connection).
func registerHTTPConnectProxies() {
	if !hasBeenRegistered {
		registerLock.Lock()
		proxy.RegisterDialerType("http", newHTTPConnectProxy)
		proxy.RegisterDialerType("https", newHTTPConnectProxy)
		hasBeenRegistered = true
		registerLock.Unlock()
	}
}

type ProxyDialOpts struct {
	Timeout   time.Duration
	KeepAlive time.Duration
}

// The equivalent of net.Dial except it uses the proxy configured in Env
func ProxyDial(env *Env, network string, address string) (net.Conn, error) {
	// Set the timeout to an exceedingly large number so it never times out
	return ProxyDialTimeout(env, network, address, 100*365*24*time.Hour)
}

// The equivalent of net.DialTimeout except it uses the proxy configured in Env
func ProxyDialTimeout(env *Env, network string, address string, timeout time.Duration) (net.Conn, error) {
	return ProxyDialWithOpts(context.TODO(), env, network, address, &ProxyDialOpts{Timeout: timeout})
}

func ProxyDialWithOpts(ctx context.Context, env *Env, network string, address string, opts *ProxyDialOpts) (net.Conn, error) {
	if env.GetProxyType() == NoProxy {
		dialer := &net.Dialer{
			Timeout:   opts.Timeout,
			KeepAlive: opts.KeepAlive,
		}
		return dialer.DialContext(ctx, network, address)
	}
	registerHTTPConnectProxies()
	proxyURLStr := BuildProxyAddressWithProtocol(env.GetProxyType(), env.GetProxy())
	proxyURL, err := url.Parse(proxyURLStr)
	if err != nil {
		return nil, err
	}
	dialer, err := proxy.FromURL(proxyURL, getUpstreamDialer(proxyURL, opts))
	if err != nil {
		return nil, err
	}

	// Currently proxy.Dialer does not support DialContext. This is being actively worked on and will probably
	// land in the next go release, but for now we are emulating it with a goroutine and channels
	// See: https://github.com/golang/go/issues/17759
	doneCh := make(chan net.Conn, 1)
	errCh := make(chan error, 1)
	go func() {
		conn, err := dialer.Dial(network, address)
		if err != nil {
			errCh <- err
		} else {
			doneCh <- conn
		}
	}()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case conn := <-doneCh:
		return conn, nil
	case err := <-errCh:
		return nil, err
	}
}

// The equivalent of http.Get except it uses the proxy configured in Env
func ProxyHTTPGet(env *Env, u string) (*http.Response, error) {
	client := &http.Client{Transport: &http.Transport{Proxy: MakeProxy(env)}}

	return client.Get(u)
}

// A struct that implements rpc.Dialable from go-framed-msgpack-rpc
type ProxyDialable struct {
	env       *Env
	Timeout   time.Duration
	KeepAlive time.Duration
}

func NewProxyDialable(env *Env) *ProxyDialable {
	return &ProxyDialable{env: env}
}

func (pd *ProxyDialable) SetOpts(timeout time.Duration, keepAlive time.Duration) {
	pd.Timeout = timeout
	pd.KeepAlive = keepAlive
}

func (pd *ProxyDialable) Dial(ctx context.Context, network string, addr string) (net.Conn, error) {
	return ProxyDialTimeout(pd.env, network, addr, pd.Timeout)
}

// Test that ProxyDialable implements rpc.Dialable
var _ rpc.Dialable = (*ProxyDialable)(nil)
