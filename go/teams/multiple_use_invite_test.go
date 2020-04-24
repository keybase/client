package teams

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/clockwork"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamInviteStubbing(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()
	_ = kbtest.TCreateFakeUser(tc)

	tc2 := SetupTest(t, "team", 1)
	defer tc2.Cleanup()
	user2 := kbtest.TCreateFakeUser(tc2)

	teamname := createTeam(tc)

	t.Logf("Created team %s", teamname)

	_, err := loadTeamForAdmin(tc, teamname)
	require.NoError(t, err)

	maxUses := keybase1.TeamInviteMaxUses(10)
	inviteLink, err := CreateInvitelink(tc.MetaContext(), teamname, keybase1.TeamRole_READER,
		maxUses, nil /* etime */)
	require.NoError(t, err)

	wasSeitan, err := ParseAndAcceptSeitanToken(tc2.MetaContext(), &teamsUI{}, inviteLink.Ikey.String())
	require.NoError(t, err)
	require.True(t, wasSeitan)

	teamObj, err := loadTeamForAdmin(tc, teamname)
	require.NoError(t, err)

	var inviteID keybase1.TeamInviteID
	for _, inviteMD := range teamObj.chain().ActiveInvites() {
		inviteID = inviteMD.Invite.Id
		break // get first invite id
	}

	changeReq := keybase1.TeamChangeReq{}
	err = changeReq.AddUVWithRole(user2.GetUserVersion(), keybase1.TeamRole_READER, nil /* botSettings */)
	require.NoError(t, err)
	changeReq.UseInviteID(inviteID, user2.GetUserVersion().PercentForm())
	err = teamObj.ChangeMembershipWithOptions(tc.Context(), changeReq, ChangeMembershipOptions{})
	require.NoError(t, err)

	// User 2 loads team
	teamObj2, err := Load(tc2.Context(), tc2.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: false,
	})
	require.NoError(t, err)
	require.Len(t, teamObj2.chain().ActiveInvites(), 0, "invites were stubbed")

	// User 1 makes User 2 admin
	err = SetRoleAdmin(tc.Context(), tc.G, teamname, user2.Username)
	require.NoError(t, err)

	// User 2 loads team again (NeedAdmin=true this time)
	teamObj, err = Load(tc.Context(), tc2.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	inner := teamObj.chain().inner
	require.Len(t, inner.ActiveInvites(), 1)
	inviteMD, ok := inner.InviteMetadatas[inviteID]
	invite := inviteMD.Invite
	require.True(t, ok, "invite found loaded by user 2")
	require.Len(t, inviteMD.UsedInvites, 1)

	// See if User 2 can decrypt
	pkey, err := SeitanDecodePKey(string(invite.Name))
	require.NoError(t, err)

	keyAndLabel, err := pkey.DecryptKeyAndLabel(context.TODO(), teamObj)
	require.NoError(t, err)

	ilink := keyAndLabel.Invitelink()
	require.Equal(t, inviteLink.Ikey, ilink.I)
}

