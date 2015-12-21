// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"testing"
)

func TestVerify(t *testing.T) {
	t.Skip()
	in := []byte("The Complete Book of Tools")
	smsg, err := Sign(in, nil, MessageTypeAttachedSignature)
	if err != nil {
		t.Fatal(err)
	}
	skey, msg, err := Verify(smsg)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(msg, in) {
		t.Errorf("verified msg %q, expected %q", msg, in)
	}

	_ = skey

}
