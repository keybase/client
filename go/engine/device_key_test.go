// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestDeviceKey(t *testing.T) {
	tc := SetupEngineTest(t, "dkal")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "dkal")

	check := func() {
		u, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
		if err != nil {
			t.Fatal(err)
		}
		if u == nil {
			t.Fatalf("Can't load current user")
		}

		if subkey, err := u.GetDeviceSubkey(); err != nil {
			t.Fatal(err)
		} else if subkey == nil {
			t.Fatalf("Failed to load device subkey right after signup")
		}
	}
	check()

	Logout(tc)
	fu.LoginOrBust(tc)
	check()
}
