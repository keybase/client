package teams

import (
	"context"
	"errors"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestObsoletingInvites1(t *testing.T) {
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

	mctx := team.MetaContext(context.Background())

	require.Equal(t, 1, team.NumActiveInvites())

	allInvites := team.GetActiveAndObsoleteInvites()
	require.Equal(t, 2, len(allInvites))

	hasInvite, err := team.HasActiveInvite(mctx, keybase1.TeamInviteName("579651b0d574971040b531b66efbc519%1"), "keybase")
	require.NoError(t, err)
	require.False(t, hasInvite)

	hasInvite, err = team.HasActiveInvite(mctx, keybase1.TeamInviteName("618d663af0f1ec88a5a19defa65a2f19%1"), "keybase")
	require.NoError(t, err)
	require.False(t, hasInvite)

	hasInvite, err = team.HasActiveInvite(mctx, keybase1.TeamInviteName("40903c59d19feef1d67c455499304c19%1"), "keybase")
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
	require.Equal(t, 0, len(members.Bots))
	require.Equal(t, 0, len(members.RestrictedBots))
}

func TestObsoletingInvites2(t *testing.T) {
	// This chain is a backwards-compatibility test to see if even if
	// someone got tricked into accepting obsolete invite, such chain
	// should still play and result in predictable end state.
	team, _ := runUnitFromFilename(t, "invite_obsolete_trick.json")
	require.Equal(t, 0, len(team.chain().ActiveInvites()))
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
	err = tc.Logout()
	require.NoError(t, err)

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
	err = tc.Logout()
	require.NoError(t, err)
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

func TestMultiUseInviteChains1(t *testing.T) {
	team, _ := runUnitFromFilename(t, "multiple_use_invite.json")

	state := &team.chain().inner
	require.Len(t, state.InviteMetadatas, 1)

	var inviteID keybase1.TeamInviteID
	var inviteMD keybase1.TeamInviteMetadata
	for _, inviteMD = range state.InviteMetadatas {
		inviteID = inviteMD.Invite.Id
		break // grab first invite
	}
	invite := inviteMD.Invite

	require.Equal(t, inviteID, invite.Id)
	require.Nil(t, invite.Etime)
	require.NotNil(t, invite.MaxUses)
	require.Equal(t, keybase1.TeamInviteMaxUses(10), *invite.MaxUses)

	require.Len(t, inviteMD.UsedInvites, 3)

	for _, usedInvitePair := range inviteMD.UsedInvites {
		// Check if UserLog pointed at by usedInvitePair exists (otherwise
		// crash on map/list access).
		ulog := state.UserLog[usedInvitePair.Uv][usedInvitePair.LogPoint]
		require.Equal(t, ulog.Role, invite.Role)
	}
}

func TestMultiUseInviteChains2(t *testing.T) {
	team, _ := runUnitFromFilename(t, "multiple_use_invite_3.json")

	state := &team.chain().inner
	require.Len(t, state.ActiveInvites(), 1)

	var inviteID keybase1.TeamInviteID
	var invite keybase1.TeamInvite
	for _, invite = range state.ActiveInvites() {
		inviteID = invite.Id
		break // grab first invite
	}

	require.Equal(t, inviteID, invite.Id)
	require.Nil(t, invite.Etime)
	require.NotNil(t, invite.MaxUses)
	require.Equal(t, keybase1.TeamInviteMaxUses(999), *invite.MaxUses)

	usedInvitesForID := state.InviteMetadatas[inviteID].UsedInvites
	require.Len(t, usedInvitesForID, 3)

	require.Equal(t, keybase1.UserVersion{
		Uid:         "579651b0d574971040b531b66efbc519",
		EldestSeqno: keybase1.Seqno(1),
	}, usedInvitesForID[0].Uv)
	require.Equal(t, 0, usedInvitesForID[0].LogPoint)

	require.Equal(t, keybase1.UserVersion{
		Uid:         "40903c59d19feef1d67c455499304c19",
		EldestSeqno: keybase1.Seqno(1),
	}, usedInvitesForID[1].Uv)
	require.Equal(t, 0, usedInvitesForID[1].LogPoint)

	require.Equal(t, keybase1.UserVersion{
		Uid:         "579651b0d574971040b531b66efbc519",
		EldestSeqno: keybase1.Seqno(1),
	}, usedInvitesForID[2].Uv)
	// Logpoint 0 is when they first join, logpoint 1 is when they leave, and
	// logpoint 2 is the second join.
	require.Equal(t, 2, usedInvitesForID[2].LogPoint)

	for _, usedInvitePair := range usedInvitesForID {
		// Check if UserLog pointed at by usedInvitePair exists (otherwise
		// crash on map/list access).
		ulog := state.UserLog[usedInvitePair.Uv][usedInvitePair.LogPoint]
		require.Equal(t, ulog.Role, invite.Role)
	}

	members, err := team.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUIDs(), 3)
}

func TestTeamInviteMaxUsesUnit(t *testing.T) {
	// -1 is valid and any positive number is valid.
	good := []int{-1, 1, 100, 999, 9999, math.MaxInt64}
	bad := []int{0, -2, -1000, math.MinInt64, math.MinInt32}

	for _, v := range good {
		require.True(t, keybase1.TeamInviteMaxUses(v).IsValid())
	}

	for _, v := range bad {
		require.False(t, keybase1.TeamInviteMaxUses(v).IsValid())
	}

	// -1 is a special value that means infinite uses.
	require.False(t, keybase1.TeamInviteMaxUses(1).IsInfiniteUses())
	require.False(t, keybase1.TeamInviteMaxUses(2).IsInfiniteUses())
	require.False(t, keybase1.TeamInviteMaxUses(100).IsInfiniteUses())

	require.True(t, keybase1.TeamInviteMaxUses(-1).IsInfiniteUses())
}

func makeTestSCForInviteLink() SCTeamInvite {
	return SCTeamInvite{
		Type: "invitelink",
		Name: keybase1.TeamInviteName("test"),
		ID:   NewInviteID(),
	}
}

func TestTeamPlayerInviteMaxUses(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	section := makeTestSCTeamSection(team)
	invite := makeTestSCForInviteLink()
	inviteID := invite.ID

	badMaxUses := []int{0, -2, -1000}
	for _, v := range badMaxUses {
		maxUses := keybase1.TeamInviteMaxUses(v)
		invite.MaxUses = &maxUses
		section.Invites = &SCTeamInvites{
			Readers: &[]SCTeamInvite{invite},
		}

		_, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
			section, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), fmt.Sprintf("invalid max_uses %d", v))
		require.Contains(t, err.Error(), inviteID)
	}

	goodMaxUses := []int{-1, 1, 100, 9999}
	for _, v := range goodMaxUses {
		maxUses := keybase1.TeamInviteMaxUses(v)
		invite.MaxUses = &maxUses
		section.Invites = &SCTeamInvites{
			Readers: &[]SCTeamInvite{invite},
		}

		state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
			section, me, nil /* merkleRoot */)
		require.NoError(t, err)
		require.Len(t, state.ActiveInvites(), 1)
		_, found := state.FindActiveInviteMDByID(keybase1.TeamInviteID(inviteID))
		require.True(t, found)
	}
}

