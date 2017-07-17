// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/x509"
	"io/ioutil"
)

func addCert(out *x509.CertPool, fn string) (ret *x509.CertPool, err error) {
	var data []byte
	ret = nil
	if ret == nil {
		ret = x509.NewCertPool()
	}
	if data, err = ioutil.ReadFile(fn); err != nil {
		err = ConfigError{fn, err.Error()}
	} else if !ret.AppendCertsFromPEM(data) {
		err = ConfigError{fn, "Bad CA Cert file; failed to parse"}
	}
	return
}

func GetProxyCAs(out *x509.CertPool, r ConfigReader) (ret *x509.CertPool, err error) {
	ret = out
	var v []string
	if v, err = r.GetProxyCACerts(); err != nil {
		return
	}
	for _, fn := range v {
		if ret, err = addCert(ret, fn); err != nil {
			return
		}
	}
	return
}
