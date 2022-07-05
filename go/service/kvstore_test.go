package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/kvstore"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func kvTestSetup(t *testing.T) libkb.TestContext {
	tc := libkb.SetupTest(t, "kvstore", 0)
	teams.ServiceInit(tc.G)
	newRevisionCache := kvstore.NewKVRevisionCache(tc.G)
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

	// fetch nonexistent
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Nil(t, getRes.EntryValue)
	require.Equal(t, 0, getRes.Revision)
	// and list
	listNamespacesArg := keybase1.ListKVNamespacesArg{TeamName: teamName}
	listNamespacesRes, err := handler.ListKVNamespaces(ctx, listNamespacesArg)
	require.NoError(t, err)
	require.EqualValues(t, listNamespacesRes.Namespaces, []string{})
	listEntriesArg := keybase1.ListKVEntriesArg{TeamName: teamName, Namespace: namespace}
	listEntriesRes, err := handler.ListKVEntries(ctx, listEntriesArg)
	require.NoError(t, err)
	require.EqualValues(t, []keybase1.KVListEntryKey{}, listEntriesRes.EntryKeys)

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

	// fetch it and assert that it's now correct
	getRes, err = handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, cleartextSecret, *getRes.EntryValue)

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
	require.Equal(t, updatedSecret, *getRes.EntryValue)

	// another user cannot see or edit this entry
	tcEve := kvTestSetup(t)
	defer tcEve.Cleanup()
	_, err = kbtest.CreateAndSignupFakeUser("kvs", tcEve.G)
	require.NoError(t, err)
	eveHandler := NewKVStoreHandler(nil, tcEve.G)
	getRes, err = eveHandler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.Contains(t, err.Error(), "You are not a member of this team")

	// put again
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)

	// lists correctly
	listNamespacesRes, err = handler.ListKVNamespaces(ctx, listNamespacesArg)
	require.NoError(t, err)
	require.EqualValues(t, listNamespacesRes.Namespaces, []string{namespace})

	listEntriesRes, err = handler.ListKVEntries(ctx, listEntriesArg)
	require.NoError(t, err)
	expectedKey := keybase1.KVListEntryKey{EntryKey: entryKey, Revision: 3}
	require.EqualValues(t, []keybase1.KVListEntryKey{expectedKey}, listEntriesRes.EntryKeys)
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
	t.Logf("%s created team %s:%s", alice.Username, teamName, teamID)

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
	t.Logf("alice successfully wrote an entry at revision 1")

	// Bob can read it
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := bobHandler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, string(cleartextSecret), *getRes.EntryValue)
	require.Equal(t, 1, getRes.Revision)
	listEntriesArg := keybase1.ListKVEntriesArg{TeamName: teamName, Namespace: namespace}
	expectedKey := keybase1.KVListEntryKey{EntryKey: entryKey, Revision: 1}
	listEntriesRes, err := bobHandler.ListKVEntries(ctx, listEntriesArg)
	require.NoError(t, err)
	require.EqualValues(t, listEntriesRes.EntryKeys, []keybase1.KVListEntryKey{expectedKey})
	t.Logf("bob can GET and LIST it")

	// Alice kicks bob out of the team.
	err = teams.RemoveMember(ctx, tcAlice.G, teamName, bob.Username)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), tcAlice.G, *teamID)
	require.NoError(t, err)
	t.Logf("bob is no longer in the team")

	// Bob cannot read the entry anymore.
	getRes, err = bobHandler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.Contains(t, err.Error(), "You are not a member of this team (error 2623)")
	require.IsType(t, err, libkb.AppStatusError{})
	aerr, _ := err.(libkb.AppStatusError)
	if aerr.Code != libkb.SCTeamReadError {
		t.Fatalf("expected an SCTeamReadError error but got %v", err)
	}
	listNamespacesArg := keybase1.ListKVNamespacesArg{TeamName: teamName}
	_, err = bobHandler.ListKVNamespaces(ctx, listNamespacesArg)
	require.Error(t, err)
	require.IsType(t, err, libkb.AppStatusError{})
	aerr, _ = err.(libkb.AppStatusError)
	if aerr.Code != libkb.SCTeamReadError {
		t.Fatalf("expected an SCTeamReadError error but got %v", err)
	}
	t.Logf("bob can no longer GET or LIST the entry")

	// New user to the team can overwrite the existing entry without specifying a revision
	_, err = teams.AddMember(ctx, tcAlice.G, teamName, charlie.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	t.Logf("new user, charlie, is added to the team")
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
	t.Logf("charlie can write to the entry")
	getRes, err = charlieHandler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, string(cleartextSecret), *getRes.EntryValue)
	require.Equal(t, 2, getRes.Revision)
	listNamespacesRes, err := charlieHandler.ListKVNamespaces(ctx, listNamespacesArg)
	require.NoError(t, err)
	require.EqualValues(t, listNamespacesRes.Namespaces, []string{namespace})
	listEntriesRes, err = charlieHandler.ListKVEntries(ctx, listEntriesArg)
	require.NoError(t, err)
	expectedKey = keybase1.KVListEntryKey{EntryKey: entryKey, Revision: 2}
	require.EqualValues(t, []keybase1.KVListEntryKey{expectedKey}, listEntriesRes.EntryKeys)
	t.Logf("charlie can fetch and list the entry")
}

