// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"net/url"
)

type TorMode int

const (
	TorNone TorMode = iota
	TorStrict
	TorLeaky
)

func (m TorMode) Enabled() bool {
	return (m != TorNone)
}

func (m TorMode) UseCookies() bool {
	return m != TorStrict
}

func (m TorMode) UseSession() bool {
	return m != TorStrict
}

func (m TorMode) UseCSRF() bool {
	return m != TorStrict
}

func (m TorMode) UseHeaders() bool {
	return m != TorStrict
}

func StringToTorMode(s string) (ret TorMode, err error) {
	switch s {
	case "strict":
		ret = TorStrict
	case "leaky":
		ret = TorLeaky
	case "none":
		ret = TorNone
	default:
		err = fmt.Errorf("Unknown Tor mode: '%s'", s)
	}
	return ret, err
}

func TorParseProxy(s string) (*url.URL, error) {
	if s == "" {
		return nil, nil
	}
	return url.Parse(s)
}
