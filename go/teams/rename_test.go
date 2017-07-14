package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestRenameSimple(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	parentTeamName, err := keybase1.TeamNameFromString(u.Username + "T")
	require.NoError(t, err)
	err = CreateRootTeam(context.TODO(), tc.G, parentTeamName.String())
	require.NoError(t, err)

	subteamBasename := "bb1"
	subteamID, err := CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName)
	require.NoError(t, err)
	subteamName, err := parentTeamName.Append(subteamBasename)
	require.NoError(t, err)

	err = RenameSubteam(context.TODO(), tc.G, subteamName, "bb2")
	require.NoError(t, err)

	t.Logf("load the renamed team")
	subteam, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		ID:          *subteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, parentTeamName.String()+".bb2", subteam.Name().String(), "new name")

	t.Logf("load the parent")
	parent, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        parentTeamName.String(),
		NeedAdmin:   true,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	subteamList := parent.chain().ListSubteams()
	require.Len(t, subteamList, 1, "has 1 subteam")
	require.Equal(t, subteamList[0].Name.String(), parentTeamName.String()+".bb2")
	require.Equal(t, subteamList[0].ID.String(), subteamID.String())
	require.Len(t, parent.chain().inner.SubteamLog, 1, "subteam log has 1 series")
	require.Len(t, parent.chain().inner.SubteamLog[*subteamID], 2, "subteam log has 2 entries")
}
