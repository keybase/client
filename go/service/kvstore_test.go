package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/kvstore"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func kvTestSetup(t *testing.T) libkb.TestContext {
	tc := libkb.SetupTest(t, "kvstore", 0)
	teams.ServiceInit(tc.G)
	newRevisionCache := kvstore.NewKVRevisionCache()
	tc.G.SetKVRevisionCache(newRevisionCache)
	return tc
}

func TestKvStoreSelfTeamPutGet(t *testing.T) {
	tc := kvTestSetup(t)
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

	updatedSecret := `Contrary to popular belief, Lorem Ipsum is not simply
		random text. It has roots in a piece of classical Latin literature
		from 45 BC, making it over 2000 years old.`
	putArg = keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: updatedSecret,
	}
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 2, putRes.Revision)
	getRes, err = handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, updatedSecret, getRes.EntryValue)
}