func TestSeitanHandleExceededInvite(t *testing.T) {
	// Test what happens if server sends us acceptance for an invite that's
	// exceeded. Handler should notice that and not add the member. Even it it
	// attempted to, there are additional belts and suspenders:

	// 1) sigchain pre-check should fail,
	// 2) server should not accept the link,
	// 3) if none of the above checks worked: the team would have ended up
	//    broken (not loadable) for other admins.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	clock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(clock)

	user2 := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	// Add team invite link with max_uses=1
	maxUses := keybase1.TeamInviteMaxUses(1)
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER, maxUses, nil /* etime */)
	require.NoError(t, err)

	// Accept the link as user2.
	kbtest.LogoutAndLoginAs(tc, user2)

	uv := user2.GetUserVersion()
	unixNow := clock.Now().Unix()
	accepted, err := generateAcceptanceSeitanInviteLink(invLink.Ikey, uv, unixNow)
	require.NoError(t, err)

	err = postSeitanInviteLink(tc.MetaContext(), accepted)
	require.NoError(t, err)

	// Login as admin, call HandleTeamSeitan with a message as it would have
	// came from team_rekeyd.
	kbtest.LogoutAndLoginAs(tc, admin)
	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{
			{
				InviteID:    keybase1.TeamInviteID(accepted.inviteID),
				Uid:         uv.Uid,
				EldestSeqno: uv.EldestSeqno,
				Akey:        keybase1.SeitanAKey(accepted.encoded),
				Role:        keybase1.TeamRole_READER,
				UnixCTime:   unixNow,
			},
		},
	}

	API := libkb.NewAPIArgRecorder(tc.G.API)
	tc.G.API = API
	err = HandleTeamSeitan(context.TODO(), tc.G, msg)
	require.NoError(t, err)
	records := API.GetFilteredRecordsAndReset(func(rec *libkb.APIRecord) bool {
		return rec.Arg.Endpoint == "team/reject_invite_acceptance"
	})
	require.Len(t, records, 0, "no invite link acceptances were rejected")

	// User2 leaves team.
	kbtest.LogoutAndLoginAs(tc, user2)
	err = LeaveByID(context.TODO(), tc.G, teamID, false /* permanent */)
	require.NoError(t, err)

	// Login back to admin, use same seitan gregor message
	// to try to add the user back in.
	kbtest.LogoutAndLoginAs(tc, admin)

	// `HandleTeamSeitan` should not return an error but skip over bad
	// `TeamSeitanRequest` and cancel it.
	err = HandleTeamSeitan(context.TODO(), tc.G, msg)
	require.NoError(t, err)
	records = API.GetFilteredRecordsAndReset(func(rec *libkb.APIRecord) bool {
		return rec.Arg.Endpoint == "team/reject_invite_acceptance"
	})
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record := records[0]
	// since this invite acceptance had been completed already, rejecting it now
	// fails (with a generic error)
	assertRejectInviteArgs(t, record, accepted.inviteID, uv.Uid, uv.EldestSeqno, msg.Seitans[0].Akey, "acceptance not found")

	teamObj, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	// The person shouldn't have been added
	members, err := teamObj.Members()
	require.NoError(t, err)

	uvs := members.AllUserVersions()
	require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, uvs)
}

