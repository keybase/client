// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"

	"github.com/davecgh/go-spew/spew"
)

func TestTransactions1(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name: name,
	})
	require.NoError(t, err)

	tx := CreateAddMemberTx(team)
	tx.AddMemberTransaction(context.Background(), tc.G, other.Username, keybase1.TeamRole_WRITER)
	tx.AddMemberTransaction(context.Background(), tc.G, "t_alice", keybase1.TeamRole_WRITER)

	spew.Dump(tx.payloads)
}
