// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"h12.me/socks"
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

func SplitHost(joined string) (host string, port int, err error) {
	re := regexp.MustCompile("^([^:]+)(:([0-9]+))?$")
	match := re.FindStringSubmatch(joined)
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
func (e *Env) GenClientConfigForInternalAPI() (*ClientConfig, error) {
	serverURI := e.GetServerURI()

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
		G.Log.Debug(fmt.Sprintf("Using special root CA for %s: %s",
			host, ShortCA(rawCA)))
	}

	// If we're using proxies, they might have their own CAs.
	if rootCAs, err = GetProxyCAs(rootCAs, e.config); err != nil {
		return nil, err
	}

	ret := &ClientConfig{host, port, useTLS, url, rootCAs, url.Path, true, e.GetAPITimeout()}
	return ret, nil
}

func (e *Env) GenClientConfigForScrapers() (*ClientConfig, error) {
	return &ClientConfig{
		UseCookies: true,
		Timeout:    e.GetScraperTimeout(),
	}, nil
}

func NewClient(e *Env, config *ClientConfig, needCookie bool) *Client {
	var jar *cookiejar.Jar
	if needCookie && (config == nil || config.UseCookies) && e.GetTorMode().UseCookies() {
		jar, _ = cookiejar.New(nil)
	}

	// http.Transport is an example of Go's implicit default behavior causing
	// trouble. The "DefaultTransport" has many non-zero limits set in it,
	// while a "zero Transport" doesn't set any limits at all and also disables
	// the ProxyFromEnvironment. We copy the global default rather than
	// starting from zero.
	var globalDefaultTransport *http.Transport = http.DefaultTransport.(*http.Transport)
	var transport http.Transport = *globalDefaultTransport

	if config != nil && config.RootCAs != nil {
		transport.TLSClientConfig = &tls.Config{RootCAs: config.RootCAs}
	}

	timeout := HTTPDefaultTimeout
	if config != nil && config.Timeout != 0 {
		timeout = config.Timeout
	}

	if e.GetTorMode().Enabled() {
		// Note that DialSocksProxy doesn't support Dial timeouts. I'm not sure
		// we can do anything about that.
		transport.Dial = WrapDialWithTimeout(socks.DialSocksProxy(socks.SOCKS5, e.GetTorProxy()), timeout)
		// We have to unset the default DialContext or it will take priority
		// over Dial.
		transport.DialContext = nil
		// And disable the ProxyFromEnvironment.
		transport.Proxy = nil
	} else {
		dialer := NewTimeoutDialer(timeout, transport.TLSClientConfig)
		transport.DialTLS = dialer.DialTLS
	}

	ret := &Client{
		cli:    &http.Client{Transport: &transport},
		config: config,
	}
	if jar != nil {
		ret.cli.Jar = jar
	}
	return ret
}