var singleUse = keybase1.TeamInviteMaxUses(1)

func TestTeamPlayerEtime(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	section := makeTestSCTeamSection(team)
	invite := makeTestSCForInviteLink()
	inviteID := invite.ID

	badEtime := []keybase1.UnixTime{0, -100}
	for _, v := range badEtime {
		invite.Etime = &v
		invite.MaxUses = &singleUse
		section.Invites = &SCTeamInvites{
			Readers: &[]SCTeamInvite{invite},
		}

		_, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
			section, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), fmt.Sprintf("invalid etime %d", v))
		require.Contains(t, err.Error(), inviteID)
	}

	etime := keybase1.ToUnixTime(time.Now())
	invite.Etime = &etime
	invite.MaxUses = &singleUse
	section.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{invite},
	}

	state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	require.NoError(t, err)
	require.Len(t, state.ActiveInvites(), 1)
	_, found := state.FindActiveInviteMDByID(keybase1.TeamInviteID(inviteID))
	require.True(t, found)
}

func TestTeamPlayerInviteLinksImplicitTeam(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, true /* implicitTeam */)
	defer tc.Cleanup()

	section := makeTestSCTeamSection(team)
	invite := makeTestSCForInviteLink()
	maxUses := keybase1.TeamInviteMaxUses(100)
	invite.MaxUses = &maxUses
	inviteID := invite.ID
	section.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{invite},
	}

	_, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	requirePrecheckError(t, err)
	require.Contains(t, err.Error(), "new-style in implicit team")
	require.Contains(t, err.Error(), inviteID)
}

