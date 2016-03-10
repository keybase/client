// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import "testing"

func TestLoginWithPassphrase(t *testing.T) {
	tc := SetupEngineTest(t, "lwp")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)

	ctx := &Context{}
	eng := NewLoginWithPassphrase(tc.G, u1.Username, u1.Passphrase)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(tc)
	if err := AssertProvisioned(tc); err != nil {
		t.Fatal(err)
	}
}
