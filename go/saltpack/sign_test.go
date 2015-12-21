// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "testing"

func TestSign(t *testing.T) {
	msg := randomMsg(t, 128)
	key := newBoxKey(t)
	out, err := Sign(msg, key, MessageTypeAttachedSignature)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatal("Sign returned no error and no output")
	}
}
