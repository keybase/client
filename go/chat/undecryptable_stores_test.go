package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
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

func TestArchiveRegistryUndecodableIsKept(t *testing.T) {
	ctc, _ := setupChatTest(t, "archiveundecodable")
	defer ctc.Cleanup()
	ctx := context.TODO()
	g := ctc.Context()
	var key [32]byte

	newer, err := libkb.MPackEncode(struct {
		V int
		N [24]byte
		E []byte
	}{V: 2, E: []byte("sealed-by-newer-client")})
	require.NoError(t, err)
	for _, tc := range []struct {
		name   string
		stored []byte
		want   error
	}{
		{name: "newer crypto version", stored: newer, want: encrypteddb.ErrUnsupportedVersion},
		{name: "undecodable", stored: []byte("not a box"), want: encrypteddb.ErrUndecodable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := NewChatArchiveRegistry(g, nil)
			r.edb = testEncryptedDB(g, &key)
			r.uid = gregor1.UID(libkb.UsernameToUID("testuser").ToBytes())
			r.started = true
			require.NoError(t, g.LocalChatDb.PutRaw(r.dbKey(), tc.stored))

			_, err := r.List(ctx)
			require.ErrorIs(t, err, tc.want)
			stored, found, err := g.LocalChatDb.GetRaw(r.dbKey())
			require.NoError(t, err)
			require.True(t, found, "job history a newer client may read must be kept")
			require.Equal(t, tc.stored, stored)
		})
	}
}

type statusErrUploader struct {
	types.AttachmentUploader
	err error
}

func (u statusErrUploader) Status(context.Context, chat1.OutboxID) (types.AttachmentUploaderTaskStatus, types.AttachmentUploadResult, error) {
	return 0, types.AttachmentUploadResult{}, u.err
}

func TestDelivererUnreadableUploadStatusIsPermanent(t *testing.T) {
	ctc, _ := setupChatTest(t, "unreadableuploadstatus")
	defer ctc.Cleanup()
	ctx := context.TODO()
	g := ctc.Context()
	var key [32]byte
	keyFn := func(context.Context) ([32]byte, error) { return key, nil }

	sealed, err := encrypteddb.EncodeBox(ctx, "status", keyFn)
	require.NoError(t, err)
	newer, err := libkb.MPackEncode(struct {
		V int
		N [24]byte
		E []byte
	}{V: 2, E: []byte("sealed-by-newer-client")})
	require.NoError(t, err)
	decodeErr := func(stored []byte, k byte) error {
		key[0] = k
		var res string
		return encrypteddb.DecodeBox(ctx, stored, keyFn, &res)
	}

	realUploader := g.AttachmentUploader
	defer func() { g.AttachmentUploader = realUploader }()
	d := &Deliverer{Contextified: globals.NewContextified(g)}
	obr := chat1.OutboxRecord{Msg: chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{MessageType: chat1.MessageType_ATTACHMENT},
	}}
	for _, tc := range []struct {
		name string
		err  error
		perm bool
	}{
		{name: "undecryptable", err: decodeErr(sealed, 1), perm: true},
		{name: "torn", err: decodeErr(sealed[:len(sealed)/2], 0), perm: true},
		{name: "newer crypto version", err: decodeErr(newer, 0), perm: true},
		{name: "key fetch error", err: libkb.KeyCannotDecryptError{}, perm: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			g.AttachmentUploader = statusErrUploader{err: tc.err}
			_, err := d.processAttachment(ctx, obr)
			var uerr AttachmentUploadError
			require.ErrorAs(t, err, &uerr)
			require.Equal(t, tc.perm, uerr.Perm, "status error: %v", tc.err)
		})
	}
}
