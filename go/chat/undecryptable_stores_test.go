package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func testEncryptedDB(g *globals.Context, key *[32]byte) *encrypteddb.EncryptedDB {
	return encrypteddb.New(g.ExternalG(),
		func(g *libkb.GlobalContext) *libkb.JSONLocalDb { return g.LocalChatDb },
		func(context.Context) ([32]byte, error) { return *key, nil })
}

func TestEmojiAliasLookupUndecryptableIsMiss(t *testing.T) {
	ctc, _ := setupChatTest(t, "emojiundecrypt")
	defer ctc.Cleanup()
	ctx := context.TODO()
	g := ctc.Context()
	uid := gregor1.UID(libkb.UsernameToUID("testuser").ToBytes())
	var key [32]byte
	key[0] = 1

	newSource := func() *DevConvEmojiSource {
		s := NewDevConvEmojiSource(g, nil)
		s.encryptedDB = testEncryptedDB(g, &key)
		return s
	}
	written := map[string]chat1.Emoji{"party": {Alias: "party"}}
	require.NoError(t, newSource().putAliasLookup(ctx, uid, written, chat1.EmojiFetchOpts{}))

	key[0] = 2
	res, err := newSource().getAliasLookup(ctx, uid)
	require.NoError(t, err)
	require.Empty(t, res)
	_, found, err := g.LocalChatDb.GetRaw(newSource().dbKey(uid))
	require.NoError(t, err)
	require.False(t, found, "undecryptable alias lookup must be deleted")

	require.NoError(t, newSource().putAliasLookup(ctx, uid, written, chat1.EmojiFetchOpts{}))
	res, err = newSource().getAliasLookup(ctx, uid)
	require.NoError(t, err)
	require.Equal(t, written, res)
}

func TestArchiveRegistryUndecryptableIsMiss(t *testing.T) {
	ctc, _ := setupChatTest(t, "archiveundecrypt")
	defer ctc.Cleanup()
	ctx := context.TODO()
	g := ctc.Context()
	uid := gregor1.UID(libkb.UsernameToUID("testuser").ToBytes())
	var key [32]byte
	key[0] = 1

	newRegistry := func() *ChatArchiveRegistry {
		r := NewChatArchiveRegistry(g, nil)
		r.edb = testEncryptedDB(g, &key)
		r.uid = uid
		r.started = true
		return r
	}
	job := chat1.ArchiveChatJob{
		Request: chat1.ArchiveChatJobRequest{JobID: "job1"},
		Status:  chat1.ArchiveChatJobStatus_COMPLETE,
	}
	r := newRegistry()
	require.NoError(t, r.Set(ctx, nil, job))
	require.NoError(t, r.flushLocked(ctx))

	key[0] = 2
	r = newRegistry()
	list, err := r.List(ctx)
	require.NoError(t, err)
	require.Empty(t, list.Jobs)
	_, found, err := g.LocalChatDb.GetRaw(r.dbKey())
	require.NoError(t, err)
	require.False(t, found, "undecryptable archive registry must be deleted")

	require.NoError(t, r.Set(ctx, nil, job))
	require.NoError(t, r.flushLocked(ctx))
	got, err := newRegistry().Get(ctx, "job1")
	require.NoError(t, err)
	require.Equal(t, job.Request.JobID, got.Request.JobID)
}