func TestSeitanHandleSeitanRejectsWhenAppropriate(t *testing.T) {
	// Test various cases where an acceptance is malformed and should be
	// rejected. Rejections for over-used invites are tested in
	// TestSeitanHandleExceededInvite.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	user2 := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	// Add team invite link which expires in 10 minutes.
	expTime := keybase1.ToUnixTime(tc.G.Clock().Now().Add(10 * time.Minute))
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER, keybase1.TeamMaxUsesInfinite,
		&expTime)
	require.NoError(t, err)

	inviteID := inviteIDFromIkey(t, invLink.Ikey)

	origAPI := tc.G.API
	RecordAPI := libkb.NewAPIArgRecorder(origAPI)

	// Accept the link as user2.
	origMsg := acceptInvite(t, &tc, teamID, user2, invLink)
	uv := user2.GetUserVersion()

	// change the eldest seqno and ensure the invite is rejected
	fakeMsg := origMsg.DeepCopy()
	fakeMsg.Seitans[0].EldestSeqno = 5
	records := adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, fakeMsg, RecordAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record := records[0]
	// since this modified invite acceptance (has different eldestSeqno) was
	// never sent to the server, rejection should fail
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, keybase1.Seqno(5), fakeMsg.Seitans[0].Akey, "acceptance not found")

	// now change the akey to something that cannot be b64 decoded
	fakeMsg = origMsg.DeepCopy()
	fakeMsg.Seitans[0].Akey = keybase1.SeitanAKey("*") + fakeMsg.Seitans[0].Akey[1:]
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, fakeMsg, RecordAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record = records[0]
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, uv.EldestSeqno, fakeMsg.Seitans[0].Akey, "bad fields: akey")

	// now change the akey to something that can be decoded but is not the correct key
	fakeMsg2 := origMsg.DeepCopy()
	fakeMsg2.Seitans[0].Akey = keybase1.SeitanAKey("aaaaaa") + fakeMsg2.Seitans[0].Akey[6:]
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, fakeMsg2, RecordAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record = records[0]
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, uv.EldestSeqno, fakeMsg2.Seitans[0].Akey, "invalid akey")

	// when we try to handle the original invite, it should succeed without issues
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, origMsg, RecordAPI)
	require.Len(t, records, 0, "no invite link acceptances were rejected")

	// User2 leaves team.
	user2LeavesTeam := func() {
		kbtest.LogoutAndLoginAs(tc, user2)
		err = LeaveByID(context.TODO(), tc.G, teamID, false /* permanent */)
		require.NoError(t, err)
	}
	user2LeavesTeam()

	// User2 accepts again.
	msg2 := acceptInvite(t, &tc, teamID, user2, invLink)
	require.NoError(t, err)
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg2, RecordAPI)
	require.Len(t, records, 0, "no invite acceptance should be rejected")
	user2LeavesTeam()

	// Now, try to accept two invitations at once, ensure both fail
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: []keybase1.TeamSeitanRequest{fakeMsg.Seitans[0], fakeMsg2.Seitans[0]},
	}, RecordAPI)
	require.Len(t, records, 2, "two invite acceptances should be rejected")
	assertRejectInviteArgs(t, records[0], inviteID, uv.Uid, uv.EldestSeqno, fakeMsg.Seitans[0].Akey, "bad fields: akey")
	assertRejectInviteArgs(t, records[1], inviteID, uv.Uid, uv.EldestSeqno, fakeMsg2.Seitans[0].Akey, "acceptance not found")

	// Ensures different acceptances do not use the same AKey, whose only
	// entropy is time with second granularity.
	time.Sleep(1 * time.Second)

	// Now, try to accept two invitations at once, ensure one fails and the other doesn't
	msg3 := acceptInvite(t, &tc, teamID, user2, invLink)
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: []keybase1.TeamSeitanRequest{fakeMsg.Seitans[0], msg3.Seitans[0]},
	}, RecordAPI)
	require.Len(t, records, 1, "only one acceptance should be rejected")
	assertRejectInviteArgs(t, records[0], inviteID, uv.Uid, uv.EldestSeqno, fakeMsg.Seitans[0].Akey, "bad fields: akey")
	user2LeavesTeam()

	// Ensures different acceptances do not use the same AKey, whose only
	// entropy is time with second granularity.
	time.Sleep(1 * time.Second)

	// Login back to admin, use same seitan gregor message to try to add the
	// user back in. This time, we move the clock forward so the invite is
	// expired.
	msg4 := acceptInvite(t, &tc, teamID, user2, invLink)
	kbtest.LogoutAndLoginAs(tc, admin)
	clock := clockwork.NewFakeClockAt(time.Now())
	clock.Advance(24 * time.Hour)
	tc.G.SetClock(clock)

	// `HandleTeamSeitan` should not return an error but skip over bad
	// `TeamSeitanRequest` and reject it.
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg4, RecordAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record = records[0]
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, uv.EldestSeqno, msg4.Seitans[0].Akey, "")

	{
		teamObj, err := loadTeamForAdmin(tc, teamName.String())
		require.NoError(t, err)

		// The person shouldn't have been added
		members, err := teamObj.Members()
		require.NoError(t, err)

		uvs := members.AllUserVersions()
		require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, uvs)
	}
}

