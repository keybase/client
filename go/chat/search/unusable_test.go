package search

import (
	"context"
	"errors"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestUnusableSearchTokenClearsConvIndex(t *testing.T) {
	tc := externalstest.SetupTest(t, "search-unusable", 2)
	defer tc.Cleanup()
	ctx := context.TODO()
	uid := gregor1.UID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
	convID := chat1.ConversationID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})
	g := globals.NewContext(tc.G, &globals.ChatContext{})

	var key [32]byte
	key[0] = 1
	var keyErr error
	keyFn := func(context.Context) ([32]byte, error) {
		if keyErr != nil {
			return [32]byte{}, keyErr
		}
		return key, nil
	}
	edb := encrypteddb.New(tc.G, func(*libkb.GlobalContext) *libkb.JSONLocalDb {
		return tc.G.LocalChatDb
	}, keyFn)
	disk := newDiskStore(g, uid, keyFn, edb, tc.G.LocalChatDb)
	s := newStore(g, uid)
	s.diskStorage = disk

	md := newIndexMetadata()
	md.SeenIDs[3] = chat1.EmptyStruct{}
	require.NoError(t, disk.PutMetadata(ctx, convID, md))
	// The lookup key is an HMAC of the token under the current device key, so
	// plant a box at that key which this key cannot open.
	lookup, err := tokenKey(ctx, uid, convID, "hello", keyFn)
	require.NoError(t, err)
	var other [32]byte
	other[0] = 9
	sealed, err := encrypteddb.EncodeBox(ctx, newTokenEntry(), func(context.Context) ([32]byte, error) {
		return other, nil
	})
	require.NoError(t, err)
	require.NoError(t, tc.G.LocalChatDb.PutRaw(lookup, sealed))

	hits, err := s.GetHits(ctx, convID, "hello")
	require.NoError(t, err)
	require.Empty(t, hits)
	got, err := disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.Nil(t, got, "an unreadable token drops the conv index so it can be rebuilt")
	onDisk, err := disk.GetTokenEntry(ctx, convID, "hello")
	require.NoError(t, err)
	require.Nil(t, onDisk)

	te := newTokenEntry()
	te.MsgIDs[3] = chat1.EmptyStruct{}
	require.NoError(t, disk.PutTokenEntry(ctx, convID, "hello", te))
	require.NoError(t, disk.PutMetadata(ctx, convID, md))
	keyErr = errors.New("key unavailable")
	_, err = s.GetHits(ctx, convID, "hello")
	require.Error(t, err)
	got, err = disk.GetMetadata(ctx, convID)
	require.NoError(t, err)
	require.NotNil(t, got, "a key-fetch failure must not clear the conv index")
	require.Contains(t, got.SeenIDs, chat1.MessageID(3))
}