func TestKVDelete(t *testing.T) {
	tc := kvTestSetup(t)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	ctx := context.Background()
	user, err := kbtest.CreateAndSignupFakeUser("kv", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)

	namespace := "myapp"
	entryKey := "entry-key-whatever"
	// delete a non-existent entry
	delArg := keybase1.DelKVEntryArg{
		SessionID: 0,
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	_, err = handler.DelKVEntry(mctx.Ctx(), delArg)
	require.Error(t, err)
	require.IsType(t, err, libkb.AppStatusError{})
	aerr, _ := err.(libkb.AppStatusError)
	if aerr.Code != libkb.SCTeamStorageNotFound {
		t.Fatalf("expected an SCTeamStorageNotFound error but got %v", err)
	}
	t.Logf("attempting to delete a non-existent entry errors")

	// create the new entry
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: "secret value",
	}
	putRes, err := handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 1, putRes.Revision)

	// delete it
	delRes, err := handler.DelKVEntry(mctx.Ctx(), delArg)
	require.NoError(t, err)
	require.Equal(t, 2, delRes.Revision)

	t.Logf("deleting an entry returns the next revision")
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, 2, getRes.Revision)
	require.Equal(t, teamName, getRes.TeamName)
	require.Equal(t, namespace, getRes.Namespace)
	require.Equal(t, entryKey, getRes.EntryKey)
	require.Nil(t, getRes.EntryValue)
	t.Logf("fetching a deleted entry has the correct revision and empty value")

	// delete it again
	delRes, err = handler.DelKVEntry(mctx.Ctx(), delArg)
	require.Error(t, err)
	require.IsType(t, err, libkb.AppStatusError{})
	aerr, _ = err.(libkb.AppStatusError)
	if aerr.Code != libkb.SCTeamStorageNotFound {
		t.Fatalf("expected an SCTeamStorageNotFound error but got %v", err)
	}
	t.Logf("attempting to delete a deleted entry errors")

	// recreate it after deletion
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 3, putRes.Revision)
	getRes, err = handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, 3, getRes.Revision)
	require.Equal(t, "secret value", *getRes.EntryValue)

	// delete it again
	delRes, err = handler.DelKVEntry(mctx.Ctx(), delArg)
	require.NoError(t, err)
	require.Equal(t, 4, delRes.Revision)
}

func assertRevisionError(t *testing.T, err error, expectedSource string) {
	require.Error(t, err)
	aerr, _ := err.(libkb.AppStatusError)
	require.IsType(t, libkb.AppStatusError{}, aerr)
	require.Equal(t, libkb.SCTeamStorageWrongRevision, aerr.Code)
	require.Contains(t, err.Error(), "(error 2760)")
	require.Contains(t, err.Error(), "revision")
	switch expectedSource {
	case "server":
		possibleServerMessages := []string{
			"expected revision [0-9]+ but got [0-9]+",
			"revision [0-9]+ already exists for this entry",
		}
		regex := strings.Join(possibleServerMessages, "|")
		require.Regexp(t, regexp.MustCompile(regex), err.Error())
	case "cache":
		require.Regexp(t, regexp.MustCompile("revision out of date"), err.Error())
	default:
		require.Fail(t, "revision error must come from the server or the cache")
	}
}

