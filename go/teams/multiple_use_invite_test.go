package teams

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/clockwork"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamInviteStubbing(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()
	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	tc2 := SetupTest(t, "team", 1)
	defer tc2.Cleanup()
	user2, err := kbtest.CreateAndSignupFakeUserPaper("team", tc2.G)
	require.NoError(t, err)

	teamname := createTeam(tc)

	t.Logf("Created team %s", teamname)

	_, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	maxUses := keybase1.TeamInviteMaxUses(10)
	inviteLink, err := CreateInvitelink(tc.MetaContext(), teamname, keybase1.TeamRole_READER, maxUses, nil /* etime */)
	require.NoError(t, err)

	wasSeitan, err := ParseAndAcceptSeitanToken(tc2.MetaContext(), &teamsUI{}, inviteLink.Ikey.String())
	require.NoError(t, err)
	require.True(t, wasSeitan)

	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
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
	err = teamObj.ChangeMembershipWithOptions(context.TODO(), changeReq, ChangeMembershipOptions{})
	require.NoError(t, err)

	// User 2 loads team

	teamObj2, err := Load(context.TODO(), tc2.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: false,
	})
	require.NoError(t, err)
	require.Len(t, teamObj2.chain().ActiveInvites(), 0, "invites were stubbed")

	// User 1 makes User 2 admin

	err = SetRoleAdmin(context.TODO(), tc.G, teamname, user2.Username)
	require.NoError(t, err)

	// User 2 loads team again

	teamObj, err = Load(context.TODO(), tc2.G, keybase1.LoadTeamArg{
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

	user2, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

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
	assertRejectInviteArgs(t, record, accepted.inviteID, uv.Uid, uv.EldestSeqno, "acceptance not found")

	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamName.String(),
		NeedAdmin: true,
	})
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

	user2, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

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
	// This API records all calls but silently drops the ones for
	// team/reject_invite_acceptance. Sometimes we need this to avoid having to
	// post the invite again (which would be non deterministic, as the rejection
	// might not have been accepted depending on team rekeyd's state).
	DropRejectCallsAPI := libkb.NewAPIArgRecorder(
		libkb.NewAPIRouter(
			[]libkb.API{origAPI, &libkb.NullMockAPI{}},
			func(arg libkb.APIArg, _ libkb.APIMethodType) int {
				if arg.Endpoint == "team/reject_invite_acceptance" {
					return 1
				}
				return 0
			}))

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
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, keybase1.Seqno(5), "acceptance not found")

	// now change the akey to something that cannot be b64 decoded
	fakeMsg = origMsg.DeepCopy()
	fakeMsg.Seitans[0].Akey = keybase1.SeitanAKey("*") + fakeMsg.Seitans[0].Akey[1:]
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, fakeMsg, DropRejectCallsAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record = records[0]
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, uv.EldestSeqno, "")

	// now change the akey to something that can be decoded but is not the correct key
	fakeMsg2 := origMsg.DeepCopy()
	fakeMsg2.Seitans[0].Akey = keybase1.SeitanAKey("aaaaaa") + fakeMsg2.Seitans[0].Akey[6:]
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, fakeMsg2, DropRejectCallsAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record = records[0]
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, uv.EldestSeqno, "")

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
	assertRejectInviteArgs(t, records[0], inviteID, uv.Uid, uv.EldestSeqno, "acceptance not found")
	assertRejectInviteArgs(t, records[1], inviteID, uv.Uid, uv.EldestSeqno, "acceptance not found")

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
	assertRejectInviteArgs(t, records[0], inviteID, uv.Uid, uv.EldestSeqno, "acceptance not found")
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
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg4, DropRejectCallsAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record = records[0]
	assertRejectInviteArgs(t, record, inviteID, uv.Uid, uv.EldestSeqno, "")

	ensureTeamOnlyHasAdminMember := func() {
		teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			Name:      teamName.String(),
			NeedAdmin: true,
		})
		require.NoError(t, err)

		// The person shouldn't have been added
		members, err := teamObj.Members()
		require.NoError(t, err)

		uvs := members.AllUserVersions()
		require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, uvs)
	}
	ensureTeamOnlyHasAdminMember()
}

func TestSeitanHandleExpiredInvite(t *testing.T) {
	// Test what happens if server sends us acceptance for an invite that's
	// expired. Handler should notice that and not add the member.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	clock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(clock)

	user2, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	user3, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName)

	// Add team invite link which expires in 10 minutes.
	expTime := keybase1.ToUnixTime(clock.Now().Add(10 * time.Minute))
	invLink, err := CreateInvitelink(tc.MetaContext(), teamName.String(), keybase1.TeamRole_READER, keybase1.TeamMaxUsesInfinite,
		&expTime)
	require.NoError(t, err)

	origAPI := tc.G.API
	RecordAPI := libkb.NewAPIArgRecorder(origAPI)
	// This API records all calls but silently drops the ones for
	// team/reject_invite_acceptance. Sometimes we need this to avoid having to
	// post the invite again (which would be non deterministic, as the rejection
	// might not have been accepted depending on team rekeyd's state).
	DropRejectCallsAPI := libkb.NewAPIArgRecorder(
		libkb.NewAPIRouter(
			[]libkb.API{origAPI, &libkb.NullMockAPI{}},
			func(arg libkb.APIArg, _ libkb.APIMethodType) int {
				if arg.Endpoint == "team/reject_invite_acceptance" {
					return 1
				}
				return 0
			}))

	msg2 := acceptInvite(t, &tc, teamID, user2, invLink)
	msg3 := acceptInvite(t, &tc, teamID, user3, invLink)

	// invite is accepted for user2
	records := adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg2, RecordAPI)
	require.Len(t, records, 0, "no invite link acceptances were rejected")

	// We move the clock forward so the invite expires.
	clock.Advance(24 * time.Hour)

	// try to add user3. This should fail
	records = adminCallsHandleTeamSeitanAndReturnsRejectCalls(t, &tc, admin, msg3, DropRejectCallsAPI)
	require.Len(t, records, 1, "one invite acceptance should be rejected")
	record := records[0]
	assertRejectInviteArgs(t, record, SCTeamInviteID(msg3.Seitans[0].InviteID), user3.GetUID(), user3.GetUserVersion().EldestSeqno, "")

	// ensure team has user2 and admin but not user3
	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamName.String(),
		NeedAdmin: true,
	})
	require.NoError(t, err)

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUserVersions(), 2)
	require.Equal(t, []keybase1.UserVersion{admin.GetUserVersion()}, members.Owners)
	require.Equal(t, []keybase1.UserVersion{user2.GetUserVersion()}, members.Readers)
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

func assertRejectInviteArgs(t *testing.T, record libkb.APIRecord, inviteID SCTeamInviteID, uid keybase1.UID, seqno keybase1.Seqno, errString string) {
	require.Equal(t, string(inviteID), record.Arg.Args["invite_id"].String())
	require.Equal(t, string(uid), record.Arg.Args["uid"].String())
	require.Equal(t, fmt.Sprintf("%v", seqno), record.Arg.Args["eldest_seqno"].String())
	if errString == "" {
		require.NoError(t, record.Err)
	} else {
		require.NotNil(t, record.Err)
		require.Contains(t, record.Err.Error(), errString)
	}
}
