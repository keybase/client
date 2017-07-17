// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build gofuzz

package libkb

import "github.com/keybase/client/go/libkb"

func Fuzz(data []byte) int {
	split := len(data) / 2
	pp := string(data[0:split])
	salt := data[split:]
	tsec, pps, err := libkb.StretchPassphrase(pp, salt)
	if err != nil {
		if tsec != nil {
			panic("tsec not nil on error")
		}
		if pps != nil {
			panic("pps not nil on error")
		}
		return 0
	}
	return 1
}
