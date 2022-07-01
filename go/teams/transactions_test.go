// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/kbtest"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTransactions1(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:      name,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	tx := CreateAddMemberTx(team)
	tx.AllowPUKless = true
	err = tx.AddMemberByUsername(context.Background(), "t_alice", keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(tx.payloads))
	require.Equal(t, txPayloadTagInviteKeybase, tx.payloads[0].Tag)
	require.IsType(t, &SCTeamInvites{}, tx.payloads[0].Val)

	err = tx.AddMemberByUsername(context.Background(), other.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(tx.payloads))
	require.Equal(t, txPayloadTagInviteKeybase, tx.payloads[0].Tag)
	require.IsType(t, &SCTeamInvites{}, tx.payloads[0].Val)
	require.Equal(t, txPayloadTagCryptomembers, tx.payloads[1].Tag)
	require.IsType(t, &keybase1.TeamChangeReq{}, tx.payloads[1].Val)

	err = tx.AddMemberByUsername(context.Background(), "t_tracy", keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	// 3rd add (pukless member) should re-use first signature instead
	// of creating new one.
	require.Equal(t, 2, len(tx.payloads))
	require.Equal(t, txPayloadTagInviteKeybase, tx.payloads[0].Tag)
	require.IsType(t, &SCTeamInvites{}, tx.payloads[0].Val)
	require.Equal(t, txPayloadTagCryptomembers, tx.payloads[1].Tag)
	require.IsType(t, &keybase1.TeamChangeReq{}, tx.payloads[1].Val)

	err = tx.Post(libkb.NewMetaContextForTest(tc))
	require.NoError(t, err)

	team, err = Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:        name,
		NeedAdmin:   true,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	members, err := team.Members()
	require.NoError(t, err)
	require.Equal(t, 1, len(members.Owners))
	require.Equal(t, owner.GetUserVersion(), members.Owners[0])
	require.Equal(t, 0, len(members.Admins))
	require.Equal(t, 1, len(members.Writers))
	require.Equal(t, other.GetUserVersion(), members.Writers[0])
	require.Equal(t, 0, len(members.Readers))
	require.Equal(t, 0, len(members.Bots))
	require.Equal(t, 0, len(members.RestrictedBots))

	invites := team.GetActiveAndObsoleteInvites()
	require.Equal(t, 2, len(invites))
}

func TestTransactionRotateKey(t *testing.T) {
	tc, _, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	loadTeam := func() *Team {
		team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
			Name:        name,
			NeedAdmin:   true,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		return team
	}

	team := loadTeam()
	err := team.ChangeMembership(context.Background(), keybase1.TeamChangeReq{
		Writers: []keybase1.UserVersion{otherA.GetUserVersion()},
	})
	require.NoError(t, err)

	team = loadTeam()
	require.EqualValues(t, 1, team.Generation())

	tx := CreateAddMemberTx(team)
	// Create payloads manually so user add and user del happen in
	// separate links.
	tx.payloads = []txPayload{
		{
			Tag: txPayloadTagCryptomembers,
			Val: &keybase1.TeamChangeReq{
				Writers: []keybase1.UserVersion{otherB.GetUserVersion()},
			},
		},
		{
			Tag: txPayloadTagCryptomembers,
			Val: &keybase1.TeamChangeReq{
				None: []keybase1.UserVersion{otherA.GetUserVersion()},
			},
		},
	}
	err = tx.Post(libkb.NewMetaContextForTest(tc))
	require.NoError(t, err)

	// Also if the transaction didn't create new PerTeamKey, bunch of
	// assertions would have failed on the server. It doesn't matter
	// which link the PerTeamKey is attached to, because key coverage
	// is checked for the entire transaction, not individual links,
	// but we always attach it to the first ChangeMembership link with
	// member removals.
	team = loadTeam()
	require.EqualValues(t, 2, team.Generation())
}