func TestTeamPlayerNoInvitelinksForAdmins(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	section := makeTestSCTeamSection(team)
	invite := makeTestSCForInviteLink()
	maxUses := keybase1.TeamInviteMaxUses(100)
	invite.MaxUses = &maxUses
	inviteID := invite.ID
	section.Invites = &SCTeamInvites{
		Admins: &[]SCTeamInvite{invite},
	}
	_, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	requirePrecheckError(t, err)

	var ie InviteError
	require.True(t, errors.As(err, &ie))
	require.Equal(t, inviteID, SCTeamInviteID(ie.id))

	var ile InvitelinkBadRoleError
	require.True(t, errors.As(err, &ile))
	require.Equal(t, keybase1.TeamRole_ADMIN, ile.role)
}

func TestTeamPlayerInviteLinkBadAdds(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	testUV := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice_t"), EldestSeqno: 1}
	// testUV2 is same UID as testUV but different eldest_seqno.
	testUV2 := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice_t"), EldestSeqno: 5}
	testUV3 := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_doug_t"), EldestSeqno: 1}
	testUV4 := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_bob_t"), EldestSeqno: 1}

	teamSectionForInvite := makeTestSCTeamSection(team)
	sectionInvite := makeTestSCForInviteLink()
	maxUses := keybase1.TeamInviteMaxUses(100)
	sectionInvite.MaxUses = &maxUses
	inviteID := sectionInvite.ID
	teamSectionForInvite.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{sectionInvite},
	}

	state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		teamSectionForInvite, me, nil /* merkleRoot */)
	require.NoError(t, err)
	_, found := state.FindActiveInviteMDByID(keybase1.TeamInviteID(inviteID))
	require.True(t, found)

	{
		// Trying to add the members as role=writer and "use invite", but the
		// invite was for role=reader.
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = &SCTeamMembers{
			Writers: &[]SCTeamMember{SCTeamMember(testUV)},
		}
		teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
			{InviteID: inviteID, UV: testUV.PercentForm()},
		}
		_, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), fmt.Sprintf("%s that was not added as role reader", testUV.String()))
	}

	{
		// Trying to append change_membership with used_invites for UV that's not
		// being added in the link.
		teamSectionCM := makeTestSCTeamSection(team)
		for _, badUV := range []keybase1.UserVersion{testUV2, testUV3} {
			// Member with correct role this time.
			teamSectionCM.Members = &SCTeamMembers{
				Readers: &[]SCTeamMember{SCTeamMember(testUV)},
			}
			// But used_invites uv doesn't match.
			teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
				{InviteID: inviteID, UV: badUV.PercentForm()},
			}
			_, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
				teamSectionCM, me, nil /* merkleRoot */)
			requirePrecheckError(t, err)
			require.Contains(t, err.Error(), fmt.Sprintf("%s that was not added as role reader", badUV.String()))
		}
	}

	{
		// used_invites in link that does not add any members at all.
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = &SCTeamMembers{}
		teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
			{InviteID: inviteID, UV: testUV.PercentForm()},
		}
		_, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), fmt.Sprintf("%s that was not added as role reader", testUV.String()))
	}

	{
		// One of the UVs doesn't match, the other one does.
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = &SCTeamMembers{
			Readers: &[]SCTeamMember{SCTeamMember(testUV)},
			Writers: &[]SCTeamMember{SCTeamMember(testUV3)},
		}
		// But used_invites uv doesn't match.
		teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
			{InviteID: inviteID, UV: testUV.PercentForm()},
			{InviteID: inviteID, UV: testUV4.PercentForm()},
		}
		_, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), fmt.Sprintf("%s that was not added as role reader", testUV4.String()))
	}
}

