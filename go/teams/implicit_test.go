package teams

import (
	"fmt"
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLookupImplicitTeams(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	numKBUsers := 3
	var users []*kbtest.FakeUser
	var usernames []string
	for i := 0; i < numKBUsers; i++ {
		u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
		require.NoError(t, err)
		users = append(users, u)
		usernames = append(usernames, u.Username)
	}

	lookupAndCreate := func(displayName string, public bool) {
		t.Logf("displayName:%v public:%v", displayName, public)
		_, _, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.Error(t, err)
		require.IsType(t, TeamDoesNotExistError{}, err)

		createdTeamID, impTeamName, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, public, impTeamName.IsPublic)

		// second time, LookupOrCreate should Lookup the team just created.
		createdTeamID2, impTeamName2, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, createdTeamID, createdTeamID2)
		require.Equal(t, impTeamName, impTeamName2, "public: %v", public)

		lookupTeamID, impTeamName, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, createdTeamID, lookupTeamID)

		team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			ID: createdTeamID,
		})
		require.NoError(t, err)
		teamDisplay, err := team.ImplicitTeamDisplayNameString(context.TODO())
		require.NoError(t, err)
		formatName, err := FormatImplicitTeamDisplayName(context.TODO(), tc.G, impTeamName)
		require.NoError(t, err)
		require.Equal(t, teamDisplay, formatName)
	}

	displayName := strings.Join(usernames, ",")
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)
	displayName = fmt.Sprintf("mike@twitter,%s,james@github", displayName)
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)

	_, _, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", false)
	require.Error(t, err)
	_, _, err = LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", true)
	require.Error(t, err)
}

// Test an implicit team where one user does not yet have a PUK.
func TestImplicitPukless(t *testing.T) {
	fus, tcs, cleanup := setupNTestsWithPukless(t, 2, 1)
	defer cleanup()

	displayName := "" + fus[0].Username + "," + fus[1].Username
	t.Logf("U0 creates an implicit team: %v", displayName)
	teamID, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	require.NoError(t, err)

	// TODO enable this after fixing lookup
	// teamID2, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	// require.NoError(t, err)
	// require.Equal(t, teamID, teamID2)

	t.Logf("U0 loads the team")
	team, err := Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{ID: teamID})
	require.NoError(t, err)
	require.False(t, team.IsPublic())
	u0Role, err := team.chain().GetUserRole(fus[0].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, u0Role)
	u1Role, err := team.chain().GetUserRole(fus[1].GetUserVersion())
	require.True(t, err != nil || u1Role == keybase1.TeamRole_NONE, "u1 should not yet be a member")
	t.Logf("invites: %v", spew.Sdump(team.chain().inner.ActiveInvites))
	invite, err := team.chain().FindActiveInvite(fus[1].GetUserVersion().Uid.String(), "keybase")
	require.NoError(t, err, "team should have invite for the puk-less user")
	require.Equal(t, keybase1.TeamRole_OWNER, invite.Role)
	require.Len(t, team.chain().inner.ActiveInvites, 1, "number of invites")
}

// Test loading an implicit team as a #reader.
func TestImplicitTeamReader(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	displayName := "" + fus[0].Username + ",bob@twitter#" + fus[1].Username
	t.Logf("U0 creates an implicit team: %v", displayName)
	teamID, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*public*/)
	require.NoError(t, err)

	t.Logf("U1 looks up the team")
	teamID2, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*public*/)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID2, "users should lookup the same team ID")

	t.Logf("U1 loads the team")
	team, err := Load(context.Background(), tcs[1].G, keybase1.LoadTeamArg{ID: teamID2})
	require.NoError(t, err)
	_, err = team.ApplicationKey(context.Background(), keybase1.TeamApplication_KBFS)
	require.NoError(t, err, "getting kbfs application key")
	require.False(t, team.IsPublic())
	u0Role, err := team.chain().GetUserRole(fus[0].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, u0Role)
	u1Role, err := team.chain().GetUserRole(fus[1].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, u1Role)
}