func TestRevisionCache(t *testing.T) {
	tc := kvTestSetup(t)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	ctx := mctx.Ctx()
	user, err := kbtest.CreateAndSignupFakeUser("kv", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)

	// create a new entry and other basic setup
	namespace := "myapp"
	entryKey := "messin-withtha-cache"
	secretData := "supersecret"
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: secretData,
	}
	putRes, err := handler.PutKVEntry(ctx, putArg)
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
	kvRevCache := tc.G.GetKVRevisionCache().(*kvstore.KVRevisionCache)
	entryHash, generation, revision := kvRevCache.Inspect(entryID)
	require.NotEmpty(t, entryHash)
	require.EqualValues(t, 1, generation)
	require.Equal(t, 1, revision)

	// bump the revision in a new cache and verify error when going through the handler
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache := tc.G.GetKVRevisionCache()
	err = revCache.Check(mctx, entryID, &secretData, generation, 2)
	require.NoError(t, err)
	err = revCache.Put(mctx, entryID, &secretData, generation, 2)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.Contains(t, err.Error(), "revision")

	// bump the team key generation in a new cache and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache = tc.G.GetKVRevisionCache()
	err = revCache.Check(mctx, entryID, &secretData, keybase1.PerTeamKeyGeneration(2), revision)
	require.NoError(t, err)
	err = revCache.Put(mctx, entryID, &secretData, keybase1.PerTeamKeyGeneration(2), revision)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.Contains(t, err.Error(), "team key generation")

	// mutate the entry hash and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache = tc.G.GetKVRevisionCache()
	differentCiphertext := "this-is-wrong"
	err = revCache.Check(mctx, entryID, &differentCiphertext, generation, revision)
	require.NoError(t, err)
	err = revCache.Put(mctx, entryID, &differentCiphertext, generation, revision)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.Contains(t, err.Error(), "hash of entry")
	t.Logf("revision cache protects the client from the server lying in fetches")

	// convenience checks for PUT and DELETE
	// set a new cache and put an update
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	putArg = keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: secretData,
		Revision:   2,
	}
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 2, putRes.Revision)
	// assert the revision cache is what we think
	kvRevCache = tc.G.GetKVRevisionCache().(*kvstore.KVRevisionCache)
	entryHash, generation, revision = kvRevCache.Inspect(entryID)
	require.NotEmpty(t, entryHash)
	require.EqualValues(t, 1, generation)
	require.Equal(t, 2, revision)

	// attempt a put with a revision that the cache knows is too low
	putArg.Revision = 2
	_, err = handler.PutKVEntry(ctx, putArg)
	assertRevisionError(t, err, "cache")
	// attempt a put with a revision that's too high, but the cache can't know that (so it's a server error)
	putArg.Revision = 4
	_, err = handler.PutKVEntry(ctx, putArg)
	assertRevisionError(t, err, "server")
	t.Logf("revision cache provides convenience checks (the server also catches these things too) on updates")

	// and the same for deletes
	delArg := keybase1.DelKVEntryArg{
		SessionID: 0,
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	delArg.Revision = 2
	_, err = handler.DelKVEntry(ctx, delArg)
	assertRevisionError(t, err, "cache")
	delArg.Revision = 4
	_, err = handler.DelKVEntry(ctx, delArg)
	assertRevisionError(t, err, "server")
	t.Logf("revision cache also provides the convenience checks for deletes")
}

var _ kvstore.KVStoreBoxer = (*KVStoreTestBoxer)(nil)

type KVStoreTestBoxer struct {
	libkb.Contextified
	BoxMutateRevision     func(currentRevision int) (newRevision int)
	UnboxMutateTeamGen    func(gen keybase1.PerTeamKeyGeneration) (newGen keybase1.PerTeamKeyGeneration)
	UnboxMutateCiphertext func(ciphertext string) string
}

func (b *KVStoreTestBoxer) Box(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, cleartextValue string) (ciphertext string,
	teamKeyGen keybase1.PerTeamKeyGeneration, ciphertextVersion int, err error) {
	realBoxer := kvstore.NewKVStoreBoxer(mctx.G())
	if b.BoxMutateRevision != nil {
		revision = b.BoxMutateRevision(revision)
	}
	return realBoxer.Box(mctx, entryID, revision, cleartextValue)
}

func (b *KVStoreTestBoxer) Unbox(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, ciphertext string, teamKeyGen keybase1.PerTeamKeyGeneration,
	formatVersion int, senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno, senderDeviceID keybase1.DeviceID) (cleartext string, err error) {
	realBoxer := kvstore.NewKVStoreBoxer(mctx.G())
	if b.UnboxMutateTeamGen != nil {
		teamKeyGen = b.UnboxMutateTeamGen(teamKeyGen)
	}
	if b.UnboxMutateCiphertext != nil {
		ciphertext = b.UnboxMutateCiphertext(ciphertext)
	}
	return realBoxer.Unbox(mctx, entryID, revision, ciphertext, teamKeyGen, formatVersion, senderUID, senderEldestSeqno, senderDeviceID)
}

