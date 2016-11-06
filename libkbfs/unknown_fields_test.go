// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/stretchr/testify/require"
)

// extra contains some fake extra fields that can be embedded into a
// struct to test handling of unknown fields.
type extra struct {
	Extra1 encryptedData
	Extra2 kbfshash.HMAC
	Extra3 string
}

func makeExtraOrBust(prefix string, t *testing.T) extra {
	extraHMAC, err := kbfshash.DefaultHMAC(
		[]byte("fake extra key"), []byte("fake extra buf"))
	require.NoError(t, err)
	return extra{
		Extra1: encryptedData{
			Version:       EncryptionSecretbox + 1,
			EncryptedData: []byte(prefix + " fake extra encrypted data"),
			Nonce:         []byte(prefix + " fake extra nonce"),
		},
		Extra2: extraHMAC,
		Extra3: prefix + " extra string",
	}
}

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
