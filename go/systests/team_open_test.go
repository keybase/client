package systests

import (
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestTeamOpenAutoAddMember(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	teamName, err := libkb.RandString("tt", 5)
	require.NoError(t, err)
	teamName = strings.ToLower(teamName)

	cli := own.teamsClient
	createRes, err := cli.TeamCreateWithSettings(context.TODO(), keybase1.TeamCreateWithSettingsArg{
		Name: teamName,
		Settings: keybase1.TeamSettings{
			Open:   true,
			JoinAs: keybase1.TeamRole_READER,
		},
	})
	require.NoError(t, err)
	teamID := createRes.TeamID

	t.Logf("Open team name is %q", teamName)

	roo.kickTeamRekeyd()
	ret, err := roo.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: teamName})
	require.NoError(t, err)
	require.Equal(t, true, ret.Open)

	own.waitForTeamChangedGregor(teamID, keybase1.Seqno(2))

	teamObj, err := teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
		Name:        teamName,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	role, err := teamObj.MemberRole(context.TODO(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_READER)
}

func TestTeamOpenSettings(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")

	teamName := own.createTeam()
	t.Logf("Open team name is %q", teamName)

	loadTeam := func() *teams.Team {
		ret, err := teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
			Name:        teamName,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		return ret
	}

	teamObj := loadTeam()
	require.Equal(t, teamObj.IsOpen(), false)

	err := teams.ChangeTeamSettings(context.TODO(), own.tc.G, teamName, keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_READER})
	require.NoError(t, err)

	teamObj = loadTeam()
	require.Equal(t, teamObj.IsOpen(), true)

	err = teams.ChangeTeamSettings(context.TODO(), own.tc.G, teamName, keybase1.TeamSettings{Open: false})
	require.NoError(t, err)

	teamObj = loadTeam()
	require.Equal(t, teamObj.IsOpen(), false)
}

func TestOpenSubteamAdd(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	// Creating team, subteam, sending open setting, checking if it's set.

	team := own.createTeam()

	parentName, err := keybase1.TeamNameFromString(team)
	require.NoError(t, err)

	subteam, err := teams.CreateSubteam(context.TODO(), own.tc.G, "zzz", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	t.Logf("Open team name is %q, subteam is %q", team, subteam)

	subteamObj, err := teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
		ID:          *subteam,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	err = teams.ChangeTeamSettings(context.TODO(), own.tc.G, subteamObj.Name().String(), keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_READER})
	require.NoError(t, err)

	subteamObj, err = teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
		ID:          *subteam,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, subteamObj.IsOpen(), true)

	// Kick rekeyd so team request notifications come quicker.
	roo.kickTeamRekeyd()

	// User requesting access
	subteamNameStr := subteamObj.Name().String()
	roo.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: subteamNameStr})

	own.waitForTeamChangedGregor(*subteam, keybase1.Seqno(3))

	subteamObj, err = teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
		ID:          *subteam,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	role, err := subteamObj.MemberRole(context.TODO(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_READER)
}

func TestTeamOpenMultipleTars(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tar1 := tt.addUser("roo1")
	tar2 := tt.addUser("roo2")
	tar3 := tt.addUser("roo3")
	own := tt.addUser("own")
	tt.logUserNames()

	teamID, teamName := own.createTeam2()
	t.Logf("Open team name is %q", teamName.String())

	// Everyone requests access before team is open.
	tar1.teamsClient.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{Name: teamName.String()})
	tar2.teamsClient.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{Name: teamName.String()})
	tar3.teamsClient.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{Name: teamName.String()})

	// Change settings to open.
	tar3.kickTeamRekeyd()
	err := teams.ChangeTeamSettings(context.Background(), own.tc.G, teamName.String(), keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_READER})
	require.NoError(t, err)

	own.waitForTeamChangedGregor(teamID, keybase1.Seqno(3))

	teamObj, err := teams.Load(context.Background(), own.tc.G, keybase1.LoadTeamArg{
		Name:        teamName.String(),
		ForceRepoll: true,
	})
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		role, err := teamObj.MemberRole(context.Background(), tt.users[i].userVersion())
		require.NoError(t, err)
		require.Equal(t, role, keybase1.TeamRole_READER)
	}
}

func TestTeamOpenBans(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	bob := tt.addUser("bob")

	team := own.createTeam()
	t.Logf("Open team name is %q", team)

	teamName, err := keybase1.TeamNameFromString(team)
	require.NoError(t, err)

	t.Logf("Trying team edit cli...")
	runner := client.NewCmdTeamSettingsRunner(own.tc.G)
	runner.Team = teamName
	joinAsRole := keybase1.TeamRole_READER
	runner.JoinAsRole = &joinAsRole
	err = runner.Run()
	require.NoError(t, err)

	own.addTeamMember(team, bob.username, keybase1.TeamRole_READER)

	removeRunner := client.NewCmdTeamRemoveMemberRunner(own.tc.G)
	removeRunner.Team = team
	removeRunner.Username = bob.username
	removeRunner.Force = true
	err = removeRunner.Run()
	require.NoError(t, err)

	_, err = bob.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: team})
	require.Error(t, err)
	appErr, ok := err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, appErr.Code, libkb.SCTeamBanned)
}

func TestTeamOpenPuklessRequest(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	bob := tt.addPuklessUser("bob")

	team := own.createTeam()
	t.Logf("Open team name is %q", team)

	err := teams.ChangeTeamSettings(context.Background(), own.tc.G, team, keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_WRITER})
	require.NoError(t, err)

	// Bob is PUKless but he can still request access. But he will
	// only be keyed in when he gets a PUK.
	_, err = bob.teamsClient.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{Name: team})
	require.NoError(t, err)

	_, err = bob.teamsClient.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{Name: team})
	require.Error(t, err)
	t.Logf("Doubled TeamRequestAccess error is: %v", err)

	// Upgrading to PUK should trigger team_rekeyd and adding bob to
	// team by an admin.
	bob.kickTeamRekeyd()
	bob.perUserKeyUpgrade()

	own.pollForTeamSeqnoLink(team, keybase1.Seqno(3))

	teamObj := own.loadTeam(team, true /* admin */)
	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 2, len(members.AllUIDs())) // just owner
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)
}

// Consider user that resets their account and tries to re-join.
func TestTeamOpenResetAndRejoin(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	tt.logUserNames()

	teamID, teamName := ann.createTeam2()
	team := teamName.String()
	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)
	err := teams.ChangeTeamSettings(context.Background(), ann.tc.G, team, keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_READER})
	require.NoError(t, err)

	t.Logf("Open team name is %q", team)

	bob.kickTeamRekeyd()
	bob.reset()

	// Wait for change membership link after bob resets
	ann.waitForRotateByID(teamID, keybase1.Seqno(4))

	bob.loginAfterResetPukless()
	_, err = bob.teamsClient.TeamRequestAccess(context.Background(), keybase1.TeamRequestAccessArg{Name: team})
	require.NoError(t, err)

	bob.kickTeamRekeyd()
	bob.perUserKeyUpgrade()

	// Poll for change_membership after bob's TAR gets acted on.
	ann.pollForTeamSeqnoLink(team, keybase1.Seqno(5))

	teamObj := ann.loadTeam(team, true /* admin */)

	require.Len(t, teamObj.GetActiveAndObsoleteInvites(), 0)

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUIDs(), 2)
	role, err := teamObj.MemberRole(context.Background(), bob.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, role)
}
