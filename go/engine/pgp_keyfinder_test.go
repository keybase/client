// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the PGPKeyfinder engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestPGPKeyfinder(t *testing.T) {
	tc := SetupEngineTest(t, "PGPKeyfinder")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	u := CreateAndSignupFakeUser(tc, "login")
	// track alice before starting so we have a user already tracked
	trackAlice(tc, u, sigVersion)
	defer untrackAlice(tc, u, sigVersion)

	arg := &PGPKeyfinderArg{
		Usernames: []string{"t_alice", "t_bob", "t_charlie"},
	}
	eng := NewPGPKeyfinder(tc.G, arg)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}

func TestPGPKeyfinderLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "PGPKeyfinder")
	defer tc.Cleanup()

	arg := &PGPKeyfinderArg{
		Usernames: []string{"t_alice", "t_bob", "t_charlie"},
	}
	eng := NewPGPKeyfinder(tc.G, arg)
	m := NewMetaContextForTest(tc)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}
