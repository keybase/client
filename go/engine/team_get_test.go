// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import "testing"

func TestTeamGet(t *testing.T) {
	tc := SetupEngineTest(t, "team")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "team")
	_ = fu

	ctx := &Context{}
	eng := NewTeamGet(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
