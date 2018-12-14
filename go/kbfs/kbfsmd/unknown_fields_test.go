// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
)

// testStructUnknownFields calls TestStructUnknownFields with codecs
// with extensions registered.
func testStructUnknownFields(t *testing.T, sFuture kbfscodec.FutureStruct) {
	cFuture := kbfscodec.NewMsgpack()
	cCurrent := kbfscodec.NewMsgpack()
	cCurrentKnownOnly := kbfscodec.NewMsgpackNoUnknownFields()
	kbfscodec.TestStructUnknownFields(
		t, cFuture, cCurrent, cCurrentKnownOnly, sFuture)
}