func TestTeamPlayerBadUsedInvites(t *testing.T) {
	// Test used_invites for invites that are not compatible. For used_invites
	// entry to be valid, the invite should define `max_uses`. Any other
	// invite, including invites with `etime`, is incompatible with
	// `used_invites`, and `completed_invites` should be used instead.

	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	testUV := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice_t"), EldestSeqno: 1}

	// Seitan invite without `max_uses` or `etime`.
	scInvite1 := makeTestSCForInviteLink()

	// Seitan invite with `etime`.
	scInvite2 := makeTestSCForInviteLink()
	etime := keybase1.ToUnixTime(time.Now())
	scInvite2.Etime = &etime

	teamSectionForInvite := makeTestSCTeamSection(team)
	for _, scInvite := range []SCTeamInvite{scInvite1, scInvite2} {
		inviteID := scInvite.ID
		teamSectionForInvite.Invites = &SCTeamInvites{
			Readers: &[]SCTeamInvite{scInvite},
		}

		state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
			teamSectionForInvite, me, nil /* merkleRoot */)
		require.NoError(t, err)
		_, found := state.FindActiveInviteMDByID(keybase1.TeamInviteID(inviteID))
		require.True(t, found)

		// Try to do `used_invites` for an invite that does not have `max_uses`.
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = &SCTeamMembers{
			Readers: &[]SCTeamMember{SCTeamMember(testUV)},
		}
		teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
			{InviteID: inviteID, UV: testUV.PercentForm()},
		}
		_, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), "`used_invites` for a non-new-style invite")
	}
}

func TestTeamPlayerBadCompletedInvites(t *testing.T) {
	// Test if `completed_invites` errors out when used on an invite that
	// defines `max_uses`, and therefore `used_invites` should be used instead
	// to mark the invite usage.

	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	testUV := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice_t"), EldestSeqno: 1}

	teamSectionForInvite := makeTestSCTeamSection(team)
	sectionInvite := makeTestSCForInviteLink()
	maxUses := keybase1.TeamInviteMaxUses(10)
	sectionInvite.MaxUses = &maxUses
	inviteID := keybase1.TeamInviteID(sectionInvite.ID)
	teamSectionForInvite.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{sectionInvite},
	}

	state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		teamSectionForInvite, me, nil /* merkleRoot */)
	require.NoError(t, err)
	_, found := state.FindActiveInviteMDByID(inviteID)
	require.True(t, found)

	teamSectionCM := makeTestSCTeamSection(team)
	teamSectionCM.Members = &SCTeamMembers{
		Readers: &[]SCTeamMember{SCTeamMember(testUV)},
	}
	teamSectionCM.CompletedInvites = SCMapInviteIDToUV{
		inviteID: testUV.PercentForm(),
	}
	_, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
		teamSectionCM, me, nil /* merkleRoot */)
	requirePrecheckError(t, err)
	require.Contains(t, err.Error(), "`completed_invites` for a new-style invite")
	require.Contains(t, err.Error(), inviteID)
}

func TestTeamInvite64BitEtime(t *testing.T) {
	// Load a chain from JSON file where there is an invite with `etime` in far
	// future - 3020, so 32bit signed int is not enough to store that - and see
	// if we can work with that UnixTime value.

	team, _ := runUnitFromFilename(t, "multiple_use_invite_1000_years.json")

	state := &team.chain().inner
	require.Len(t, state.ActiveInvites, 1)

	var inviteMD keybase1.TeamInviteMetadata
	for _, inviteMD = range state.InviteMetadatas {
		break // get first invite
	}
	invite := inviteMD.Invite

	require.NotNil(t, invite.MaxUses)
	require.True(t, invite.MaxUses.IsInfiniteUses())

	require.NotNil(t, invite.Etime)
	require.Equal(t, 3020, invite.Etime.Time().Year())

	require.Len(t, inviteMD.UsedInvites, 2)
}