func TestKVEncryptionAndVerification(t *testing.T) {
	ctx := context.TODO()
	tc := kvTestSetup(t)
	defer tc.Cleanup()
	user, err := kbtest.CreateAndSignupFakeUser("kvs", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	// inject a test Boxer into the handler which, at this point,
	// is just a passthrough to the real Boxer, but ensure that
	// any expected errors later are not false negatives.
	handler.Boxer = &KVStoreTestBoxer{
		Contextified: libkb.NewContextified(tc.G),
	}
	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)
	err = teams.RotateKeyVisible(context.TODO(), tc.G, *teamID)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), tc.G, *teamID)
	require.NoError(t, err)
	namespace := "myapp"
	entryKey := "entry-key-entry-key"
	secretData := "supersecret"
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: secretData,
	}
	putRes, err := handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 3, putRes.Revision)
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, secretData, *getRes.EntryValue)
	require.Equal(t, 3, getRes.Revision)
	t.Logf("entry exists for team at revision 3 and key generation 3")

	// attempt to decrypt with the wrong team key generation
	// should fail to decrypt
	handler.Boxer = &KVStoreTestBoxer{
		Contextified: libkb.NewContextified(tc.G),
		UnboxMutateTeamGen: func(gen keybase1.PerTeamKeyGeneration) (newGen keybase1.PerTeamKeyGeneration) {
			require.EqualValues(t, 3, gen, "generation should be 3 at this point")
			return keybase1.PerTeamKeyGeneration(2)
		},
	}
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, signencrypt.Error{}, err)
	require.Equal(t, err.(signencrypt.Error).Type, signencrypt.BadSecretbox)
	t.Logf("attempting to decrypt with the wrong key generation fails")

	// should fail to open if the server tells the client it's the wrong revision
	handler.Boxer = &KVStoreTestBoxer{
		Contextified:      libkb.NewContextified(tc.G),
		BoxMutateRevision: func(currentRevision int) (newRevision int) { return 2 },
	}
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, signencrypt.Error{}, err)
	require.Equal(t, err.(signencrypt.Error).Type, signencrypt.AssociatedDataMismatch)
	t.Logf("verifying a signature with the wrong revision fails")

	// should error if given the wrong nonce
	handler.Boxer = &KVStoreTestBoxer{
		Contextified: libkb.NewContextified(tc.G),
		UnboxMutateCiphertext: func(currentCiphertext string) (newCiphertext string) {
			decoded, err := base64.StdEncoding.DecodeString(currentCiphertext)
			require.NoError(t, err)
			var box keybase1.EncryptedKVEntry
			err = msgpack.Decode(&box, decoded)
			require.NoError(t, err)
			require.Equal(t, len(box.N), 16, "there is an actual 16 byte nonce")
			randBytes, err := libkb.RandBytes(16)
			require.NoError(t, err)
			box.N = randBytes
			packed, err := msgpack.Encode(box)
			require.NoError(t, err)
			return base64.StdEncoding.EncodeToString(packed)
		},
	}
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, signencrypt.Error{}, err)
	require.Equal(t, err.(signencrypt.Error).Type, signencrypt.BadSecretbox)
	t.Logf("cannot decrypt with the wrong nonce")
	// switch to a new, non-broken entry key to test that the nonce changes
	putArg.EntryKey = "not-broken"
	getArg.EntryKey = "not-broken"
	var firstNonce, secondNonce [16]byte
	handler.Boxer = &KVStoreTestBoxer{
		Contextified: libkb.NewContextified(tc.G),
		UnboxMutateCiphertext: func(currentCiphertext string) (newCiphertext string) {
			decoded, err := base64.StdEncoding.DecodeString(currentCiphertext)
			require.NoError(t, err)
			var box keybase1.EncryptedKVEntry
			err = msgpack.Decode(&box, decoded)
			require.NoError(t, err)
			require.Equal(t, len(box.N), 16, "there is an actual 16 byte nonce")
			copy(firstNonce[:], box.N)
			return currentCiphertext
		},
	}
	_, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, len(firstNonce), 16, "firstNonce got populated")
	handler.Boxer = &KVStoreTestBoxer{
		Contextified: libkb.NewContextified(tc.G),
		UnboxMutateCiphertext: func(ciphertext string) string {
			decoded, err := base64.StdEncoding.DecodeString(ciphertext)
			require.NoError(t, err)
			var box keybase1.EncryptedKVEntry
			err = msgpack.Decode(&box, decoded)
			require.NoError(t, err)
			require.Equal(t, len(box.N), 16, "there is an actual 16 byte nonce")
			t.Logf("the nonce is 16 bytes")
			copy(secondNonce[:], box.N)
			return ciphertext
		},
	}
	_, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, len(secondNonce), 16, "secondNonce got populated")
	require.NotEqual(t, firstNonce, secondNonce)
	t.Logf("two puts with identical data and keys use different nonces")
}

