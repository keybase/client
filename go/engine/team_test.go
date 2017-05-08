// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPostNewTeam(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	// Magic to make the test user provision shared DH keys.
	tc.Tp.EnableSharedDH = true

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u := CreateAndSignupFakeUser(tc, "t")

	teamName := u.Username + "T"
	eng := NewNewTeamEngine(tc.G, teamName)

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := eng.Run(ctx)

	require.NoError(t, err)
}

func TestPostNewTeamAfterAccountReset(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	// Magic to make the test user provision shared DH keys.
	tc.Tp.EnableSharedDH = true

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u := CreateAndSignupFakeUser(tc, "t")

	// Now the user's fully qualified username should be like user%seqno. If we
	// don't format this properly, the server will reject the post.
	ResetAccount(tc, u)

	// this will reprovision as an eldest device:
	u.LoginOrBust(tc)
	if err := AssertProvisioned(tc); err != nil {
		t.Fatal(err)
	}

	teamName := u.Username + "T"
	eng := NewNewTeamEngine(tc.G, teamName)

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := eng.Run(ctx)

	require.NoError(t, err)
}
