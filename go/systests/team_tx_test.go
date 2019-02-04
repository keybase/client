package systests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

func testTeamTx1(t *testing.T, byUV bool) {
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
	if byUV {
		tx.AddMemberByUV(context.Background(), bob.userVersion(), keybase1.TeamRole_WRITER)
		tx.AddMemberByUV(context.Background(), tracy.userVersion(), keybase1.TeamRole_READER)
	} else {
		tx.AddMemberByUsername(context.Background(), bob.username, keybase1.TeamRole_WRITER)
		tx.AddMemberByUsername(context.Background(), tracy.username, keybase1.TeamRole_READER)
	}

	err := tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)

	teamObj = ann.loadTeam(team, true /* admin */)
	require.Equal(t, 1, teamObj.NumActiveInvites())
	invites := teamObj.GetActiveAndObsoleteInvites()
	require.Equal(t, 1, len(invites))
	for _, invite := range teamObj.GetActiveAndObsoleteInvites() {
		uv, err := invite.KeybaseUserVersion()
		require.NoError(t, err)
		require.EqualValues(t, bob.userVersion(), uv)
	}

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 0, len(members.Admins))
	require.Equal(t, 0, len(members.Writers))
	require.Equal(t, 1, len(members.Readers))
	require.EqualValues(t, tracy.userVersion(), members.Readers[0])

	// TRANSACTION 2 - bob gets puk, add bob but not through SBS - we
	// expect the invite to be sweeped away by this transaction.

	bob.perUserKeyUpgrade()

	teamObj = ann.loadTeam(team, true /* admin */)
	tx = teams.CreateAddMemberTx(teamObj)
	tx.AddMemberByUsername(context.Background(), bob.username, keybase1.TeamRole_WRITER)

	err = tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)

	teamObj = ann.loadTeam(team, true /* admin */)
	members, err = teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 0, len(members.Admins))
	require.Equal(t, 1, len(members.Readers))
	require.Equal(t, 1, len(members.Writers))
	require.EqualValues(t, bob.userVersion(), members.Writers[0])
	require.Equal(t, 0, len(teamObj.GetActiveAndObsoleteInvites()))
}

func TestTeamTxAddByUsername(t *testing.T) {
	testTeamTx1(t, false /* byUV */)
}

func TestTeamTxAddByUV(t *testing.T) {
	testTeamTx1(t, true /* byUV */)
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

	teamObj := ann.loadTeam(team, true /* admin */)
	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 0, len(members.Admins)+len(members.Writers)+len(members.Readers))
	require.EqualValues(t, ann.userVersion(), members.Owners[0])
	require.Equal(t, 1, teamObj.NumActiveInvites())

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

	teamObj = ann.loadTeam(team, true /* admin */)

	tx := teams.CreateAddMemberTx(teamObj)
	tx.AddMemberByUsername(context.Background(), tracy.username, keybase1.TeamRole_READER)
	tx.AddMemberByUsername(context.Background(), bob.username, keybase1.TeamRole_WRITER)

	payloads := tx.DebugPayloads()
	require.Equal(t, 3, len(payloads))

	err = tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)

	// State is still fine even without ordering, because nor server
	// neither team player cares about that.

	teamObj = ann.loadTeam(team, true /* admin */)
	members, err = teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 0, len(members.Admins))
	require.Equal(t, 1, len(members.Writers))
	require.Equal(t, 1, len(members.Readers))
	require.EqualValues(t, ann.userVersion(), members.Owners[0])
	require.EqualValues(t, tracy.userVersion(), members.Readers[0])
	require.EqualValues(t, bob.userVersion(), members.Writers[0])
	require.Equal(t, 0, teamObj.NumActiveInvites())
	require.Equal(t, 0, len(teamObj.GetActiveAndObsoleteInvites()))

	// Try the opposite logic: reset bob, and try to re-add them as
	// pukless. The `invite` link should happen after crypto member
	// sweeping `change_membership`.
	bob.reset()
	bob.loginAfterResetPukless()

	tx = teams.CreateAddMemberTx(teamObj)
	tx.AddMemberByAssertionOrEmail(context.Background(), fmt.Sprintf("%s@rooter", tracy.username), keybase1.TeamRole_WRITER)
	tx.AddMemberByUsername(context.Background(), bob.username, keybase1.TeamRole_WRITER)

	payloads = tx.DebugPayloads()
	require.Equal(t, 3, len(payloads))

	err = tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)
}

