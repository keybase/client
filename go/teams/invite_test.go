package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestObsoletingInvites1(t *testing.T) {
	tc := SetupTest(t, "team", 0)
	defer tc.Cleanup()

	// This chain has 3 keybase invites total:
	// 1) 579651b0d574971040b531b66efbc519%1
	// 2) 618d663af0f1ec88a5a19defa65a2f19%1
	// 3) 40903c59d19feef1d67c455499304c19%1
	//
	// 1 gets obsoleted by "change_membership" link that adds the same
	// person but does not complete the invite. 2 is canceled by
	// "invite" link. 3 should be still active when the chain is done
	// replaying.
	team, _ := runUnitFromFilename(t, "invite_obsolete.json")

	require.Equal(t, 1, team.NumActiveInvites())

	allInvites := team.GetActiveAndObsoleteInvites()
	require.Equal(t, 2, len(allInvites))

	hasInvite, err := team.HasActiveInvite(tc.MetaContext(), keybase1.TeamInviteName("579651b0d574971040b531b66efbc519%1"), "keybase")
	require.NoError(t, err)
	require.False(t, hasInvite)

	hasInvite, err = team.HasActiveInvite(tc.MetaContext(), keybase1.TeamInviteName("618d663af0f1ec88a5a19defa65a2f19%1"), "keybase")
	require.NoError(t, err)
	require.False(t, hasInvite)

	hasInvite, err = team.HasActiveInvite(tc.MetaContext(), keybase1.TeamInviteName("40903c59d19feef1d67c455499304c19%1"), "keybase")
	require.NoError(t, err)
	require.True(t, hasInvite)

	// Invite
	invite, ok := allInvites["56eafff3400b5bcd8b40bff3d225ab27"]
	require.True(t, ok)
	require.Equal(t, keybase1.TeamRole_READER, invite.Role)
	require.EqualValues(t, "56eafff3400b5bcd8b40bff3d225ab27", invite.Id)
	require.EqualValues(t, "40903c59d19feef1d67c455499304c19%1", invite.Name)
	require.EqualValues(t, keybase1.UserVersion{Uid: "25852c87d6e47fb8d7d55400be9c7a19", EldestSeqno: 1}, invite.Inviter)

	members, err := team.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, 0, len(members.Admins))
	require.Equal(t, 1, len(members.Writers))
	require.Equal(t, 0, len(members.Readers))
}

func TestObsoletingInvites2(t *testing.T) {
	// This chain is a backwards-compatibility test to see if even if
	// someone got tricked into accepting obsolete invite, such chain
	// should still play and result in predictable end state.
	team, _ := runUnitFromFilename(t, "invite_obsolete_trick.json")
	require.Equal(t, 0, len(team.chain().inner.ActiveInvites))
	require.True(t, team.IsMember(context.Background(), keybase1.UserVersion{Uid: "579651b0d574971040b531b66efbc519", EldestSeqno: 1}))
}

// Keybase invites (PUKless members) are removed similarly to
// cryptomembers, by using RemoveMember(username) API. It's important
// that the invite can even be removed after user has reset or deleted
// their account.

func setupPuklessInviteTest(t *testing.T) (tc libkb.TestContext, owner, other *kbtest.FakeUser, teamname string) {
	tc = SetupTest(t, "team", 1)

	tc.Tp.DisableUpgradePerUserKey = true
	tc.Tp.SkipSendingSystemChatMessages = true
	other, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout(context.TODO())

	tc.Tp.DisableUpgradePerUserKey = false
	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamname = createTeam(tc)

	t.Logf("Signed up PUKless user %s", other.Username)
	t.Logf("Signed up user %s", owner.Username)
	t.Logf("Created team %s", teamname)

	return tc, owner, other, teamname
}

func TestKeybaseInviteAfterReset(t *testing.T) {
	tc, owner, other, teamname := setupPuklessInviteTest(t)
	defer tc.Cleanup()

	// Add member - should be added as keybase-type invite with name "uid%1".
	res, err := AddMember(context.Background(), tc.G, teamname, other.Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)
	require.True(t, res.Invited)

	// Reset account, should now have EldestSeqno=0
	tc.G.Logout(context.TODO())
	require.NoError(t, other.Login(tc.G))
	kbtest.ResetAccount(tc, other)

	// Try to remove member
	require.NoError(t, owner.Login(tc.G))
	err = RemoveMember(context.Background(), tc.G, teamname, other.Username)
	require.NoError(t, err)

	// Expecting all invites to be gone.
	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{Name: teamname})
	require.NoError(t, err)
	require.Len(t, team.GetActiveAndObsoleteInvites(), 0)
}

func TestKeybaseInviteMalformed(t *testing.T) {
	tc, owner, other, teamname := setupPuklessInviteTest(t)
	defer tc.Cleanup()

	// Pretend it's an old client.
	invite := SCTeamInvite{
		Type: "keybase",
		// Use name that is not "uid%seqno" but just "uid" instead.
		Name: keybase1.TeamInviteName(other.User.GetUID()),
		ID:   NewInviteID(),
	}
	invites := []SCTeamInvite{invite}
	payload := SCTeamInvites{
		Readers: &invites,
	}
	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{Name: teamname})
	require.NoError(t, err)
	err = team.postTeamInvites(context.Background(), payload)
	require.NoError(t, err)

	// Try to remove member
	require.NoError(t, owner.Login(tc.G))
	err = RemoveMember(context.Background(), tc.G, teamname, other.Username)
	require.NoError(t, err)

	// Expecting all invites to be gone.
	team, err = Load(context.Background(), tc.G, keybase1.LoadTeamArg{Name: teamname})
	require.NoError(t, err)
	require.Len(t, team.GetActiveAndObsoleteInvites(), 0)
}
