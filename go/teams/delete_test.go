package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func assertCanUserPerformTeamDelete(t *testing.T, g *libkb.GlobalContext, teamname string) {
	teamOp, err := CanUserPerform(context.Background(), g, teamname)
	require.NoError(t, err)
	require.True(t, teamOp.DeleteTeam)
}

func TestDeleteRoot(t *testing.T) {
	tc, u, teamname := memberSetup(t)
	defer tc.Cleanup()

	assertRole(tc, teamname, u.Username, keybase1.TeamRole_OWNER)

	assertCanUserPerformTeamDelete(t, tc.G, teamname)
	team, err := GetTeamByNameForTest(context.Background(), tc.G, teamname, false, false)
	require.NoError(t, err, "error getting team before delete")

	if err := Delete(context.Background(), tc.G, &teamsUI{}, team.ID); err != nil {
		t.Fatal(err)
	}

	_, err = GetTeamByNameForTest(context.Background(), tc.G, teamname, false, false)
	require.Error(t, err, "no error getting deleted team")
	_, ok := err.(*TeamTombstonedError)
	require.True(t, ok) // ensure server cannot temporarily pretend a team was deleted
}

func TestDeleteSubteamAdmin(t *testing.T) {
	tc, owner, admin, _, root, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, admin.Username, keybase1.TeamRole_ADMIN)

	_, err := AddMember(context.TODO(), tc.G, sub, admin.Username, keybase1.TeamRole_ADMIN, nil)
	if err != nil {
		t.Fatal(err)
	}
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, admin.Username, keybase1.TeamRole_ADMIN)

	// switch to `admin` user
	err = tc.Logout()
	require.NoError(t, err)
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	assertCanUserPerformTeamDelete(t, tc.G, sub)
	team, err := GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	require.NoError(t, err, "error getting team before delete")

	if err := Delete(context.Background(), tc.G, &teamsUI{}, team.ID); err != nil {
		t.Fatal(err)
	}

	_, err = GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	if err == nil {
		t.Fatal("no error getting deleted team")
	}
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("error type: %T (%s), expected libkb.AppStatusError", err, err)
	}
	if aerr.Code != int(keybase1.StatusCode_SCTeamReadError) {
		t.Errorf("error status code: %d, expected %d (%s)", aerr.Code, keybase1.StatusCode_SCTeamReadError, aerr)
	}
}

func TestDeleteSubteamImpliedAdmin(t *testing.T) {
	tc, owner, admin, _, root, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, admin.Username, keybase1.TeamRole_ADMIN)
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, admin.Username, keybase1.TeamRole_NONE)

	// switch to `admin` user
	err := tc.Logout()
	require.NoError(t, err)
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	assertCanUserPerformTeamDelete(t, tc.G, sub)
	team, err := GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	require.NoError(t, err, "error getting team before delete")

	if err := Delete(context.Background(), tc.G, &teamsUI{}, team.ID); err != nil {
		t.Fatal(err)
	}

	_, err = GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	if err == nil {
		t.Fatal("no error getting deleted team")
	}
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("error type: %T (%s), expected libkb.AppStatusError", err, err)
	}
	if aerr.Code != int(keybase1.StatusCode_SCTeamReadError) {
		t.Errorf("error status code: %d, expected %d (%s)", aerr.Code, keybase1.StatusCode_SCTeamReadError, aerr)
	}
}

func TestDeleteSubteamWithHiddenRotations(t *testing.T) {
	tc, owner, admin, _, root, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, admin.Username, keybase1.TeamRole_ADMIN)
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, admin.Username, keybase1.TeamRole_NONE)

	// switch to `admin` user
	err := tc.Logout()
	require.NoError(t, err)
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	subTeam, err := GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	require.NoError(t, err)

	err = subTeam.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	rootTeam, err := GetTeamByNameForTest(context.Background(), tc.G, root, false, false)
	require.NoError(t, err)

	err = rootTeam.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	assertCanUserPerformTeamDelete(t, tc.G, sub)
	subTeam, err = GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	require.NoError(t, err, "error getting team before delete")

	if err := Delete(context.Background(), tc.G, &teamsUI{}, subTeam.ID); err != nil {
		t.Fatal(err)
	}

	_, err = GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	if err == nil {
		t.Fatal("no error getting deleted team")
	}
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("error type: %T (%s), expected libkb.AppStatusError", err, err)
	}
	if aerr.Code != int(keybase1.StatusCode_SCTeamReadError) {
		t.Errorf("error status code: %d, expected %d (%s)", aerr.Code, keybase1.StatusCode_SCTeamReadError, aerr)
	}
}

