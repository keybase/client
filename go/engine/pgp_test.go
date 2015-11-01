// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestGenerateNewPGPKey(t *testing.T) {
	tc := SetupEngineTest(t, "pgp")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "pgp")
	secui := &libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}
}
