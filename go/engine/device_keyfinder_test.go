// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the DeviceKeyfinder engine.

package engine

import (
	"testing"
)

func TestDeviceKeyfinder(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceKeyfinder")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "naclp")
	u2 := CreateAndSignupFakeUser(tc, "naclp")
	u3 := CreateAndSignupFakeUser(tc, "naclp")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := DeviceKeyfinderArg{
		Users:           []string{u1.Username, u2.Username, u3.Username},
		NeedEncryptKeys: true,
	}
	eng := NewDeviceKeyfinder(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}
