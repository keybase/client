// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func createUserAndRootTeam(t *testing.T) (fu *kbtest.FakeUser, nm keybase1.TeamName, g *libkb.GlobalContext, cleanup func()) {
	tc := SetupTest(t, "team", 1)
	cleanup = func() { tc.Cleanup() }

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	teamName := u.Username + "t"

	err = CreateRootTeam(context.TODO(), tc.G, teamName)
	require.NoError(t, err)

	nm, err = keybase1.TeamNameFromString(teamName)
	require.NoError(t, err)
	require.Equal(t, nm.String(), teamName)

	return u, nm, tc.G, cleanup
}

func TestCreateTeam(t *testing.T) {
	_, _, _, cleanup := createUserAndRootTeam(t)
	cleanup()
}

func TestCreateTeamAfterAccountReset(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	// Now the user's fully qualified username should be like user%seqno. If we
	// don't format this properly, the server will reject the post.
	kbtest.ResetAccount(tc, u)

	// this will reprovision as an eldest device:
	err = u.Login(tc.G)
	require.NoError(t, err)
	if err = kbtest.AssertProvisioned(tc); err != nil {
		t.Fatal(err)
	}

	teamName := u.Username + "T"
	err = CreateRootTeam(context.TODO(), tc.G, teamName)
	require.NoError(t, err)
}

func TestCreateSubteam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	parentTeamName, err := TeamNameFromString(u.Username + "T")
	require.NoError(t, err)
	err = CreateRootTeam(context.TODO(), tc.G, string(parentTeamName))
	require.NoError(t, err)

	subteamBasename := "mysubteam"
	err = CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName)
	require.NoError(t, err)

	// TODO: Uncomment the rest here when Get() supports subteams.

	// // Fetch the subteam we just created, to make sure it's there.
	// subteamFQName := parentTeamName + "." + subteamBasename
	// subteam, err := Get(context.TODO(), tc.G, subteamFQName)
	// require.NoError(t, err)

	// require.Equal(t, subteamFQName, subteam.GetName())
	// require.Equal(t, 1, subteam.GetLatestSeqno())
}
