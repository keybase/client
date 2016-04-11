// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build gofuzz

package libkb

import "github.com/keybase/client/go/libkb"

func Fuzz(data []byte) int {
	key, w, err := libkb.ReadOneKeyFromBytes(data)
	w.Warn()
	if err != nil {
		if key != nil {
			panic("key not nil on error")
		}
		return 0
	}
	return 1
}