func TestTeamTxSweepMembers(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up user ann (%s)", ann.username)

	bob := tt.addUser("bob")
	t.Logf("Signed up user bob (%s)", bob.username)

	pat := tt.addPuklessUser("pat")
	t.Logf("Signed up PUKless user pat (%s)", pat.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)

	bob.reset()
	bob.loginAfterReset()

	t.Logf("Bob (%s) resets and reprovisions, he is now: %v", bob.username, bob.userVersion())

	// Wait for CLKR and RotateKey link.
	ann.waitForRotateByID(ann.loadTeam(team, false /* admin */).ID, keybase1.Seqno(3))

	teamObj := ann.loadTeam(team, true /* admin */)
	tx := teams.CreateAddMemberTx(teamObj)
	err := tx.AddMemberByUsername(context.Background(), bob.username, keybase1.TeamRole_READER)
	require.NoError(t, err)
	err = tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)

	teamObj = ann.loadTeam(team, true /* admin */)
	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 1, len(members.Readers))
	require.Equal(t, 0, len(members.Admins)+len(members.Writers))
	require.EqualValues(t, ann.userVersion(), members.Owners[0])
	require.EqualValues(t, bob.userVersion(), members.Readers[0])
	require.Equal(t, 0, len(teamObj.GetActiveAndObsoleteInvites()))
}

func TestTeamTxMultipleMembers(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up user ann (%s)", ann.username)

	// user 0 - ann, team owner
	// user 1,2,3 - zzz, normal user
	// user 4,5,6 - yyy, pukless user

	for i := 0; i < 3; i++ {
		user := tt.addUser("zzz")
		t.Logf("Signed up normal user %d (%s, %v)", i, user.username, user.userVersion())
	}

	for i := 0; i < 3; i++ {
		user := tt.addPuklessUser("yyy")
		t.Logf("Signed up pukless user %d (%s, %v)", i, user.username, user.userVersion())
	}

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	teamObj := ann.loadTeam(team, true /* admin */)
	tx := teams.CreateAddMemberTx(teamObj)
	for i := 1; i < 7; i++ {
		err := tx.AddMemberByUsername(context.Background(), tt.users[i].username, keybase1.TeamRole_WRITER)
		require.NoError(t, err)
	}
	err := tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)

	for i := 4; i <= 5; i++ {
		user := tt.users[i]
		user.reset()
		user.loginAfterReset()
		t.Logf("Reset pukless user %d (%s, %v)", i, user.username, user.userVersion())
	}

	teamObj = ann.loadTeam(team, true /* admin */)
	tx = teams.CreateAddMemberTx(teamObj)
	for i := 4; i <= 5; i++ {
		err := tx.AddMemberByUsername(context.Background(), tt.users[i].username, keybase1.TeamRole_WRITER)
		require.NoError(t, err)
	}
	err = tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)

	teamObj = ann.loadTeam(team, true /* admin */)
	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 5, len(members.Writers))
	require.Equal(t, 0, len(members.Readers)+len(members.Admins))
	invites := teamObj.GetActiveAndObsoleteInvites()
	require.Equal(t, 1, len(invites))
	for _, invite := range invites {
		uv, err := invite.KeybaseUserVersion()
		require.NoError(t, err)
		require.Equal(t, tt.users[6].userVersion(), uv)
	}
}

func TestTeamTxSubteamAdmins(t *testing.T) {
	// Test if AddMemberTx properly keys implicit admins to teams
	// through the use of 'implicit_team_keys'.

	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up user ann (%s)", ann.username)

	bob := tt.addUser("bob")
	t.Logf("Signed up user bob (%s)", bob.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	teamName, err := keybase1.TeamNameFromString(team)
	require.NoError(t, err)
	_, err = teams.CreateSubteam(context.Background(), ann.tc.G, "golfers", teamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	_, err = teams.CreateSubteam(context.Background(), ann.tc.G, "pokerpals", teamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	teamObj := ann.loadTeam(team, true /* admin */)
	tx := teams.CreateAddMemberTx(teamObj)
	err = tx.AddMemberByUsername(context.Background(), bob.username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)
	err = tx.Post(libkb.NewMetaContextForTest(*ann.tc))
	require.NoError(t, err)
}

func TestTeamTxBadAdds(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up user ann (%s)", ann.username)

	bob := tt.addUser("bob")
	t.Logf("Signed up user bob (%s)", bob.username)

	bobUV := bob.userVersion()
	bob.reset()

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	teamObj := ann.loadTeam(team, true /* admin */)
	tx := teams.CreateAddMemberTx(teamObj)

	// Tring to add bob using old UV (from before reset)
	err := tx.AddMemberByUV(context.Background(), bobUV, keybase1.TeamRole_WRITER)
	require.Error(t, err)
	require.True(t, tx.IsEmpty())

	bob.loginAfterReset()
	bobUV = bob.userVersion()

	bob.delete()

	// Trying to add deleted bob.
	err = tx.AddMemberByUV(context.Background(), bobUV, keybase1.TeamRole_WRITER)
	require.Error(t, err)
	require.True(t, tx.IsEmpty())
}
