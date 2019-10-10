package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
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
	require.Equal(t, "", getRes.EntryValue)
	require.Equal(t, 0, getRes.Revision)

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

	// another user cannot see or edit this entry
	tcEve := kvTestSetup(t)
	defer tcEve.Cleanup()
	_, err = kbtest.CreateAndSignupFakeUser("kvs", tcEve.G)
	require.NoError(t, err)
	eveHandler := NewKVStoreHandler(nil, tcEve.G)
	getRes, err = eveHandler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, teams.PrecheckAppendError{}, err)
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
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
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache = tc.G.GetKVRevisionCache()
	err = revCache.PutCheck(mctx, entryID, entryHash, generation, 2)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.Error(t, err)
	require.IsType(t, kvstore.KVRevisionCacheError{}, err)
	require.Contains(t, err.Error(), "revision")

	// bump the team key generation and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache = tc.G.GetKVRevisionCache()
	err = revCache.PutCheck(mctx, entryID, entryHash, keybase1.PerTeamKeyGeneration(2), revision)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.Error(t, err)
	require.IsType(t, kvstore.KVRevisionCacheError{}, err)
	require.Contains(t, err.Error(), "team key generation")

	// mutate the entry hash and verify error
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache = tc.G.GetKVRevisionCache()
	err = revCache.PutCheck(mctx, entryID, "this-is-wrong", generation, revision)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.Error(t, err)
	require.IsType(t, kvstore.KVRevisionCacheError{}, err)
	require.Contains(t, err.Error(), "hash of entry")

	// verify that it does not error with the right things in the cache
	tc.G.SetKVRevisionCache(kvstore.NewKVRevisionCache(tc.G))
	revCache = tc.G.GetKVRevisionCache()
	err = revCache.PutCheck(mctx, entryID, entryHash, generation, revision)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(mctx.Ctx(), getArg)
	require.NoError(t, err)
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

func TestEncryptionAndVerification(t *testing.T) {
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
	require.Equal(t, secretData, getRes.EntryValue)
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
	_, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
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
			randBytes, err := libkb.RandBytes(16)
			require.NoError(t, err)
			box.N = randBytes
			packed, err := msgpack.Encode(box)
			require.NoError(t, err)
			return base64.StdEncoding.EncodeToString(packed)
		},
	}
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	_, err = handler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, signencrypt.Error{}, err)
	require.Equal(t, err.(signencrypt.Error).Type, signencrypt.BadSecretbox)
	t.Logf("cannot decrypt with the wrong nonce")
	// push and fetch another entry to verify that the nonce changed
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
	require.NotEqual(t, firstNonce, secondNonce)
	t.Logf("two puts with identical data and keys use different nonces")
}