func TestPreprocessAssertions(t *testing.T) {
	tc := externalstest.SetupTest(t, "assertions", 0)
	defer tc.Cleanup()

	tests := []struct {
		s             string
		isServerTrust bool
		hasSingle     bool
		isError       bool
	}{
		{"bob", false, true, false},
		{"bob+bob@twitter", false, false, false},
		{"[bob@gmail.com]@email", true, true, false},
		{"[bob@gmail.com]@email+bob", false, false, true},
		{"18005558638@phone", true, true, false},
		{"18005558638@phone+alice", false, false, true},
		{"18005558638@phone+[bob@gmail.com]@email", false, false, true},
	}
	for _, test := range tests {
		t.Logf("Testing: %s", test.s)
		isServerTrust, single, full, err := preprocessAssertion(libkb.NewMetaContextForTest(tc), test.s)
		require.Equal(t, isServerTrust, test.isServerTrust)
		require.Equal(t, (single != nil), test.hasSingle)
		if test.isError {
			require.Error(t, err)
			require.Nil(t, full)
		} else {
			require.NoError(t, err)
			require.NotNil(t, full)
		}
	}
}

func TestAllowPukless(t *testing.T) {
	tc, _, other, teamname := setupPuklessInviteTest(t)
	defer tc.Cleanup()

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	assertError := func(err error) {
		require.Error(t, err)
		require.IsType(t, err, UserPUKlessError{})
		require.Contains(t, err.Error(), other.Username)
		require.Contains(t, err.Error(), other.GetUserVersion().String())
	}

	tx := CreateAddMemberTx(team)
	tx.AllowPUKless = false // explicitly disallow, but it's also the default.
	err = tx.AddMemberByUsername(context.Background(), other.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	assertError(err)

	err = tx.AddMemberByUV(context.Background(), other.GetUserVersion(), keybase1.TeamRole_WRITER, nil /* botSettings */)
	assertError(err)

	{
		username, uv, invite, err := tx.AddOrInviteMemberByAssertion(context.Background(), other.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
		assertError(err)
		// All this stuff is still returned despite an error
		require.Equal(t, other.NormalizedUsername(), username)
		require.Equal(t, other.GetUserVersion(), uv)
		// But we aren't actually "inviting" them because of transaction setting.
		require.False(t, invite)
	}

	{
		candidate, err := tx.ResolveUPKV2FromAssertion(tc.MetaContext(), other.Username)
		require.NoError(t, err)
		username, uv, invite, err := tx.AddOrInviteMemberCandidate(context.Background(), candidate, keybase1.TeamRole_WRITER, nil /* botSettings */)
		assertError(err)
		// All this stuff is still returned despite an error
		require.Equal(t, other.NormalizedUsername(), username)
		require.Equal(t, other.GetUserVersion(), uv)
		// But we aren't actually "inviting" them because of transaction setting.
		require.False(t, invite)
	}
}

func TestPostAllowPUKless(t *testing.T) {
	tc, _, other, teamname := setupPuklessInviteTest(t)
	defer tc.Cleanup()

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:      teamname,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	tx := CreateAddMemberTx(team)
	tx.AllowPUKless = true
	err = tx.AddMemberByUsername(context.Background(), other.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)

	// Disallow PUKless after we have already added a PUKless user.
	tx.AllowPUKless = false
	err = tx.Post(tc.MetaContext())
	require.Error(t, err)
	// Make sure it's the error about AllowPUKless.
	require.Contains(t, err.Error(), "AllowPUKless")
}

func TestTransactionRoleChanges(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	user := kbtest.TCreateFakeUser(tc)
	kbtest.TCreateFakeUser(tc) // owner

	_, teamID := createTeam2(tc)

	res, err := AddMemberByID(tc.Context(), tc.G, teamID, user.Username, keybase1.TeamRole_READER,
		nil /* botSettings */, nil /* emailInviteMsg */)
	require.NoError(t, err)
	require.False(t, res.Invited)

	team, err := GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)

	tx := CreateAddMemberTx(team)
	// Try to upgrade role without `AllowRoleChanges` first.
	err = tx.AddMemberByUsername(tc.Context(), user.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.Error(t, err)
	require.IsType(t, libkb.ExistsError{}, err)

	require.Len(t, tx.payloads, 0) // should not have changed transaction
	require.NoError(t, tx.err)     // should not be a permanent error

	// Set `AllowRoleChanges`.
	tx.AllowRoleChanges = true

	// Trying to add with same role as current is still an error.
	err = tx.AddMemberByUsername(tc.Context(), user.Username, keybase1.TeamRole_READER, nil /* botSettings */)
	require.Error(t, err)
	require.IsType(t, libkb.ExistsError{}, err)

	// We can set a different role though (READER -> WRITER)
	err = tx.AddMemberByUsername(tc.Context(), user.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)

	err = tx.Post(tc.MetaContext())
	require.NoError(t, err)

	// See if role change worked
	team, err = GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)
	role, err := team.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)

	// Should be able to go the other way as well (WRITER -> READER).
	tx = CreateAddMemberTx(team)
	tx.AllowRoleChanges = true
	err = tx.AddMemberByUsername(tc.Context(), user.Username, keybase1.TeamRole_READER, nil /* botSettings */)
	require.NoError(t, err)

	err = tx.Post(tc.MetaContext())
	require.NoError(t, err)

	// See if it worked.
	team, err = GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)
	role, err = team.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, role)

	userLog := team.chain().inner.UserLog[user.GetUserVersion()]
	require.Len(t, userLog, 3)
}

