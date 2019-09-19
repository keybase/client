package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestKvStoreSelfTeamPutGet(t *testing.T) {
	tc := libkb.SetupTest(t, "kvstore", 0)
	teams.ServiceInit(tc.G)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("kvs", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	ctx := context.Background()
	teamName := fmt.Sprintf("%s,%s", user.Username, user.Username)
	namespace := "ye-namespace"
	entryKey := "lookmeup"

	// put a secret
	cleartextSecret := "lorem ipsum blah blah blah"
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: cleartextSecret,
	}
	putRes, err := handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 1, putRes.Revision)

	// fetch it and assert that it's the same
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, cleartextSecret, getRes.EntryValue)
}
