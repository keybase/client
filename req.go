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
)

type ClientConfig struct {
	Host       string
	Port       int
	UseTls     bool
	Url        *url.URL
	RootCAs    *x509.CertPool
	Prefix     string
	UseCookies bool
}

type Client struct {
	cli    *http.Client
	config *ClientConfig
}

type ClientSet struct {
	cookied   *Client
	uncookied *Client
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

// Pull the information out of the environment configuration,
// and build a Client config that will be used in all API server
// requests
func (e Env) GenClientConfig() (*ClientConfig, error) {
	u := e.GetServerUri()
	if len(u) == 0 {
		err := fmt.Errorf("Cannot find a server URL")
		return nil, err
	}
	url, err := url.Parse(u)
	if err != nil {
		return nil, err
	}
	useTls := (url.Scheme == "https")
	host, port, e2 := SplitHost(url.Host)
	if e2 != nil {
		return nil, e2
	}
	var rootCAs *x509.CertPool
	if raw_ca := e.GetBundledCA(host); len(raw_ca) > 0 {
		rootCAs, err = ParseCA(raw_ca)
		if err != nil {
			err = fmt.Errorf("In parsing CAs for %s: %s", host, err.Error())
			return nil, err
		}
		G.Log.Debug(fmt.Sprintf("Using special root CA for %s: %s", host, ShortCA(raw_ca)))
	}
	ret := &ClientConfig{host, port, useTls, url, rootCAs, url.Path, true}
	return ret, nil
}

func NewClient(config *ClientConfig, needCookie bool) *Client {
	var jar *cookiejar.Jar
	if needCookie && config.UseCookies {
		jar, _ = cookiejar.New(nil)
	}

	var xprt *http.Transport

	if config.RootCAs != nil {
		xprt = &http.Transport{
			TLSClientConfig: &tls.Config{RootCAs: config.RootCAs},
		}
	}

	ret := &Client{
		cli:    &http.Client{},
		config: config,
	}
	if jar != nil {
		ret.cli.Jar = jar
	}
	if xprt != nil {
		ret.cli.Transport = xprt
	}
	return ret
}
