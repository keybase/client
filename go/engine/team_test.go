// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateTeam(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	// Magic to make the test user provision shared DH keys.
	tc.Tp.UpgradePerUserKey = true

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u := CreateAndSignupFakeUser(tc, "t")

	teamName := u.Username + "T"
	eng := NewTeamCreateEngine(tc.G, teamName)

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := eng.Run(ctx)

	require.NoError(t, err)
}

func TestCreateTeamAfterAccountReset(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	// Magic to make the test user provision shared DH keys.
	tc.Tp.UpgradePerUserKey = true

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
	eng := NewTeamCreateEngine(tc.G, teamName)

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := eng.Run(ctx)

	require.NoError(t, err)
}

func TestCreateSubteam(t *testing.T) {
	tc := SetupEngineTest(t, "crypto")
	defer tc.Cleanup()

	// Magic to make the test user provision shared DH keys.
	tc.Tp.UpgradePerUserKey = true
	u := CreateAndSignupFakeUser(tc, "t")

	parentTeamName := u.Username + "T"
	parentEng := NewTeamCreateEngine(tc.G, parentTeamName)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := parentEng.Run(ctx)
	require.NoError(t, err)

	subteamBasename := "mysubteam"
	subteamEng := NewSubteamCreateEngine(tc.G, parentTeamName, subteamBasename)
	err = subteamEng.Run(ctx)
	require.NoError(t, err)

	// TODO: Uncomment the rest here when Get() supports subteams.

	// // Fetch the subteam we just created, to make sure it's there.
	// subteamFQName := parentTeamName + "." + subteamBasename
	// subteam, err := teams.Get(context.TODO(), tc.G, subteamFQName)
	// require.NoError(t, err)

	// require.Equal(t, subteamFQName, subteam.GetName())
	// require.Equal(t, 1, subteam.GetLatestSeqno())
}