// TestManualControlOfRevisionWithoutCache tests the server erroring correctly
// when fed the wrong revision, and that error bubbling up. This requires resetting
// the cache before each request.
func TestManualControlOfRevisionWithoutCache(t *testing.T) {
	tc := kvTestSetup(t)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	ctx := mctx.Ctx()
	user, err := kbtest.CreateAndSignupFakeUser("kv", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)

	// create a new entry and other basic setup
	namespace := "manually-controlled-namespace"
	entryKey := "ye-new-key"
	secretData := "supersecret"
	basePutArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: secretData,
	}

	putItWithRev := func(revision int) (res keybase1.KVPutResult, err error) {
		// reset the cache before each PUT to avoid additional errors from there
		tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
		putArg := basePutArg
		putArg.Revision = revision
		return handler.PutKVEntry(ctx, putArg)
	}

	// errors if you specify a Revision > 1 for a new entry
	_, err = putItWithRev(2)
	assertRevisionError(t, err, "server")

	// create it with revision 1
	putRes, err := putItWithRev(1)
	require.NoError(t, err)
	require.Equal(t, putRes.Revision, 1)

	// cannot update it again with revision 1
	_, err = putItWithRev(1)
	assertRevisionError(t, err, "server")

	// updates correctly
	putRes, err = putItWithRev(2)
	require.NoError(t, err)
	require.Equal(t, putRes.Revision, 2)

	// cannot update with a revision that's too high
	_, err = putItWithRev(4)
	assertRevisionError(t, err, "server")

	// cannot update with a revision that's too low
	_, err = putItWithRev(2)
	assertRevisionError(t, err, "server")

	baseDelArg := keybase1.DelKVEntryArg{
		SessionID: 0,
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}

	deleteItWithRev := func(revision int) (res keybase1.KVDeleteEntryResult, err error) {
		// reset the cache before each request to avoid additional errors from there
		tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
		delArg := baseDelArg
		delArg.Revision = revision
		return handler.DelKVEntry(ctx, delArg)
	}

	// cannot delete with a revision that's too low
	_, err = deleteItWithRev(2)
	assertRevisionError(t, err, "server")

	// cannot delete with a revision that's too high
	_, err = deleteItWithRev(4)
	assertRevisionError(t, err, "server")

	// deletes correctly
	delRes, err := deleteItWithRev(3)
	require.NoError(t, err)
	require.Equal(t, delRes.Revision, 3)
}

// TestKVStoreRace tests that multiple requests by multiple users in rapid succession do not
// cause unexpected errors or busted caches
func TestKVStoreRace(t *testing.T) {
	tc1 := kvTestSetup(t)
	defer tc1.Cleanup()
	mctx1 := libkb.NewMetaContextForTest(tc1)
	ctx1 := mctx1.Ctx()
	user1, err := kbtest.CreateAndSignupFakeUser("kv", tc1.G)
	require.NoError(t, err)
	handler1 := NewKVStoreHandler(nil, tc1.G)
	teamName := user1.Username + "t"
	teamID, err := teams.CreateRootTeam(ctx1, tc1.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)
	// add a second user to the team
	tc2 := kvTestSetup(t)
	defer tc2.Cleanup()
	mctx2 := libkb.NewMetaContextForTest(tc2)
	ctx2 := mctx2.Ctx()
	user2, err := kbtest.CreateAndSignupFakeUser("kv", tc2.G)
	require.NoError(t, err)
	handler2 := NewKVStoreHandler(nil, tc2.G)
	_, err = teams.AddMember(ctx1, tc1.G, teamName, user2.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	namespace := "race-namespace"
	entryKey := "race-key"
	secretData := "supersecret"
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: secretData,
	}
	var wg sync.WaitGroup
	errChan := make(chan error, 10)
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err = handler1.PutKVEntry(ctx1, putArg)
			errChan <- err
		}()
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err = handler2.PutKVEntry(ctx2, putArg)
			errChan <- err
		}()
	}
	wg.Wait()
	close(errChan)
	for err := range errChan {
		// any errors should be server-thrown revision errors
		if err != nil {
			assertRevisionError(t, err, "server")
		}
	}

	// and now a fetch should work from both users, confirming that neither
	// has a busted revision cache
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := handler1.GetKVEntry(ctx1, getArg)
	require.NoError(t, err)
	require.Equal(t, secretData, *getRes.EntryValue)
	getRes, err = handler2.GetKVEntry(ctx2, getArg)
	require.NoError(t, err)
	require.Equal(t, secretData, *getRes.EntryValue)
}