func TestSeitanHandleExpiredInvite(t *testing.T) {
	// Test what happens if server sends us acceptance for an invite that's
	// expired. Handler should notice that and not add the member.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	clock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(clock)

	user2 := kbtest.TCreateFakeUser(tc)
	user3 := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	// Add team invite link which expires in 10 minutes.
	expTime := keybase1.ToUnixTime(clock.Now().Add(10 * time.Minute))
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER, keybase1.TeamMaxUsesInfinite,
		&expTime)
	require.NoError(t, err)

	origAPI := tc.G.API
	RecordAPI := libkb.NewAPIArgRecorder(origAPI)

	msg2 := acceptInvite(t, &tc, teamID, user2, invLink)
	msg3 := acceptInvite(t, &tc, teamID, user3, invLink)

	// invite is accepted for user2
	records := adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg2, RecordAPI)
	require.Len(t, records, 0, "no invite link acceptances were rejected")

	// We move the clock forward so the invite expires.
	clock.Advance(24 * time.Hour)

	// try to add user3. This should fail
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg3, RecordAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record := records[0]
	assertRejectInviteArgs(t, record, SCTeamInviteID(msg3.Seitans[0].InviteID), user3.GetUID(), user3.GetUserVersion().EldestSeqno, msg3.Seitans[0].Akey, "")

	// ensure team has user2 and admin but not user3
	teamObj, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUserVersions(), 2)
	require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, members.Owners)
	require.Equal(t, []keybase1.UserVersion{user2.GetUserVersion()}, members.Readers)
}

func TestSeitanHandleRequestAfterRoleChange(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	user2 := kbtest.TCreateFakeUser(tc)
	user3 := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	clock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(clock)

	// Add team invite link which expires in 10 minutes.
	expTime := keybase1.ToUnixTime(clock.Now().Add(10 * time.Minute))
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER, keybase1.TeamMaxUsesInfinite,
		&expTime)
	require.NoError(t, err)

	inviteID := inviteIDFromIkey(t, invLink.Ikey)

	origAPI := tc.G.API
	RecordAPI := libkb.NewAPIArgRecorder(origAPI)

	msg2 := acceptInvite(t, &tc, teamID, user2, invLink)
	msg3 := acceptInvite(t, &tc, teamID, user3, invLink)

	clock.Advance(5 * time.Second)

	// First admin adds and removes user2. Because this happens *after* invite
	// link for user2 is accepted, it renders the acceptance obsolete. Seitan
	// handler should check that there was a role change after acceptance ctime
	// and reject that acceptance.
	tc.G.API = origAPI
	kbtest.LogoutAndLoginAs(tc, admin)
	_, err = AddMember(context.TODO(), tc.G, teamName.String(), user2.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)
	err = RemoveMember(context.TODO(), tc.G, teamName.String(), user2.Username)
	require.NoError(t, err)

	clock.Advance(5 * time.Second)

	// Then, we try to accept all invites invites: only the one for user3
	// should succeed (as user2's status changed after they joined).
	require.NoError(t, err)
	records := adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: []keybase1.TeamSeitanRequest{msg2.Seitans[0], msg3.Seitans[0]},
	}, RecordAPI)
	require.Len(t, records, 1, "one acceptance should be rejected")
	assertRejectInviteArgs(t, records[0], inviteID, user2.GetUID(), user2.EldestSeqno, msg2.Seitans[0].Akey, "")

	// ensure team has only user3 and admin
	teamObj, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUserVersions(), 2)
	require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, members.Owners)
	require.Equal(t, []keybase1.UserVersion{user3.GetUserVersion()}, members.Readers)
}

func TestSeitanHandleFutureInvite(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	user2 := kbtest.TCreateFakeUser(tc)
	user3 := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	// Add team invite link which expires in 10 minutes.
	expTime := keybase1.ToUnixTime(time.Now().Add(10 * time.Minute))
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER,
		keybase1.TeamMaxUsesInfinite, &expTime)
	require.NoError(t, err)

	origAPI := tc.G.API
	RecordAPI := libkb.NewAPIArgRecorder(origAPI)

	// user 2 accepts an invite with a future timestamp
	origClock := tc.G.GetClock()
	clock := clockwork.NewFakeClockAt(time.Now().Add(2 * time.Hour))
	tc.G.SetClock(clock)
	msg2 := acceptInvite(t, &tc, teamID, user2, invLink)
	tc.G.SetClock(origClock)

	msg3 := acceptInvite(t, &tc, teamID, user3, invLink)

	// then, we try to accept all invites invites: only the one for user3 should
	// succeed (as user2 accepted with a future timestamp). However we won't
	// reject the invite for user2 (and instead confirm later they were not
	// added to the team) to prevent an admin with a messed up clock from
	// rejecting good invites.
	require.NoError(t, err)
	records := adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: []keybase1.TeamSeitanRequest{msg2.Seitans[0], msg3.Seitans[0]},
	}, RecordAPI)
	require.Len(t, records, 0, "no acceptance should be rejected")

	// ensure team has only user3 and admin
	teamObj, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUserVersions(), 2)
	require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, members.Owners)
	require.Equal(t, []keybase1.UserVersion{user3.GetUserVersion()}, members.Readers)
}

