// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscodec"
)

// testStructUnknownFields calls TestStructUnknownFields with codecs
// with extensions registered.
func testStructUnknownFields(t *testing.T, sFuture kbfscodec.FutureStruct) {
	cFuture := kbfscodec.NewMsgpack()
	registerOpsFuture(cFuture)

	cCurrent := kbfscodec.NewMsgpack()
	RegisterOps(cCurrent)

	cCurrentKnownOnly := kbfscodec.NewMsgpackNoUnknownFields()
	RegisterOps(cCurrentKnownOnly)

	kbfscodec.TestStructUnknownFields(
		t, cFuture, cCurrent, cCurrentKnownOnly, sFuture)
}
