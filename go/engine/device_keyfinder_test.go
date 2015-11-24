// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the DeviceKeyfinder engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestDeviceKeyfinder(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceKeyfinder")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "kbcmf")
	u2 := CreateAndSignupFakeUser(tc, "kbcmf")
	u3 := CreateAndSignupFakeUser(tc, "kbcmf")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := &DeviceKeyfinderArg{
		Users:     []string{u1.Username, u2.Username, u3.Username},
		SkipTrack: true,
	}
	eng := NewDeviceKeyfinder(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusDeviceKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}

func TestDeviceKeyfinderLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceKeyfinder")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "kbcmf")
	u2 := CreateAndSignupFakeUser(tc, "kbcmf")
	u3 := CreateAndSignupFakeUser(tc, "kbcmf")
	Logout(tc)

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: &libkb.TestSecretUI{}}
	arg := &DeviceKeyfinderArg{
		Users: []string{u1.Username, u2.Username, u3.Username},
	}
	eng := NewDeviceKeyfinder(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusDeviceKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}
