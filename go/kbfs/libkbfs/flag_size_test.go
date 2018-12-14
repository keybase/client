// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "testing"

func TestSizeFlag(t *testing.T) {
	for _, v := range []int64{0, 1, 13, 100, 1000, 1024, 1333, 2000, 74000, 74001, 1000 * 1000, 1024 * 1000, 1025 * 1001, 1024 * 1024,
		1000 * 1000 * 1000, 1024 * 1024 * 1024, 7 * 1000 * 1000 * 1000, 13 * 1024 * 1024 * 1024,
		1000 * 1000 * 1000 * 1000, 1024 * 1024 * 1024 * 1024, 99999 * 1000 * 1000 * 1000 * 1000, 99999 * 1024 * 1024 * 1024 * 1024,
	} {
		var x int64
		err := SizeFlag{&x}.Set(SizeFlag{&v}.String())
		if v != x || err != nil {
			t.Errorf("SizeFlag comparison error: v=%d x=%d err=%v", v, x, err)
		}
	}
	mult := int64(1000)
	for _, ch := range "kmgt" {
		v := mult * 77
		r := SizeFlag{&v}
		if r.String() != "77"+string(ch) {
			t.Errorf("SizeFlag to string error: got %v, expected %v", r.String(), "77"+string(ch))
		}
		mult *= 1000
	}
	mult = 1024
	for _, ch := range "kmgt" {
		v := mult * 77
		r := SizeFlag{&v}
		if r.String() != "77"+string(ch)+"i" {
			t.Errorf("SizeFlag to string error: got %v, expected %v", r.String(), "77"+string(ch)+"i")
		}
		mult *= 1024
	}
}

func TestSizeFlagZero(t *testing.T) {
	var f SizeFlag
	s := f.String()
	if s != "0" {
		t.Errorf("Expected 0, got %s", s)
	}
}
