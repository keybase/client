
package libkb

import (
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"crypto/tls"
	"crypto/x509"
	"fmt"
)

type Client struct {
	cookieJar *cookiejar.Jar
	xprt *http.Transport
	cli *http.Client
}

type ClientConfig struct {
	host     string
	useTls   bool
	url      *url.URL
	rootCAs  *x509.CertPool
	prefix   string
}

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
	
	
	return nil, nil
}

func NewClient() *Client {
	// May or may not be used, depending on 
	jar, _ := cookiejar.New(nil)

	xprt := &http.Transport {}

	cli := &http.Client{}

	return &Client { jar, xprt, cli }
}