package service

import (
	"context"
	"encoding/json"
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

func TestKvStoreMultiUserTeam(t *testing.T) {
	tcAlice := kvTestSetup(t)
	defer tcAlice.Cleanup()
	tcBob := kvTestSetup(t)
	defer tcBob.Cleanup()
	tcCharlie := kvTestSetup(t)
	defer tcCharlie.Cleanup()
	ctx := context.Background()

	alice, err := kbtest.CreateAndSignupFakeUser("kvsA", tcAlice.G)
	require.NoError(t, err)
	aliceHandler := NewKVStoreHandler(nil, tcAlice.G)
	bob, err := kbtest.CreateAndSignupFakeUser("kvsB", tcBob.G)
	require.NoError(t, err)
	bobHandler := NewKVStoreHandler(nil, tcBob.G)
	charlie, err := kbtest.CreateAndSignupFakeUser("kvsB", tcCharlie.G)
	require.NoError(t, err)
	charlieHandler := NewKVStoreHandler(nil, tcCharlie.G)

	teamName := alice.Username + "t"
	teamID, err := teams.CreateRootTeam(context.Background(), tcAlice.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)
	_, err = teams.AddMember(context.Background(), tcAlice.G, teamName, bob.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// Alice puts a secret
	namespace := "myapp"
	entryKey := "asdfasfeasef"
	secretData := map[string]interface{}{
		"username":      "hunter2",
		"email":         "thereal@example.com",
		"password":      "super random password",
		"OTP":           "otp secret",
		"twoFactorAuth": "not-really-anymore",
	}
	cleartextSecret, err := json.Marshal(secretData)
	require.NoError(t, err)
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: string(cleartextSecret),
	}
	putRes, err := aliceHandler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 1, putRes.Revision)

	// Bob can read it
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := bobHandler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, string(cleartextSecret), getRes.EntryValue)
	require.Equal(t, 1, getRes.Revision)

	// Alice kicks bob out of the team.
	err = teams.RemoveMember(ctx, tcAlice.G, teamName, bob.Username)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), tcAlice.G, *teamID)
	require.NoError(t, err)

	// Bob cannot read the entry anymore.
	getRes, err = bobHandler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, err, libkb.AppStatusError{})
	aerr, _ := err.(libkb.AppStatusError)
	if aerr.Code != libkb.SCTeamBadMembership {
		t.Fatalf("expected an SCTeamBadMembership error but got %v", err)
	}

	// New user to the team can overwrite the existing entry without specifying a revision
	_, err = teams.AddMember(ctx, tcAlice.G, teamName, charlie.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	cleartextSecret = []byte("overwritten")
	putArg = keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: string(cleartextSecret),
	}
	putRes, err = charlieHandler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 2, putRes.Revision)
	getRes, err = charlieHandler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, string(cleartextSecret), getRes.EntryValue)
	require.Equal(t, 2, getRes.Revision)
}

func TestRevisionCache(t *testing.T) {
	tc := kvTestSetup(t)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	user, err := kbtest.CreateAndSignupFakeUser("kv", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)

	// create a new entry and other basic setup
	namespace := "myapp"
	entryKey := "entry-key-whatever"
	secretData := "supersecret"
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: secretData,
	}
	putRes, err := handler.PutKVEntry(mctx.Ctx(), putArg)
	require.NoError(t, err)
	require.Equal(t, 1, putRes.Revision)
	entryID := keybase1.KVEntryID{
		TeamID:    *teamID,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}

	// Mutate the revision cache to simulate the cases where the server
	// is lying to the client about the next fetched entry. First, fetch
	// and assert some basic stuff about the revision cache.
	revCache := tc.G.GetKVRevisionCache()
	entryHash, generation, revision := revCache.Fetch(mctx, entryID)
	require.NotEmpty(t, entryHash)
	require.EqualValues(t, 1, generation)
	require.Equal(t, 1, revision)

	// bump the revision in the cache and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache())
	revCache = tc.G.GetKVRevisionCache()
	revCache.PutCheck(mctx, entryID, entryHash, generation, 2)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.Error(t, err)
	require.IsType(t, kvstore.KVRevisionCacheError{}, err)
	require.Contains(t, err.Error(), "revision")

	// bump the team key generation and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache())
	revCache = tc.G.GetKVRevisionCache()
	revCache.PutCheck(mctx, entryID, entryHash, keybase1.PerTeamKeyGeneration(2), revision)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.Error(t, err)
	require.IsType(t, kvstore.KVRevisionCacheError{}, err)
	require.Contains(t, err.Error(), "team key generation")

	// mutate the entry hash and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache())
	revCache = tc.G.GetKVRevisionCache()
	revCache.PutCheck(mctx, entryID, "this-is-wrong", generation, revision)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.Error(t, err)
	require.IsType(t, kvstore.KVRevisionCacheError{}, err)
	require.Contains(t, err.Error(), "hash of entry")

	// verify that it does not error with the right things in the cache
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache())
	revCache = tc.G.GetKVRevisionCache()
	revCache.PutCheck(mctx, entryID, entryHash, generation, revision)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.NoError(t, err)
}
