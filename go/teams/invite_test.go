package teams

import (
	"context"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
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
	require.Len(t, state.ActiveInvites, 1)

	var inviteID keybase1.TeamInviteID
	var invite keybase1.TeamInvite
	for inviteID, invite = range state.ActiveInvites {
		break // grab first invite
	}

	require.Equal(t, inviteID, invite.Id)
	require.Nil(t, invite.Etime)
	require.NotNil(t, invite.MaxUses)
	require.Equal(t, keybase1.TeamInviteMaxUses(10), *invite.MaxUses)

	require.Len(t, state.UsedInvites, 1)
	usedInvitesForID, ok := state.UsedInvites[inviteID]
	require.True(t, ok)
	require.Len(t, usedInvitesForID, 3)

	for _, usedInvitePair := range usedInvitesForID {
		// Check if UserLog pointed at by usedInvitePair exists (otherwise
		// crash on map/list access).
		ulog := state.UserLog[usedInvitePair.Uv][usedInvitePair.LogPoint]
		require.Equal(t, ulog.Role, invite.Role)
	}
}

func TestMultiUseInviteChains2(t *testing.T) {
	team, _ := runUnitFromFilename(t, "multiple_use_invite_3.json")

	state := &team.chain().inner
	require.Len(t, state.ActiveInvites, 1)

	var inviteID keybase1.TeamInviteID
	var invite keybase1.TeamInvite
	for inviteID, invite = range state.ActiveInvites {
		break // grab first invite
	}

	require.Equal(t, inviteID, invite.Id)
	require.Nil(t, invite.Etime)
	require.NotNil(t, invite.MaxUses)
	require.Equal(t, keybase1.TeamInviteMaxUses(999), *invite.MaxUses)

	require.Len(t, state.UsedInvites, 1)
	usedInvitesForID, ok := state.UsedInvites[inviteID]
	require.True(t, ok)
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

func TestTeamPlayerInviteMaxUses(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	inviteID := NewInviteID()
	section := makeTeamSection(team)
	invite := SCTeamInvite{
		Type:    "seitan_invite_token",
		Name:    keybase1.TeamInviteName("test"),
		ID:      inviteID,
		MaxUses: nil,
	}

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
		require.Contains(t, err.Error(), fmt.Sprintf("has invalid max_uses %d", v))
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
		require.Len(t, state.inner.ActiveInvites, 1)
	}
}

func TestTeamPlayerInviteLinksImplicitTeam(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, true /* implicitTeam */)
	defer tc.Cleanup()

	inviteID := NewInviteID()
	section := makeTeamSection(team)
	maxUses := keybase1.TeamInviteMaxUses(100)
	invite := SCTeamInvite{
		Type:    "seitan_invite_token",
		Name:    keybase1.TeamInviteName("test"),
		ID:      inviteID,
		MaxUses: &maxUses,
	}
	section.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{invite},
	}

	_, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	requirePrecheckError(t, err)
	require.Contains(t, err.Error(), "has max_uses in implicit team")

	// Transmutate invite into invite with expiration time instead of max_uses
	etime := int(keybase1.ToUnixTime(time.Now()))
	invite.MaxUses = nil
	invite.Etime = &etime
	section.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{invite},
	}

	_, err = appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	requirePrecheckError(t, err)
	require.Contains(t, err.Error(), "has etime in implicit team")
}

func TestTeamInvitePrecheckWIP(t *testing.T) {
	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	// Make a state with multi use invite (max_uses=1).
	inviteID := NewInviteID()
	maxUses := keybase1.TeamInviteMaxUses(1)

	section := makeTeamSection(team)
	invite := SCTeamInvite{
		Type:    "seitan_invite_token",
		Name:    keybase1.TeamInviteName("test"),
		ID:      inviteID,
		MaxUses: &maxUses,
	}
	section.Invites = &SCTeamInvites{
		Readers: &[]SCTeamInvite{invite},
	}

	curState, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	require.NoError(t, err)

	// Ensure that this worked.

	invite.Name = keybase1.TeamInviteName("overwritten")
	section.Invites = &SCTeamInvites{
		Writers: &[]SCTeamInvite{invite},
	}

	curState, err = appendSigToState(t, team, curState, libkb.LinkTypeInvite,
		section, me, nil /* merkleRoot */)
	require.NoError(t, err)

	require.Len(t, curState.inner.ActiveInvites, 1)
	var inviteObj keybase1.TeamInvite
	for _, inviteObj = range curState.inner.ActiveInvites {
		break // take first invite
	}
	require.EqualValues(t, inviteObj.Id, inviteID)
	require.NotNil(t, inviteObj.MaxUses)
	require.EqualValues(t, 1, *inviteObj.MaxUses)
	require.Equal(t, keybase1.TeamRole_READER, inviteObj.Role)

	spew.Dump(curState)

	// teamID := SCTeamID("2123209b98b16083c69c91152b861724")
	// teamName := SCTeamName("cabal")

	// consumer := NewUserVersion("99759da4f968b16121ece44652f01a19", 1)
	// link := ChainLinkUnpacked{
	// 	inner: &SCChainLinkPayload{
	// 		Body: SCPayloadBody{
	// 			Key: &SCKeySection{
	// 				UID: consumer.Uid,
	// 			},
	// 			Type:    "team.root",
	// 			Version: 2,
	// 			Team: &SCTeamSection{
	// 				ID:   teamID,
	// 				Name: &teamName,
	// 				Members: &SCTeamMembers{
	// 					Owners: &[]SCTeamMember{
	// 						{
	// 							Uid:         consumer.Uid,
	// 							EldestSeqno: consumer.EldestSeqno,
	// 						},
	// 					},
	// 				},
	// 				PerTeamKey: &SCPerTeamKey{},
	// 			},
	// 		},
	// 		SeqType: keybase1.SeqType_PRIVATE,
	// 		Seqno:   1,
	// 		Tag:     "signature",
	// 	},
	// 	outerLink: &libkb.OuterLinkV2WithMetadata{
	// 		OuterLinkV2: libkb.OuterLinkV2{
	// 			Seqno:    1,
	// 			Version:  2,
	// 			LinkType: 33,
	// 		},
	// 	},
	// }
	// newState, err := AppendChainLink(context.TODO(), team.G(), consumer, nil, &link, signerToX(&consumer))
	// require.NoError(t, err)
	// spew.Dump(newState)
}
