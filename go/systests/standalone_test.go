package systests

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

type standaloneUserArgs struct {
	disableGregor            bool
	suppressTeamChatAnnounce bool
}

func makeUserStandalone(t *testing.T, pre string, opts standaloneUserArgs) *userPlusDevice {
	tctx := setupTest(t, pre)
	var u userPlusDevice

	g := tctx.G

	if opts.suppressTeamChatAnnounce {
		u.suppressTeamChatAnnounce = opts.suppressTeamChatAnnounce
		g.Env.Test.SkipSendingSystemChatMessages = true
	}

	if opts.disableGregor {
		// Some tests may want to disable gregor loop completely to
		// simulate user that stays offline when not doing anything.
		// Useful for teams tests to have a user that can post sigs
		// but will not respond to any rekeyd messages.
		g.Env.GetConfigWriter().SetBoolAtPath("push.disabled", true)
	}

	u.device = &deviceWrapper{tctx: tctx}

	// Mimic what keybase/main.go does for Standalone.
	var err error
	svc := service.NewService(tctx.G, false)
	err = svc.SetupCriticalSubServices()
	require.NoError(t, err)
	err = svc.StartLoopbackServer()
	require.NoError(t, err)

	g.StandaloneChatConnector = svc
	g.Standalone = true

	userInfo := randomUser(pre)

	signupUI := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(g),
	}
	g.SetUI(&signupUI)
	signup := client.NewCmdSignupRunner(g)
	signup.SetTest()
	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}
	t.Logf("signed up %s", userInfo.username)

	u.username = userInfo.username
	u.uid = libkb.UsernameToUID(u.username)
	u.tc = tctx

	cli, _, err := client.GetRPCClientWithContext(g)
	require.NoError(t, err)

	u.deviceClient = keybase1.DeviceClient{Cli: cli}
	u.teamsClient = keybase1.TeamsClient{Cli: cli}

	u.device.userClient = keybase1.UserClient{Cli: cli}
	u.device.accountClient = keybase1.AccountClient{Cli: cli}

	return &u
}

func TestStandaloneTeamMemberOps(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.users = append(tt.users, makeUserStandalone(t, "user1", standaloneUserArgs{}))
	tt.addUser("user2")

	team := tt.users[0].createTeam()

	g := tt.users[0].tc.G

	add := client.NewCmdTeamAddMemberRunner(g)
	add.Team = team
	add.Username = tt.users[1].username
	add.Role = keybase1.TeamRole_WRITER
	add.SkipChatNotification = false
	err := add.Run()
	require.NoError(t, err)

	// Check if adding worked
	t0, err := teams.GetTeamByNameForTest(context.TODO(), g, team, false, true)
	require.NoError(t, err)
	writers, err := t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Equal(t, len(writers), 1, "expected 1 writer")
	require.True(t, writers[0].Uid.Equal(tt.users[1].uid), "unexpected writer uid")

	// Do not care about result (printed to UI), just be sure that it
	// doesn't crash or fail.
	listmem := client.NewCmdTeamListMembershipsRunner(g)
	listmem.SetJSON(true)
	err = listmem.Run()
	require.NoError(t, err)

	listmem = client.NewCmdTeamListMembershipsRunner(g)
	listmem.SetJSON(true)
	listmem.SetTeam(team)
	err = listmem.Run()
	require.NoError(t, err)

	remove := client.NewCmdTeamRemoveMemberRunner(g)
	remove.Team = team
	remove.Username = tt.users[1].username
	remove.Force = true // avoid Yes/No prompt
	err = remove.Run()
	require.NoError(t, err)

	// Check if removal worked
	t0, err = teams.GetTeamByNameForTest(context.TODO(), g, team, false, true)
	require.NoError(t, err)
	writers, err = t0.UsersWithRole(keybase1.TeamRole_WRITER)
	require.NoError(t, err)
	require.Equal(t, len(writers), 0, "expected 0 writers")
}
