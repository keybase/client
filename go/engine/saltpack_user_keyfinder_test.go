// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the DeviceKeyfinder engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

// Note: a lot of the functionality of SaltpackUserKeyfinder is tested through the SaltpackRecipientKeyfinderEngine (in go/saltpackkeys),
// which is used by the `keybase encrypt` command and calls this SaltpackUserKeyfinder to resolve keys for individual existing users.
// Tests are not repeated here for efficiency reasons.

func TestSaltpackUserKeyfinder(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackUserKeyfinder")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "naclp")
	u2 := CreateAndSignupFakeUser(tc, "naclp")
	u3 := CreateAndSignupFakeUser(tc, "naclp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username, u3.Username},
		UseEntityKeys: true,
	}
	eng := NewSaltpackUserKeyfinder(arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	up := eng.GetPublicKIDs()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}