func acceptInvite(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, user *kbtest.FakeUser, inviteLink keybase1.Invitelink) keybase1.TeamSeitanMsg {
	kbtest.LogoutAndLoginAs(*tc, user)

	uv := user.GetUserVersion()
	unixNow := tc.G.Clock().Now().Unix()
	t.Logf("Unix is %v", unixNow)
	accepted, err := generateAcceptanceSeitanInviteLink(inviteLink.Ikey, uv, unixNow)
	require.NoError(t, err)

	err = postSeitanInviteLink(tc.MetaContext(), accepted)
	require.NoError(t, err)

	// This simulates a seitan msg for the admin as it would have came from
	// team_rekeyd.
	return keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{
			{
				InviteID:    keybase1.TeamInviteID(accepted.inviteID),
				Uid:         uv.Uid,
				EldestSeqno: uv.EldestSeqno,
				Akey:        keybase1.SeitanAKey(accepted.encoded),
				Role:        keybase1.TeamRole_READER,
				UnixCTime:   unixNow,
			},
		},
	}
}

func inviteIDFromIkey(t *testing.T, ikey keybase1.SeitanIKeyInvitelink) SCTeamInviteID {
	sikey, err := GenerateSIKeyInvitelink(ikey)
	require.NoError(t, err)
	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	return inviteID
}

func adminCallsHandleTeamSeitanAndReturnsRejectCalls(t *testing.T, tc *libkb.TestContext, admin *kbtest.FakeUser, msg keybase1.TeamSeitanMsg, api *libkb.APIArgRecorder) []libkb.APIRecord {
	kbtest.LogoutAndLoginAs(*tc, admin)
	tc.G.API = api
	err := HandleTeamSeitan(context.TODO(), tc.G, msg)
	require.NoError(t, err)
	return api.GetFilteredRecordsAndReset(func(rec *libkb.APIRecord) bool {
		return rec.Arg.Endpoint == "team/reject_invite_acceptance"
	})
}

func assertRejectInviteArgs(t *testing.T, record libkb.APIRecord, inviteID SCTeamInviteID, uid keybase1.UID, seqno keybase1.Seqno, akey keybase1.SeitanAKey, errString string) {
	require.Equal(t, string(inviteID), record.Arg.Args["invite_id"].String())
	require.Equal(t, string(uid), record.Arg.Args["uid"].String())
	require.Equal(t, fmt.Sprintf("%v", seqno), record.Arg.Args["eldest_seqno"].String())
	require.Equal(t, string(akey), record.Arg.Args["akey"].String())
	if errString == "" {
		require.NoError(t, record.Err)
	} else {
		require.NotNil(t, record.Err)
		require.Contains(t, record.Err.Error(), errString)
	}
}

