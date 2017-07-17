// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
	"testing/quick"
)

func TestHexEncoding(t *testing.T) {
	f := func(x uint64) bool {
		u := UHex{Val: x}
		s := u.String()
		for _, c := range s {
			if c >= '0' && c <= '9' {
				continue
			}
			if c >= 'a' && c <= 'f' {
				continue
			}
			return false
		}
		return len(s) == 16
	}
	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}
