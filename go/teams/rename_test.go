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
	desiredName, err := parentTeamName.Append("bb2")
	require.NoError(t, err)

	err = RenameSubteam(context.TODO(), tc.G, subteamName, desiredName)
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

// This was a bug that once caused the loader to get stuck.
// - Create team A
// - Create team A.B1
// - Create team A.B1.C <new_subteam>
// - Rename A.B1 -> A.B2 (implicitly renaming A.B1.C -> A.B2.C)
// - Someone else (U1) loads A.B1 with <new_subteam> stubbed
// - Add U1 as an admin of A.B2 or as a member of A.B2's subtree.
// - U1 loads and inflates <new_subteam>.
// The last step failed because the new_subteam link says A.B1.C
// but that doesn't look like a valid subteam name of A.B2.
func TestRenameInflateSubteamAfterRenameParent(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	parentName, _ := createTeam2(*tcs[0])

	subteamName1 := createTeamName(t, parentName.String(), "bb1")
	subteamName2 := createTeamName(t, parentName.String(), "bb2")
	subsubteamName2 := createTeamName(t, parentName.String(), "bb2", "cc")

	t.Logf("U0 creates A.B1")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "bb1", parentName)
	require.NoError(t, err)

	t.Logf("U0 creates A.B1.C")
	subsubteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "cc", subteamName1)
	require.NoError(t, err)

	t.Logf("U0 adds U1 to A.B1 as a writer")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName1.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U0 renames A.B1 -> A.B2")
	err = RenameSubteam(context.TODO(), tcs[0].G, subteamName1, subteamName2)
	require.NoError(t, err)

	t.Logf("U1 loads A.B1 (will have stubbed link and new name)")
	_, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          *subteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load subsubteam")

	t.Logf("U0 adds U1 to A.B2.C as a writer")
	_, err = AddMember(context.TODO(), tcs[0].G, subsubteamName2.String(), fus[1].Username, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	t.Logf("U1 loads A.B2.C which will cause it to inflate the new_subteam link in A.B2")
	_, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          *subsubteamID,
		ForceRepoll: true,
	})
	require.NoError(t, err, "load subsubteam")
}
