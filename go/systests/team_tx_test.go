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

	teamObj := ann.loadTeam(team, true /* admin */)

	tx := teams.CreateAddMemberTx(teamObj)
	tx.AddMemberTransaction(context.Background(), bob.username, keybase1.TeamRole_WRITER)
	tx.AddMemberTransaction(context.Background(), tracy.username, keybase1.TeamRole_READER)

	err := tx.Post(context.Background())
	require.NoError(t, err)

	// TRANSACTION 2 - bob gets puk, add bob but not through SBS - we
	// expect the invite to be sweeped away by this transaction.

	bob.perUserKeyUpgrade()

	teamObj = ann.loadTeam(team, true /* admin */)

	tx = teams.CreateAddMemberTx(teamObj)
	tx.AddMemberTransaction(context.Background(), bob.username, keybase1.TeamRole_WRITER)
	tx.RemoveMember(tracy.userVersion())
	spew.Dump(tx.DebugPayloads())

	err = tx.Post(context.Background())
	require.NoError(t, err)

	teamObj = ann.loadTeam(team, true /* admin */)
}

func TestTeamTxDependency(t *testing.T) {
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

	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)

	bob.perUserKeyUpgrade()

	// Transaction time!

	// The transaction will try to achieve the following:
	// 1) Add Tracy as crypto member,
	// 2) sweep old bob@keybase invite (pukless member),
	// 3) add bob as crypto member.

	// The catch is that (3) depends on (2), so signature that does
	// (3) has to happen after (2). Signatures in flight after (2) are
	// as follows:
	// 1. change_membership (adds: trc)
	// 2. invite (cancel: bob@keybase)

	// Adding bob as a crypto member should not mutate change_membership 1.,
	// but instead create new change_membership.

	// As of 16.01.2018 this is just future proofing teamtx code -
	// server wouldn't have cared if we added duplicate bob when
	// invite was still active. But we may flip the switch in the
	// future.

	// TODO: Same test is needed but with flipped logic:
	// bob starts as crypto member, but then resets and admin wants to
	// read them as pukless. invite signature for bob@keybase would
	// have a dependency on change_signature sweeping bob.

	teamObj := ann.loadTeam(team, true /* admin */)

	tx := teams.CreateAddMemberTx(teamObj)
	tx.AddMemberTransaction(context.Background(), tracy.username, keybase1.TeamRole_READER)
	tx.AddMemberTransaction(context.Background(), bob.username, keybase1.TeamRole_WRITER)

	payloads := tx.DebugPayloads()
	// TODO: this has to pass once this feature actually work.
	// require.Equal(t, 3, len(payloads))
	_ = payloads

	err := tx.Post(context.Background())
	require.NoError(t, err)
}
