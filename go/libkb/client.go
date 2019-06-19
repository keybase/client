// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/go-framed-msgpack-rpc/rpc/resinit"
	"golang.org/x/net/context"
)

type ClientConfig struct {
	Host       string
	Port       int
	UseTLS     bool // XXX unused?
	URL        *url.URL
	RootCAs    *x509.CertPool
	Prefix     string
	UseCookies bool
	Timeout    time.Duration
}

type Client struct {
	cli    *http.Client
	config *ClientConfig
}

var hostRE = regexp.MustCompile("^([^:]+)(:([0-9]+))?$")

func SplitHost(joined string) (host string, port int, err error) {
	match := hostRE.FindStringSubmatch(joined)
	if match == nil {
		err = fmt.Errorf("Invalid host/port found: %s", joined)
	} else {
		host = match[1]
		port = 0
		if len(match[3]) > 0 {
			port, err = strconv.Atoi(match[3])
			if err != nil {
				err = fmt.Errorf("Could not convert port in host %s", joined)
			}
		}
	}
	return
}

func ParseCA(raw string) (*x509.CertPool, error) {
	ret := x509.NewCertPool()
	ok := ret.AppendCertsFromPEM([]byte(raw))
	var err error
	if !ok {
		err = fmt.Errorf("Could not read CA for keybase.io")
		ret = nil
	}
	return ret, err
}

func ShortCA(raw string) string {
	parts := strings.Split(raw, "\n")
	if len(parts) >= 3 {
		parts = parts[0:3]
	}
	return strings.Join(parts, " ") + "..."
}

// GenClientConfigForInternalAPI pulls the information out of the environment configuration,
// and build a Client config that will be used in all API server
// requests
func genClientConfigForInternalAPI(g *GlobalContext) (*ClientConfig, error) {
	e := g.Env
	serverURI, err := e.GetServerURI()

	if err != nil {
		return nil, err
	}

	if e.GetTorMode().Enabled() {
		serverURI = e.GetTorHiddenAddress()
	}

	if serverURI == "" {
		err := fmt.Errorf("Cannot find a server URL")
		return nil, err
	}
	url, err := url.Parse(serverURI)
	if err != nil {
		return nil, err
	}

	if url.Scheme == "" {
		return nil, fmt.Errorf("Server URL missing Scheme")
	}

	if url.Host == "" {
		return nil, fmt.Errorf("Server URL missing Host")
	}

	useTLS := (url.Scheme == "https")
	host, port, e2 := SplitHost(url.Host)
	if e2 != nil {
		return nil, e2
	}
	var rootCAs *x509.CertPool
	if rawCA := e.GetBundledCA(host); len(rawCA) > 0 {
		rootCAs, err = ParseCA(rawCA)
		if err != nil {
			err = fmt.Errorf("In parsing CAs for %s: %s", host, err)
			return nil, err
		}
		g.Log.Debug(fmt.Sprintf("Using special root CA for %s: %s",
			host, ShortCA(rawCA)))
	}

	// If we're using proxies, they might have their own CAs.
	if rootCAs, err = GetProxyCAs(rootCAs, e.config); err != nil {
		return nil, err
	}

	ret := &ClientConfig{host, port, useTLS, url, rootCAs, url.Path, true, e.GetAPITimeout()}
	return ret, nil
}

func genClientConfigForScrapers(e *Env) (*ClientConfig, error) {
	return &ClientConfig{
		UseCookies: true,
		Timeout:    e.GetScraperTimeout(),
	}, nil
}

func NewClient(g *GlobalContext, config *ClientConfig, needCookie bool) (*Client, error) {
	extraLog := func(ctx context.Context, msg string, args ...interface{}) {}
	if g.Env.GetExtraNetLogging() {
		extraLog = func(ctx context.Context, msg string, args ...interface{}) {
			if ctx == nil {
				g.Log.Debug(msg, args...)
			} else {
				g.Log.CDebugf(ctx, msg, args...)
			}
		}
	}
	extraLog(nil, "api.Client:%v New", needCookie)
	env := g.Env
	var jar *cookiejar.Jar
	if needCookie && (config == nil || config.UseCookies) && env.GetTorMode().UseCookies() {
		jar, _ = cookiejar.New(nil)
	}

	// Originally copied from http.DefaultTransport
	dialer := net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
		DualStack: true,
	}
	xprt := http.Transport{
		// Don't change this without re-testing proxy support. Currently the client supports proxies through
		// environment variables that ProxyFromEnvironment picks up
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&dialer).DialContext,
		MaxIdleConns:          200,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	xprt.DialContext = func(ctx context.Context, network, addr string) (c net.Conn, err error) {
		c, err = dialer.DialContext(ctx, network, addr)
		if err != nil {
			extraLog(ctx, "api.Client:%v transport.Dial err=%v", needCookie, err)
			// If we get a DNS error, it could be because glibc has cached an
			// old version of /etc/resolv.conf. The res_init() libc function
			// busts that cache and keeps us from getting stuck in a state
			// where DNS requests keep failing even though the network is up.
			// This is similar to what the Rust standard library does:
			// https://github.com/rust-lang/rust/blob/028569ab1b/src/libstd/sys_common/net.rs#L186-L190
			resinit.ResInitIfDNSError(err)
			return c, err
		}
		if err = rpc.DisableSigPipe(c); err != nil {
			extraLog(ctx, "api.Client:%v transport.Dial DisableSigPipe err=%v", needCookie, err)
			return c, err
		}
		return c, nil
	}

	if config != nil && config.RootCAs != nil {
		xprt.TLSClientConfig = &tls.Config{RootCAs: config.RootCAs}
	}

	xprt.Proxy = MakeProxy(env)

	if !env.GetTorMode().Enabled() && env.GetRunMode() == DevelRunMode {
		xprt.Proxy = func(req *http.Request) (*url.URL, error) {
			host, port, err := net.SplitHostPort(req.URL.Host)
			if err == nil && host == "localhost" {
				// ProxyFromEnvironment refuses to proxy when the hostname is set to "localhost".
				// So make a fake copy of the request with the url set to "127.0.0.1".
				// This makes localhost requests use proxy settings.
				// The Host could be anything and is only used to != "localhost".
				url2 := *req.URL
				url2.Host = "keybase.io:" + port
				req2 := req
				req2.URL = &url2
				return http.ProxyFromEnvironment(req2)
			}
			return http.ProxyFromEnvironment(req)
		}
	}

	var timeout time.Duration
	if config == nil || config.Timeout == 0 {
		timeout = HTTPDefaultTimeout
	} else {
		timeout = config.Timeout
	}

	ret := &Client{
		cli:    &http.Client{Timeout: timeout},
		config: config,
	}
	if jar != nil {
		ret.cli.Jar = jar
	}
	ret.cli.Transport = &xprt
	return ret, nil
}

func ServerLookup(env *Env, mode RunMode) (string, error) {
	if mode == DevelRunMode {
		return DevelServerURI, nil
	}
	if mode == StagingRunMode {
		return StagingServerURI, nil
	}
	if mode == ProductionRunMode {
		if env.IsCertPinningEnabled() {
			// In order to disable SSL pinning we switch to doing requests against keybase.io which has a TLS
			// cert signed by a publicly trusted CA (compared to api-0.keybaseapi.com which has a non-trusted but
			// pinned certificate
			return ProductionServerURI, nil
		}
		return ProductionSiteURI, nil
	}
	return "", fmt.Errorf("Did not find a server to use with the current RunMode!")
}
