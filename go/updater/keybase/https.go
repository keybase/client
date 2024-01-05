// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"time"

	"github.com/keybase/client/go/libkb"
)

func httpClient(timeout time.Duration) (*http.Client, error) {
	return httpClientWithCert(libkb.APICA, timeout)
}

func httpClientWithCert(cert string, timeout time.Duration) (*http.Client, error) {
	certPool := x509.NewCertPool()
	if ok := certPool.AppendCertsFromPEM([]byte(cert)); !ok {
		return nil, fmt.Errorf("Unable to add cert")
	}
	if certPool == nil {
		return nil, fmt.Errorf("No cert pool")
	}
	tlsConfig := &tls.Config{RootCAs: certPool}
	transport := &http.Transport{TLSClientConfig: tlsConfig}
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}, nil
}
