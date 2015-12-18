// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import "testing"

func TestSign(t *testing.T) {
	out, err := Sign([]byte("The Complete Book of Tools"), nil, MessageTypeAttachedSignature)
	if err != nil {
		t.Fatal(err)
	}
	_ = out
}
