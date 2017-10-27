package systests

import (
	"strconv"
	"testing"
	"time"

	"golang.org/x/net/context"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestTeamInviteSeitanHappy(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	team := own.createTeam()

	t.Logf("Created team %q", team)

	token, err := own.teamsClient.TeamCreateSeitanToken(context.TODO(), keybase1.TeamCreateSeitanTokenArg{
		Name: team,
		Role: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	err = roo.teamsClient.TeamAcceptInvite(context.TODO(), keybase1.TeamAcceptInviteArg{
		Token: token,
	})
	require.NoError(t, err)

	t.Logf("User used token, waiting for rekeyd")

	own.kickTeamRekeyd()
	own.waitForTeamChangedGregor(team, keybase1.Seqno(3))

	t0, err := teams.GetTeamByNameForTest(context.TODO(), t, own.tc.G, team, false /* public */, true /* needAdmin */)
	require.NoError(t, err)

	role, err := t0.MemberRole(context.TODO(), teams.NewUserVersion(roo.uid, 1))
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_WRITER)
}

func TestTeamInviteSeitanFailures(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	team := own.createTeam()

	t.Logf("Created team %q", team)

	token, err := own.teamsClient.TeamCreateSeitanToken(context.TODO(), keybase1.TeamCreateSeitanTokenArg{
		Name: team,
		Role: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	// Generate invitation id, but make AKey with different IKey.
	// Simulate "replay attack" or similar.
	ikey, err := teams.GenerateIKeyFromString(token)
	require.NoError(t, err)
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)

	ikey2, err := teams.GenerateIKey()
	require.NoError(t, err)
	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)
	unixNow := time.Now().Unix()
	_, maliciousPayload, err := sikey2.GenerateAcceptanceKey(roo.uid, 1, unixNow)
	require.NoError(t, err)

	arg := libkb.NewAPIArgWithNetContext(context.TODO(), "team/seitan")
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args.Add("akey", libkb.S{Val: maliciousPayload})
	arg.Args.Add("now", libkb.S{Val: strconv.FormatInt(unixNow, 10)})
	arg.Args.Add("invite_id", libkb.S{Val: string(inviteID)})
	_, err = roo.tc.G.API.Post(arg)
	require.NoError(t, err)

	t.Logf("Preparet and send invalid akey, waiting for rekeyd")

	own.kickTeamRekeyd()
	pollingFound := false
	for i := 0; i < 20; i++ {
		after, err := teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
			Name:        team,
			ForceRepoll: true,
			NeedAdmin:   true,
		})
		require.NoError(t, err)
		if after.CurrentSeqno() >= 3 {
			t.Logf("Found new seqno %d at poll loop iter %d", after.CurrentSeqno(), i)
			pollingFound = true
			break
		}
		time.Sleep(500 * time.Millisecond)
	}

	require.True(t, pollingFound)

	t0, err := teams.GetTeamByNameForTest(context.TODO(), t, own.tc.G, team, false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.EqualValues(t, t0.CurrentSeqno(), 3)

	role, err := t0.MemberRole(context.TODO(), teams.NewUserVersion(roo.uid, 1))
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_NONE, role)
}
