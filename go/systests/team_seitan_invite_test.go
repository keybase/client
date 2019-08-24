package systests

import (
	"strconv"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestTeamInviteSeitanFailures(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	teamID, teamName := own.createTeam2()

	t.Logf("Created team %q", teamName.String())

	token, err := own.teamsClient.TeamCreateSeitanToken(context.Background(), keybase1.TeamCreateSeitanTokenArg{
		Name: teamName.String(),
		Role: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	// Generate invitation id, but make AKey with different IKey.
	// Simulate "replay attack" or similar.
	ikey, err := teams.ParseIKeyFromString(string(token))
	require.NoError(t, err)
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	inviteIDx, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	inviteID, err := keybase1.TeamInviteIDFromString(string(inviteIDx))
	require.NoError(t, err)

	ikey2, err := teams.GenerateIKey()
	require.NoError(t, err)
	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)
	unixNow := time.Now().Unix()
	_, maliciousPayload, err := sikey2.GenerateAcceptanceKey(roo.uid, roo.userVersion().EldestSeqno, unixNow)
	require.NoError(t, err)

	arg := libkb.NewAPIArg("team/seitan")
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args.Add("akey", libkb.S{Val: maliciousPayload})
	arg.Args.Add("now", libkb.S{Val: strconv.FormatInt(unixNow, 10)})
	arg.Args.Add("invite_id", libkb.S{Val: string(inviteID)})
	mctx := libkb.NewMetaContextBackground(roo.tc.G)
	_, err = roo.tc.G.API.Post(mctx, arg)
	require.NoError(t, err)

	t.Logf("handle synthesized rekeyd command")
	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{{
			InviteID:    inviteID,
			Uid:         roo.uid,
			EldestSeqno: roo.userVersion().EldestSeqno,
			Akey:        keybase1.SeitanAKey(maliciousPayload),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   unixNow,
		}},
	}
	err = teams.HandleTeamSeitan(context.Background(), own.tc.G, msg)
	require.NoError(t, err)

	t.Logf("invite should still be there")
	t0, err := teams.GetTeamByNameForTest(context.Background(), own.tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.Equal(t, 1, t0.NumActiveInvites(), "invite should still be active")
	require.EqualValues(t, t0.CurrentSeqno(), 2)

	t.Logf("user should not be in team")
	role, err := t0.MemberRole(context.Background(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_NONE, role, "user role")
}