func TestTransactionEmailExists(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	kbtest.TCreateFakeUser(tc)
	_, teamID := createTeam2(tc)

	randomEmail := kbtest.GenerateRandomEmailAddress()
	err := InviteEmailPhoneMember(tc.Context(), tc.G, teamID, randomEmail.String(), "email", keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	team, err := GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)

	invite, err := team.chain().FindActiveInviteString(tc.MetaContext(), randomEmail.String(), "email")
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, invite.Role)

	tx := CreateAddMemberTx(team)
	tx.AllowRoleChanges = true

	assertion := fmt.Sprintf("[%s]@email", randomEmail)

	// Check if we can catch this error and continue forward
	_, _, _, err = tx.AddOrInviteMemberByAssertion(tc.Context(), assertion, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.Error(t, err)
	require.IsType(t, libkb.ExistsError{}, err)

	// Changing roles of an invite using AddMemberTx is not possible right now.
	_, _, _, err = tx.AddOrInviteMemberByAssertion(tc.Context(), assertion, keybase1.TeamRole_READER, nil /* botSettings */)
	require.Error(t, err)
	require.IsType(t, libkb.ExistsError{}, err)

	// Two errors above should not have tainted the transaction.
	require.Len(t, tx.payloads, 0)
	require.NoError(t, tx.err)
}

func TestTransactionResolvableEmailExists(t *testing.T) {
	// Similar test but with resolvable email.
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user := kbtest.TCreateFakeUser(tc)

	// Add and verify email address.
	usersEmail := kbtest.GenerateRandomEmailAddress()
	err := emails.AddEmail(tc.MetaContext(), usersEmail, keybase1.IdentityVisibility_PUBLIC)
	require.NoError(t, err)
	err = kbtest.VerifyEmailAuto(tc.MetaContext(), usersEmail)
	require.NoError(t, err)

	kbtest.TCreateFakeUser(tc) // owner

	_, teamID := createTeam2(tc)
	team, err := GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)

	assertion := fmt.Sprintf("[%s]@email", usersEmail)

	// Invite email for the first time, should resolve and add user.
	tx := CreateAddMemberTx(team)

	username, uv, invited, err := tx.AddOrInviteMemberByAssertion(tc.Context(), assertion, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)
	require.Equal(t, user.NormalizedUsername(), username)
	require.Equal(t, user.GetUserVersion(), uv)
	require.False(t, invited)

	err = tx.Post(tc.MetaContext())
	require.NoError(t, err)

	// Ensure they were added as member (team.MemberRole).
	team, err = GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)
	role, err := team.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)
	// And that e-mail wasn't added as invite.
	hasInvite, err := team.HasActiveInvite(tc.MetaContext(), keybase1.TeamInviteName(usersEmail), "email")
	require.NoError(t, err)
	require.False(t, hasInvite)

	// Try again, should fail.
	tx = CreateAddMemberTx(team)
	_, _, _, err = tx.AddOrInviteMemberByAssertion(tc.Context(), assertion, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.Error(t, err)
	require.IsType(t, libkb.ExistsError{}, err)

	require.Len(t, tx.payloads, 0)
	require.NoError(t, tx.err)

	// Role changes are possible with `AllowRoleChanges` because they are
	// crypto-member.
	tx = CreateAddMemberTx(team)
	tx.AllowRoleChanges = true
	_, _, _, err = tx.AddOrInviteMemberByAssertion(tc.Context(), assertion, keybase1.TeamRole_READER, nil /* botSettings */)
	require.NoError(t, err)

	err = tx.Post(tc.MetaContext())
	require.NoError(t, err)

	team, err = GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)
	role, err = team.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, role)
}

