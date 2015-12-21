// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"testing"
)

func TestVerify(t *testing.T) {
	in := randomMsg(t, 128)
	key := newBoxKey(t)
	smsg, err := Sign(in, key, MessageTypeAttachedSignature)
	if err != nil {
		t.Fatal(err)
	}
	skey, msg, err := Verify(smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(skey.ToKID(), key.GetPublicKey().ToKID()) {
		t.Errorf("sender key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
	if !bytes.Equal(msg, in) {
		t.Errorf("verified msg '%x', expected '%x'", msg, in)
	}
}
