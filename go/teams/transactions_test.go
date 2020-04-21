// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"
	"testing"

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

func TestTaintAllowPukless(t *testing.T) {
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
