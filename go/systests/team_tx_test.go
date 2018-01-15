package systests

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"

	"github.com/davecgh/go-spew/spew"
)

func TestTeamTransactions(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := makeUserStandalone(t, "ann", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	tt.users = append(tt.users, ann)
	t.Logf("Signed up ann (%s)", ann.username)

	bob := tt.addPuklessUser("bob")
	t.Logf("Signed up PUK-less user bob (%s)", bob.username)

	tracy := tt.addUser("trc")
	t.Logf("Signed up PUK-ful user trc (%s)", tracy.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	// TRANSACTION 1 - add bob (keybase-type invite) and tracy (crypto member)

	teamObj, err := teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{
		Name:      team,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	tx := teams.CreateAddMemberTx(teamObj)
	tx.AddMemberTransaction(context.Background(), ann.tc.G, bob.username, keybase1.TeamRole_WRITER)
	tx.AddMemberTransaction(context.Background(), ann.tc.G, tracy.username, keybase1.TeamRole_READER)

	err = tx.Post(context.Background(), ann.tc.G)
	require.NoError(t, err)

	// TRANSACTION 2 - bob gets puk, add bob but not through SBS.
	bob.perUserKeyUpgrade()

	teamObj, err = teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{
		Name:        team,
		NeedAdmin:   true,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	tx = teams.CreateAddMemberTx(teamObj)
	tx.AddMemberTransaction(context.Background(), ann.tc.G, bob.username, keybase1.TeamRole_WRITER)
	tx.RemoveMember(tracy.userVersion())
	spew.Dump(tx.DebugPayloads())

	err = tx.Post(context.Background(), ann.tc.G)
	require.NoError(t, err)
}
