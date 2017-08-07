package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDeleteRoot(t *testing.T) {
	tc, u, teamname := memberSetup(t)
	defer tc.Cleanup()

	assertRole(tc, teamname, u.Username, keybase1.TeamRole_OWNER)

	if err := Delete(context.Background(), tc.G, &teamsUI{}, teamname); err != nil {
		t.Fatal(err)
	}

	_, err := GetForTeamManagementByStringName(context.Background(), tc.G, teamname, false)
	require.Error(t, err, "no error getting deleted team")
	require.IsType(t, TeamDoesNotExistError{}, err)
}

func TestDeleteSubteamAdmin(t *testing.T) {
	tc, owner, admin, _, root, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, admin.Username, keybase1.TeamRole_ADMIN)

	_, err := AddMember(context.TODO(), tc.G, sub, admin.Username, keybase1.TeamRole_ADMIN)
	if err != nil {
		t.Fatal(err)
	}
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, admin.Username, keybase1.TeamRole_ADMIN)

	// switch to `admin` user
	tc.G.Logout()
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	if err := Delete(context.Background(), tc.G, &teamsUI{}, sub); err != nil {
		t.Fatal(err)
	}

	_, err = GetForTeamManagementByStringName(context.Background(), tc.G, sub, false)
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
	tc.G.Logout()
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	if err := Delete(context.Background(), tc.G, &teamsUI{}, sub); err != nil {
		t.Fatal(err)
	}

	_, err := GetForTeamManagementByStringName(context.Background(), tc.G, sub, false)
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
	tc.G.Logout()
	if err := admin.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	if err := Delete(context.Background(), tc.G, &teamsUI{}, sub); err != nil {
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
	_, err = CreateSubteam(context.Background(), tc.G, string(name.LastPart()), parent)
	if err != nil {
		t.Fatal(err)
	}
}

type teamsUI struct{}

func (t *teamsUI) ConfirmRootTeamDelete(context.Context, keybase1.ConfirmRootTeamDeleteArg) (bool, error) {
	return true, nil
}