func TestSeitanInviteLinkPukless(t *testing.T) {
	// Test server sending us team invite link request with a valid acceptance
	// key, but the user is PUK-less so they can't be added using
	// 'team.change_membership' link.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	t.Logf("Admin username: %s", admin.Username)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %q", teamName.String())

	maxUses := keybase1.TeamInviteMaxUses(1)
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER,
		maxUses, nil /* etime */)
	require.NoError(t, err)

	t.Logf("Created invite link %q", invLink.Ikey)

	kbtest.Logout(tc)

	// Create a PUKless user
	tc.Tp.DisableUpgradePerUserKey = true
	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("User: %s", user.Username)

	timeNow := tc.G.Clock().Now().Unix()
	seitanRet, err := generateAcceptanceSeitanInviteLink(invLink.Ikey, user.GetUserVersion(), timeNow)
	require.NoError(t, err)

	kbtest.LogoutAndLoginAs(tc, admin)

	inviteID, err := seitanRet.inviteID.TeamInviteID()
	require.NoError(t, err)

	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{{
			InviteID:    inviteID,
			Uid:         user.GetUID(),
			EldestSeqno: user.EldestSeqno,
			Akey:        keybase1.SeitanAKey(seitanRet.encoded),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   timeNow,
		}},
	}
	err = HandleTeamSeitan(tc.Context(), tc.G, msg)
	require.NoError(t, err)

	// HandleTeamSeitan should not have added an invite for user. If it has, it
	// also hasn't "used invite" properly (`team.invite` link does not have
	// `use_invites` field even if it adds type=keybase invites).
	team, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	invite, _, found := team.FindActiveKeybaseInvite(user.GetUID())
	require.False(t, found, "Expected not to find invite for user: %s", spew.Sdump(invite))

	uvs := team.AllUserVersionsByUID(tc.Context(), user.GetUID())
	require.Len(t, uvs, 0, "Expected user not to end up in a team as cryptomember (?)")
}

func TestAcceptMultipleInviteLinkForOneTeam(t *testing.T) {
	// Test one user accepting multiple invite links tokens for one team.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)

	// Make 3 seitan invite links with different roles. User will accept all 3
	// of them, but they should be added as the highest role, and other
	// requests should be rejected.
	inviteRoles := [3]keybase1.TeamRole{
		keybase1.TeamRole_READER,
		keybase1.TeamRole_WRITER,
		keybase1.TeamRole_READER,
	}

	var ilinks [3]keybase1.Invitelink
	for i := range ilinks {
		maxUses := keybase1.TeamMaxUsesInfinite
		token, err := CreateInvitelink(tc.MetaContext(), teamName.String(),
			inviteRoles[i], maxUses, nil /* etime */)
		require.NoError(t, err)
		ilinks[i] = token
	}

	user := kbtest.TCreateFakeUser(tc)

	uv := user.GetUserVersion()
	unixNow := tc.G.Clock().Now().Unix()

	var inviteIDs [3]keybase1.TeamInviteID
	var seitans [3]keybase1.TeamSeitanRequest
	for i := range seitans {
		seitanRet, err := generateAcceptanceSeitanInviteLink(ilinks[i].Ikey, uv, unixNow)
		require.NoError(t, err)

		err = postSeitanInviteLink(tc.MetaContext(), seitanRet)
		require.NoError(t, err)

		inviteID, err := seitanRet.inviteID.TeamInviteID()
		require.NoError(t, err)

		seitans[i] = keybase1.TeamSeitanRequest{
			InviteID:    inviteID,
			Uid:         user.GetUID(),
			EldestSeqno: user.EldestSeqno,
			Akey:        keybase1.SeitanAKey(seitanRet.encoded),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   unixNow,
		}

		inviteIDs[i] = inviteID
	}

	kbtest.LogoutAndLoginAs(tc, admin)
	msg := keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: seitans[:],
	}
	rejections, err := handleTeamSeitanInternal(tc.MetaContext(), msg)
	require.NoError(t, err)
	require.Len(t, rejections, 2)
	require.Equal(t, rejections[0].InviteID, inviteIDs[0])
	require.Equal(t, rejections[1].InviteID, inviteIDs[2])
	for _, v := range rejections {
		require.Equal(t, user.GetUID(), v.UID)
		require.Equal(t, user.EldestSeqno, v.EldestSeqno)
		// TODO: Flaky right now because of the tribute check during rejection.
		// require.NoError(t, v.err)
	}

	// Check if user was added with correct role and if invites have expected
	// statuses.
	teamObj, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	memberRole, err := teamObj.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, memberRole)

	// All invites were infinite uses, they should still be active.
	require.Equal(t, 3, teamObj.NumActiveInvites())

	for i, inviteID := range inviteIDs {
		_, found := teamObj.chain().FindActiveInviteMDByID(inviteID)
		require.True(t, found)

		md := teamObj.chain().inner.InviteMetadatas[inviteID]
		statusCode, err := md.Status.Code()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteMetadataStatusCode_ACTIVE, statusCode)

		switch i {
		case 0, 2:
			require.Len(t, md.UsedInvites, 0)
		case 1:
			// Invite 1 should have been used to add user.
			require.Len(t, md.UsedInvites, 1)
		}
	}
}

