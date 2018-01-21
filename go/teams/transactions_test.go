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
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:      name,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	tx := CreateAddMemberTx(team)
	tx.AddMemberTransaction(context.Background(), "t_alice", keybase1.TeamRole_WRITER)
	tx.AddMemberTransaction(context.Background(), other.Username, keybase1.TeamRole_WRITER)
	tx.AddMemberTransaction(context.Background(), "t_tracy", keybase1.TeamRole_ADMIN)

	// 3rd add (pukless member) should re-use first signature instead
	// of creating new one.
	require.Equal(t, 2, len(tx.payloads))

	err = tx.Post(context.Background())
	require.NoError(t, err)
}
