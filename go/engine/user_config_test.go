// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"
)

func TestSetPrimaryPictureSource(t *testing.T) {
	tc := SetupEngineTest(t, "user config")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "cfg")

	// TODO Setup pictures with multiple sources

	m := NewMetaContextForTestWithLogUI(tc)
	eng := NewUserConfigEngine(tc.G, &UserConfigEngineArg{
		Key:   "picture.source",
		Value: "github",
	})
	err := RunEngine2(m, eng)
	if err != nil {
		t.Fatal(err)
	}

	// TODO Check that the primary picture source was changed
}