func TestTransactionAddEmailPukless(t *testing.T) {
	// Add e-mail that resolves to a PUK-less user.

	fus, tcs, cleanup := setupNTestsWithPukless(t, 2, 1)
	defer cleanup()

	usersEmail := kbtest.GenerateRandomEmailAddress()
	err := emails.AddEmail(tcs[1].MetaContext(), usersEmail, keybase1.IdentityVisibility_PUBLIC)
	require.NoError(t, err)
	err = kbtest.VerifyEmailAuto(tcs[1].MetaContext(), usersEmail)
	require.NoError(t, err)

	_, teamID := createTeam2(*tcs[0])
	team, err := GetForTeamManagementByTeamID(tcs[0].Context(), tcs[0].G, teamID, true /* needAdmin */)
	require.NoError(t, err)

	assertion := fmt.Sprintf("[%s]@email", usersEmail)

	tx := CreateAddMemberTx(team)
	// Can't add without AllowPUKless.
	_, _, _, err = tx.AddOrInviteMemberByAssertion(tcs[0].Context(), assertion, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.Error(t, err)
	require.IsType(t, UserPUKlessError{}, err)

	// Failure to add should have left the transaction unmodified.
	require.Len(t, tx.payloads, 0)
	require.NoError(t, tx.err)

	tx.AllowPUKless = true
	username, uv, invited, err := tx.AddOrInviteMemberByAssertion(tcs[0].Context(), assertion, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)
	require.True(t, invited)
	require.Equal(t, fus[1].NormalizedUsername(), username)
	require.Equal(t, fus[1].GetUserVersion(), uv)

	err = tx.Post(tcs[0].MetaContext())
	require.NoError(t, err)

	team, err = GetForTeamManagementByTeamID(tcs[0].Context(), tcs[0].G, teamID, true /* needAdmin */)
	require.NoError(t, err)
	_, uv, found := team.FindActiveKeybaseInvite(fus[1].GetUID())
	require.True(t, found)
	require.Equal(t, fus[1].GetUserVersion(), uv)

	found, err = team.HasActiveInvite(tcs[0].MetaContext(), keybase1.TeamInviteName(usersEmail), "email")
	require.NoError(t, err)
	require.False(t, found)
}

func TestTransactionDowngradeAdmin(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user := kbtest.TCreateFakeUser(tc)
	kbtest.TCreateFakeUser(tc) // owner

	_, teamID := createTeam2(tc)

	// Add user as admin.
	res, err := AddMemberByID(tc.Context(), tc.G, teamID, user.Username, keybase1.TeamRole_ADMIN,
		nil /* botSettings */, nil /* emailInviteMsg */)
	require.NoError(t, err)
	require.False(t, res.Invited)

	// Load team, change role of user to writer (from admin).
	team, err := GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)

	memberRole, err := team.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_ADMIN, memberRole)

	tx := CreateAddMemberTx(team)
	tx.AllowRoleChanges = true
	err = tx.AddMemberByUsername(tc.Context(), user.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)
	require.Len(t, tx.payloads, 1)

	err = tx.Post(tc.MetaContext())
	require.NoError(t, err)

	// See if it worked.
	team, err = GetForTeamManagementByTeamID(tc.Context(), tc.G, teamID, true /* needAdmin */)
	require.NoError(t, err)

	memberRole, err = team.MemberRole(tc.Context(), user.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, memberRole)
}
