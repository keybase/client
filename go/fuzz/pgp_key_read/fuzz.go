// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build gofuzz

package libkb

import "github.com/keybase/client/go/libkb"

func Fuzz(data []byte) int {
	key, _, err := libkb.ReadOneKeyFromBytes(data)
	if err != nil {
		if key != nil {
			panic("key not nil on error")
		}
		return 0
	}
	return 1
}
