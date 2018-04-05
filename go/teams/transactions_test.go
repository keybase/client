// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"
	"testing"

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
	tx.AddMemberByUsername(context.Background(), "t_alice", keybase1.TeamRole_WRITER)
	require.Equal(t, 1, len(tx.payloads))
	require.IsType(t, &SCTeamInvites{}, tx.payloads[0])

	tx.AddMemberByUsername(context.Background(), other.Username, keybase1.TeamRole_WRITER)
	require.Equal(t, 2, len(tx.payloads))
	require.IsType(t, &SCTeamInvites{}, tx.payloads[0])
	require.IsType(t, &keybase1.TeamChangeReq{}, tx.payloads[1])

	tx.AddMemberByUsername(context.Background(), "t_tracy", keybase1.TeamRole_ADMIN)

	// 3rd add (pukless member) should re-use first signature instead
	// of creating new one.
	require.Equal(t, 2, len(tx.payloads))
	require.IsType(t, &SCTeamInvites{}, tx.payloads[0])
	require.IsType(t, &keybase1.TeamChangeReq{}, tx.payloads[1])

	err = tx.Post(context.Background())
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
	tx.payloads = []interface{}{
		&keybase1.TeamChangeReq{
			Writers: []keybase1.UserVersion{otherB.GetUserVersion()},
		},
		&keybase1.TeamChangeReq{
			None: []keybase1.UserVersion{otherA.GetUserVersion()},
		},
	}
	err = tx.Post(context.Background())
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
