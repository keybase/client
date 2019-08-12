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
		txPayload{
			Tag: txPayloadTagCryptomembers,
			Val: &keybase1.TeamChangeReq{
				Writers: []keybase1.UserVersion{otherB.GetUserVersion()},
			},
		},
		txPayload{
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
		s         string
		isEmail   bool
		hasSingle bool
		isError   bool
	}{
		{"bob", false, true, false},
		{"bob+bob@twitter", false, false, false},
		{"[bob@gmail.com]@email", true, true, false},
		{"[bob@gmail.com]@email+bob", false, false, true},
	}
	for _, test := range tests {
		isEmail, single, err := preprocessAssertion(libkb.NewMetaContextForTest(tc), test.s)
		require.Equal(t, isEmail, test.isEmail)
		require.Equal(t, (single != nil), test.hasSingle)
		require.Equal(t, (err != nil), test.isError)
	}
}
