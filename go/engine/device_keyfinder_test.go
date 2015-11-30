// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the DeviceKeyfinder engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
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

	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := DeviceKeyfinderArg{
		Users: []string{u1.Username, u2.Username, u3.Username},
		Me:    me,
		TrackOptions: keybase1.TrackOptions{
			BypassConfirm: true,
		},
	}
	eng := NewDeviceKeyfinder(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusDeviceKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}

func TestDeviceKeyfinderNoTrack(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceKeyfinder")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "kbcmf")
	u2 := CreateAndSignupFakeUser(tc, "kbcmf")
	u3 := CreateAndSignupFakeUser(tc, "kbcmf")

	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	ctx := &Context{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := DeviceKeyfinderArg{
		Users: []string{u1.Username, u2.Username, u3.Username},
	}
	eng := NewDeviceKeyfinder(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusDeviceKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}
