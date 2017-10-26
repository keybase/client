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
	_, err = cli.TeamCreateWithSettings(context.TODO(), keybase1.TeamCreateWithSettingsArg{
		Name:                 teamName,
		SendChatNotification: false,
		Settings: keybase1.TeamSettings{
			Open:   true,
			JoinAs: keybase1.TeamRole_READER,
		},
	})

	t.Logf("Open team name is %q", teamName)

	ret, err := roo.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: teamName})
	require.NoError(t, err)
	require.Equal(t, true, ret.Open)

	own.kickTeamRekeyd()
	own.waitForTeamChangedGregor(teamName, keybase1.Seqno(2))

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

	subteam, err := teams.CreateSubteam(context.TODO(), own.tc.G, "zzz", parentName)
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

	// User requesting access
	subteamNameStr := subteamObj.Name().String()
	roo.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: subteamNameStr})

	own.kickTeamRekeyd()
	own.waitForTeamChangedGregor(subteamNameStr, keybase1.Seqno(3))

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

	team := own.createTeam()
	t.Logf("Open team name is %q", team)

	// tar1 and tar2 request access before team is open.
	tar1.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: team})
	tar2.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: team})

	// Change settings to open
	err := teams.ChangeTeamSettings(context.TODO(), own.tc.G, team, keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_READER})
	require.NoError(t, err)

	// tar3 requests, but rekeyd will grab all requests
	tar3.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: team})

	own.kickTeamRekeyd()
	own.waitForTeamChangedGregor(team, keybase1.Seqno(3))

	teamObj, err := teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
		Name:        team,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		role, err := teamObj.MemberRole(context.TODO(), tt.users[i].userVersion())
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
	runner.Settings = keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_READER,
	}
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
