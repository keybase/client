package git

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func setupTest(tb testing.TB, name string) libkb.TestContext {
	tc := libkb.SetupTest(tb, name, 1)
	tc.G.SetServices(externals.GetServices())
	teams.NewTeamLoaderAndInstall(tc.G)
	return tc
}

func createRootTeam(tc libkb.TestContext) keybase1.TeamID {
	u, err := kbtest.CreateAndSignupFakeUser("c", tc.G)
	require.NoError(tc.T, err)
	teamName, err := keybase1.TeamNameFromString("T" + u.Username + "T")
	require.NoError(tc.T, err)
	err = teams.CreateRootTeam(context.Background(), tc.G, teamName.String())
	require.NoError(tc.T, err)
	return teams.RootTeamIDFromName(teamName)
}

func TestCrypto(t *testing.T) {
	tc := setupTest(t, "crypto")
	defer tc.Cleanup()

	teamID := createRootTeam(tc)
	team := keybase1.TeamIDWithVisibility{
		TeamID:     teamID,
		Visibility: keybase1.TLFVisibility_PRIVATE,
	}
	plaintext, err := libkb.RandBytes(80)
	require.NoError(tc.T, err)

	c := NewCrypto(tc.G)
	boxed, err := c.Box(context.Background(), plaintext, team)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, boxed)
	require.EqualValues(tc.T, boxed.Gen, 1)
	require.Len(tc.T, boxed.N, libkb.NaclDHNonceSize)
	// require.NotEmpty(tc.T, boxed.Ciphertext)
}