func TestTeamPlayerExhaustedMaxUses(t *testing.T) {
	// Try to "use invite" which has its max uses exhausted.

	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	var testUVs [3]keybase1.UserVersion
	for i := range testUVs {
		testUVs[i] = keybase1.UserVersion{Uid: libkb.UsernameToUID(fmt.Sprintf("t_alice_%d", i)), EldestSeqno: 1}
	}

	maxUses := keybase1.TeamInviteMaxUses(1)

	scInvite := makeTestSCForInviteLink()
	scInvite.MaxUses = &maxUses

	inviteID := scInvite.ID

	teamSectionForInvite := makeTestSCTeamSection(team)
	teamSectionForInvite.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{scInvite},
	}

	state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		teamSectionForInvite, me, nil /* merkleRoot */)
	require.NoError(t, err)
	_, found := state.FindActiveInviteMDByID(keybase1.TeamInviteID(inviteID))
	require.True(t, found)

	{
		// Try to add two people in same link. Max uses is 1, so it should not
		// allow us to do that.
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = &SCTeamMembers{
			Readers: &[]SCTeamMember{SCTeamMember(testUVs[0]), SCTeamMember(testUVs[1])},
		}
		teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
			{InviteID: inviteID, UV: testUVs[0].PercentForm()},
			{InviteID: inviteID, UV: testUVs[1].PercentForm()},
		}
		_, err := appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		requirePrecheckError(t, err)
		require.Contains(t, err.Error(), "is expired after 1 use")
		require.Contains(t, err.Error(), inviteID)
	}

	{
		// If we add two people, but only one of them is "using the invite", we should be fine.
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = &SCTeamMembers{
			Readers: &[]SCTeamMember{SCTeamMember(testUVs[0]), SCTeamMember(testUVs[1])},
		}
		teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
			{InviteID: inviteID, UV: testUVs[0].PercentForm()},
		}
		state, err := appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		require.NoError(t, err)
		require.Len(t, state.inner.InviteMetadatas[keybase1.TeamInviteID(inviteID)].UsedInvites, 1)
		require.Len(t, state.GetAllUVs(), 3) // team creator and two people added in this link
	}

	{
		state := state

		// Add users one by one, first one should go through.
		for i, uv := range testUVs[:2] {
			teamSectionCM := makeTestSCTeamSection(team)
			teamSectionCM.Members = &SCTeamMembers{
				Readers: &[]SCTeamMember{SCTeamMember(uv)},
			}
			teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
				{InviteID: inviteID, UV: uv.PercentForm()},
			}
			newState, err := appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
				teamSectionCM, me, nil /* merkleRoot */)
			if i == 0 {
				require.NoError(t, err)
				state = newState
			} else {
				requirePrecheckError(t, err)
			}
		}

		require.Len(t, state.inner.InviteMetadatas[keybase1.TeamInviteID(inviteID)].UsedInvites, 1)
		require.Len(t, state.GetAllUVs(), 2) // team creator and one person added in loop above
	}
}

func TestTeamPlayerUsedInviteWithNoRoleChange(t *testing.T) {
	// See TestTeamPlayerNoRoleChange in members_test.go
	//
	// If a result of change_membership is no role change, a log point is not
	// created for the UV. This is weird from perspective of using invites.

	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	testUV := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice_t"), EldestSeqno: 1}

	// Add multi use invite.
	teamSectionForInvite := makeTestSCTeamSection(team)
	sectionInvite := makeTestSCForInviteLink()
	maxUses := keybase1.TeamInviteMaxUses(10)
	sectionInvite.MaxUses = &maxUses
	inviteID := keybase1.TeamInviteID(sectionInvite.ID)
	teamSectionForInvite.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{sectionInvite},
	}

	state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		teamSectionForInvite, me, nil /* merkleRoot */)
	require.NoError(t, err)
	_, found := state.FindActiveInviteMDByID(inviteID)
	require.True(t, found)

	// Add member without using the invite first.
	teamSectionCM := makeTestSCTeamSection(team)
	teamSectionCM.Members = &SCTeamMembers{
		Readers: &[]SCTeamMember{SCTeamMember(testUV)},
	}
	state, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
		teamSectionCM, me, nil /* merkleRoot */)
	require.NoError(t, err)

	require.Len(t, state.inner.UserLog[testUV], 1)
	require.EqualValues(t, 3, state.inner.UserLog[testUV][0].SigMeta.SigChainLocation.Seqno)

	// Add member again, with similar link, but using the invite.
	// (re-use teamSectionCM)
	teamSectionCM.UsedInvites = []SCMapInviteIDUVPair{
		{InviteID: SCTeamInviteID(inviteID), UV: testUV.PercentForm()},
	}
	state, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
		teamSectionCM, me, nil /* merkleRoot */)
	require.NoError(t, err)

	// That didn't change UserLog - no change in role, didn't add a checkpoint.
	require.Len(t, state.inner.UserLog[testUV], 1)

	// ...which makes the usedInvites weird with the log pointer:
	require.Len(t, state.inner.InviteMetadatas[inviteID].UsedInvites, 1)
	require.Equal(t, testUV, state.inner.InviteMetadatas[inviteID].UsedInvites[0].Uv)
	// this would be the wrong log point: testUV did not accept invite at that point
	require.Equal(t, 0, state.inner.InviteMetadatas[inviteID].UsedInvites[0].LogPoint)
}