func TestAcceptMultipleInviteLinkForTeamUpgrade(t *testing.T) {
	// Similar to TestAcceptMultipleInviteLinkForOneTeam, but user is already
	// in the team as READER, and uses three distinct invite links - READER
	// (1), WRITER (2), WRITER (3). It should upgrade them to WRITER using
	// invite (2), and reject requests for invites (1) and (3).

	// Skipping because it's not possible to use an invite link to upgrade
	// yourself right now - server prevents accepting an invite link if you are
	// already in the team.
	t.Skip()

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true
	user := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)

	// Make 3 seitan invite links with different roles. User will accept all 3
	// of them, but they should be added as the highest role, and other
	// requests should be rejected.
	inviteRoles := [3]keybase1.TeamRole{
		keybase1.TeamRole_READER,
		keybase1.TeamRole_WRITER,
		keybase1.TeamRole_WRITER,
	}

	var ilinks [3]keybase1.Invitelink
	for i := range ilinks {
		maxUses := keybase1.TeamMaxUsesInfinite
		token, err := CreateInvitelink(tc.MetaContext(), teamName.String(),
			inviteRoles[i], maxUses, nil /* etime */)
		require.NoError(t, err)
		ilinks[i] = token
	}

	_, err := AddMemberByID(tc.Context(), tc.G, teamID, user.Username, keybase1.TeamRole_READER,
		nil /* botSettings */, nil /* emailMsg */)
	require.NoError(t, err)

	kbtest.LogoutAndLoginAs(tc, user)

	uv := user.GetUserVersion()
	unixNow := tc.G.Clock().Now().Unix()

	var inviteIDs [3]keybase1.TeamInviteID
	var seitans [3]keybase1.TeamSeitanRequest
	for i := range seitans {
		seitanRet, err := generateAcceptanceSeitanInviteLink(ilinks[i].Ikey, uv, unixNow)
		require.NoError(t, err)

		err = postSeitanInviteLink(tc.MetaContext(), seitanRet)
		require.NoError(t, err)

		inviteID, err := seitanRet.inviteID.TeamInviteID()
		require.NoError(t, err)

		seitans[i] = keybase1.TeamSeitanRequest{
			InviteID:    inviteID,
			Uid:         user.GetUID(),
			EldestSeqno: user.EldestSeqno,
			Akey:        keybase1.SeitanAKey(seitanRet.encoded),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   unixNow,
		}

		inviteIDs[i] = inviteID
	}

	kbtest.LogoutAndLoginAs(tc, admin)
	msg := keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: seitans[:],
	}
	err = HandleTeamSeitan(tc.Context(), tc.G, msg)
	require.NoError(t, err)

	// TODO: If this test ever gets enabled, check if user was added properly.
}