func TestRecreateSubteam(t *testing.T) {
	tc, _, admin, _, _, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	// switch to `admin` user
	err := tc.Logout()
	require.NoError(t, err)
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	assertCanUserPerformTeamDelete(t, tc.G, sub)
	team, err := GetTeamByNameForTest(context.Background(), tc.G, sub, false, false)
	require.NoError(t, err, "error getting team before delete")

	if err := Delete(context.Background(), tc.G, &teamsUI{}, team.ID); err != nil {
		t.Fatal(err)
	}

	// create the subteam again
	name, err := keybase1.TeamNameFromString(sub)
	if err != nil {
		t.Fatal(err)
	}
	parent, err := name.Parent()
	if err != nil {
		t.Fatal(err)
	}
	_, err = CreateSubteam(context.Background(), tc.G, string(name.LastPart()), parent, keybase1.TeamRole_NONE /* addSelfAs */)
	if err != nil {
		t.Fatal(err)
	}
}

// U0 creates a subteam and deletes it
// U0 creates a subteam and deletes it again
// U1 loads the root team.
func TestDeleteTwoSubteams(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates A")
	parentName, parentID := createTeam2(*tcs[0])

	subteamName1 := createTeamName(t, parentName.String(), "bbb")
	subteamName2 := createTeamName(t, parentName.String(), "ccc")

	t.Logf("U0 creates A.B")
	_, err := CreateSubteam(context.TODO(), tcs[0].G, "bbb", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	t.Logf("U0 deletes A.B")
	assertCanUserPerformTeamDelete(t, tcs[0].G, subteamName1.String())
	team, err := GetTeamByNameForTest(context.Background(), tcs[0].G, subteamName1.String(), false, false)
	require.NoError(t, err, "error getting team before delete")
	err = Delete(context.Background(), tcs[0].G, &teamsUI{}, team.ID)
	require.NoError(t, err)

	t.Logf("U0 creates A.C")
	_, err = CreateSubteam(context.TODO(), tcs[0].G, "ccc", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	t.Logf("U0 deletes A.C")
	assertCanUserPerformTeamDelete(t, tcs[0].G, subteamName2.String())
	team, err = GetTeamByNameForTest(context.Background(), tcs[0].G, subteamName2.String(), false, false)
	require.NoError(t, err, "error getting team before delete")
	err = Delete(context.Background(), tcs[0].G, &teamsUI{}, team.ID)
	require.NoError(t, err)

	t.Logf("U0 adds U1 to A")
	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	t.Logf("U1 loads A")
	team, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		ID: parentID,
	})
	require.NoError(t, err, "load team")
	t.Logf(spew.Sdump(team.chain().inner.SubteamLog))
	require.Len(t, team.chain().inner.SubteamLog, 0, "subteam log should be empty because all subteam links were stubbed for this user")
}

type teamsUI struct{}

func (t *teamsUI) ConfirmRootTeamDelete(context.Context, keybase1.ConfirmRootTeamDeleteArg) (bool, error) {
	return true, nil
}

func (t *teamsUI) ConfirmSubteamDelete(context.Context, keybase1.ConfirmSubteamDeleteArg) (bool, error) {
	return true, nil
}

func (t *teamsUI) ConfirmInviteLinkAccept(context.Context, keybase1.ConfirmInviteLinkAcceptArg) (bool, error) {
	return true, nil
}

func TestDoubleTombstone(t *testing.T) {
	tc, _, teamname := memberSetup(t)
	defer tc.Cleanup()
	name, err := keybase1.TeamNameFromString(teamname)
	require.NoError(t, err)

	id, err := ResolveNameToID(context.TODO(), tc.G, name)
	require.NoError(t, err)

	mctx := libkb.NewMetaContextForTest(tc)

	err = TombstoneTeam(mctx, id)
	require.NoError(t, err)

	err = TombstoneTeam(mctx, id)
	require.NoError(t, err, "errored on trying to tombstone a tombstoned team")
}
