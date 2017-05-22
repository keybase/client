// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestTeamGet(t *testing.T) {
	tc := SetupEngineTest(t, "team")
	tc.Tp.UpgradePerUserKey = true
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "team")

	name := createTeam(tc)

	arg := keybase1.TeamGetArg{Name: name}
	ctx := &Context{}
	eng := NewTeamGet(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

func createTeam(tc libkb.TestContext) string {
	b, err := libkb.RandBytes(4)
	if err != nil {
		tc.T.Fatal(err)
	}
	name := hex.EncodeToString(b)
	eng := NewTeamCreateEngine(tc.G, name)
	ctx := &Context{}
	if err := eng.Run(ctx); err != nil {
		tc.T.Fatal(err)
	}
	return name
}