func TestAcceptMultipleInviteLinksExceeded(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true
	user1 := kbtest.TCreateFakeUser(tc)
	user2 := kbtest.TCreateFakeUser(tc)
	admin := kbtest.TCreateFakeUser(tc)

	teamName, teamID := createTeam2(tc)

	// Create two invite links, one for READER with infinite uses, and one for
	// WRITER with MaxUses=1.
	var err error
	var ilinks [2]keybase1.Invitelink
	maxUses := keybase1.TeamMaxUsesInfinite
	ilinks[0], err = CreateInvitelink(tc.MetaContext(), teamName.String(),
		keybase1.TeamRole_READER, maxUses, nil /* etime */)
	require.NoError(t, err)
	maxUses, err = keybase1.NewTeamInviteFiniteUses(1)
	require.NoError(t, err)
	ilinks[1], err = CreateInvitelink(tc.MetaContext(), teamName.String(),
		keybase1.TeamRole_WRITER, maxUses, nil /* etime */)
	require.NoError(t, err)

	// Send the acceptances in the following order:
	// User 1 accepts invite[0] (READER)
	// User 2 accepts invite[1] (WRITER, exceeds the invite)
	// User 1 accepts invite[1] (WRITER, but it's already exceeded)

	// Depending on the order of how the requests are handled, either user 1 or
	// user 2 can be added as writer. But we ant to ensure of them being added
	// in the order of requests, so even with the logic of finding the
	// highest-role invite, User 1 should be added with READER role.

	acceptSeitan := func(user *kbtest.FakeUser, ikey keybase1.SeitanIKeyInvitelink, role keybase1.TeamRole) keybase1.TeamSeitanRequest {
		kbtest.LogoutAndLoginAs(tc, user)

		unixNow := tc.G.Clock().Now().Unix()
		seitanRet, err := generateAcceptanceSeitanInviteLink(ikey, user.GetUserVersion(), unixNow)
		require.NoError(t, err)

		// Ignore error - we are overusing invite here and this API will try to
		// prevent us.
		_ = postSeitanInviteLink(tc.MetaContext(), seitanRet)

		inviteID, err := seitanRet.inviteID.TeamInviteID()
		require.NoError(t, err)

		return keybase1.TeamSeitanRequest{
			InviteID:    inviteID,
			Uid:         user.GetUID(),
			EldestSeqno: user.EldestSeqno,
			Akey:        keybase1.SeitanAKey(seitanRet.encoded),
			// role is ignored in HandleTeamSeitan, but server passes the correct one anyway.
			Role:      role,
			UnixCTime: unixNow,
		}
	}

	var seitans [3]keybase1.TeamSeitanRequest
	seitans[0] = acceptSeitan(user1, ilinks[0].Ikey, keybase1.TeamRole_READER)
	seitans[1] = acceptSeitan(user2, ilinks[1].Ikey, keybase1.TeamRole_WRITER)
	seitans[2] = acceptSeitan(user1, ilinks[1].Ikey, keybase1.TeamRole_WRITER)

	inviteIDs := [2]keybase1.TeamInviteID{seitans[0].InviteID, seitans[1].InviteID}

	kbtest.LogoutAndLoginAs(tc, admin)
	msg := keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: seitans[:],
	}
	rejections, err := handleTeamSeitanInternal(tc.MetaContext(), msg)
	require.NoError(t, err)
	require.Len(t, rejections, 1)
	require.Equal(t, user1.GetUID(), rejections[0].UID)
	require.Equal(t, user1.EldestSeqno, rejections[0].EldestSeqno)
	require.Equal(t, inviteIDs[1], rejections[0].InviteID)
	// We should be able to reject this acceptance because server shouldn't have let us post it in the first place.
	require.Error(t, rejections[0].err)

	// Inspect the team to check if users were added properly.
	teamObj, err := loadTeamForAdmin(tc, teamName.String())
	require.NoError(t, err)

	// User 1 should be added as READER.
	memberRole, err := teamObj.MemberRole(tc.Context(), user1.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, memberRole)

	// User 2 should be added as WRITER.
	memberRole, err = teamObj.MemberRole(tc.Context(), user2.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, memberRole)

	for i, inviteID := range inviteIDs {
		_, found := teamObj.chain().FindActiveInviteMDByID(inviteID)
		require.True(t, found)

		md := teamObj.chain().inner.InviteMetadatas[inviteID]
		require.Len(t, md.UsedInvites, 1)
		switch i {
		case 0:
			require.Equal(t, md.UsedInvites[0].Uv, user1.GetUserVersion())
		case 1:
			require.Equal(t, md.UsedInvites[0].Uv, user2.GetUserVersion())
		}
	}
}
