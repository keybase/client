// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the PGPKeyfinder engine.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestPGPKeyfinder(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		tc := SetupEngineTest(t, "PGPKeyfinder")
		defer tc.Cleanup()

		u := CreateAndSignupFakeUser(tc, "login")
		// track alice before starting so we have a user already tracked
		trackAlice(tc, u, sigVersion)
		defer untrackAlice(tc, u, sigVersion)

		ctx := &Context{}
		arg := &PGPKeyfinderArg{
			Usernames: []string{"t_alice", "t_bob", "t_charlie"},
		}
		eng := NewPGPKeyfinder(arg, tc.G)
		if err := RunEngine(eng, ctx); err != nil {
			t.Fatal(err)
		}

		up := eng.UsersPlusKeys()
		if len(up) != 3 {
			t.Errorf("number of users found: %d, expected 3", len(up))
		}
	})
}

func TestPGPKeyfinderLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "PGPKeyfinder")
	defer tc.Cleanup()

	ctx := &Context{}
	arg := &PGPKeyfinderArg{
		Usernames: []string{"t_alice", "t_bob", "t_charlie"},
	}
	eng := NewPGPKeyfinder(arg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	up := eng.UsersPlusKeys()
	if len(up) != 3 {
		t.Errorf("number of users found: %d, expected 3", len(up))
	}
}
