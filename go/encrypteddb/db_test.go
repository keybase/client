package encrypteddb

import (
	"context"
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestDecodeBoxErrorClasses(t *testing.T) {
	ctx := context.TODO()
	keyA := func(context.Context) ([32]byte, error) { return [32]byte{1}, nil }
	keyB := func(context.Context) ([32]byte, error) { return [32]byte{2}, nil }
	keyErr := errors.New("key unavailable")
	keyFails := func(context.Context) ([32]byte, error) { return [32]byte{}, keyErr }

	boxed, err := EncodeBox(ctx, "hello", keyA)
	require.NoError(t, err)

	var res string
	require.NoError(t, DecodeBox(ctx, boxed, keyA, &res))
	require.Equal(t, "hello", res)

	err = DecodeBox(ctx, boxed, keyB, &res)
	require.ErrorIs(t, err, ErrDecryptionFailed)
	require.NotErrorIs(t, err, ErrUndecodable)
	require.True(t, IsUnusableData(err))

	err = DecodeBox(ctx, []byte("not-a-box"), keyA, &res)
	require.ErrorIs(t, err, ErrUndecodable)
	require.NotErrorIs(t, err, ErrDecryptionFailed)
	require.True(t, IsUnusableData(err))

	var wrongType map[string]int
	err = DecodeBox(ctx, boxed, keyA, &wrongType)
	require.ErrorIs(t, err, ErrUndecodable)

	newer, err := libkb.MPackEncode(boxedData{V: cryptoVersion + 1})
	require.NoError(t, err)
	err = DecodeBox(ctx, newer, keyA, &res)
	require.ErrorIs(t, err, ErrUnsupportedVersion)
	require.NotErrorIs(t, err, ErrUndecodable)
	require.True(t, IsUnusableData(err))

	err = DecodeBox(ctx, boxed, keyFails, &res)
	require.ErrorIs(t, err, keyErr)
	require.NotErrorIs(t, err, ErrDecryptionFailed)
	require.NotErrorIs(t, err, ErrUndecodable)
	require.NotErrorIs(t, err, ErrUnsupportedVersion)
	require.False(t, IsUnusableData(err))
}

func TestGetOrDropUnusable(t *testing.T) {
	tc := libkb.SetupTest(t, "get-or-drop", 0)
	defer tc.Cleanup()
	ctx := context.TODO()
	var key [32]byte
	key[0] = 1
	var keyErr error
	keyFn := func(context.Context) ([32]byte, error) {
		if keyErr != nil {
			return [32]byte{}, keyErr
		}
		return key, nil
	}
	edb := New(tc.G, func(*libkb.GlobalContext) *libkb.JSONLocalDb { return tc.G.LocalChatDb }, keyFn)
	dbKey := libkb.DbKey{Typ: libkb.DBChatInbox, Key: "drop-unusable"}
	require.NoError(t, edb.Put(ctx, dbKey, "hello"))

	key[0] = 2
	var got string
	found, err := edb.GetOrDropUnusable(ctx, dbKey, &got)
	require.NoError(t, err)
	require.False(t, found)
	_, found, err = tc.G.LocalChatDb.GetRaw(dbKey)
	require.NoError(t, err)
	require.False(t, found, "unusable bytes are deleted")

	key[0] = 1
	require.NoError(t, edb.Put(ctx, dbKey, "hello"))
	keyErr = errors.New("key unavailable")
	found, err = edb.GetOrDropUnusable(ctx, dbKey, &got)
	require.ErrorIs(t, err, keyErr)
	require.False(t, found)
	_, found, err = tc.G.LocalChatDb.GetRaw(dbKey)
	require.NoError(t, err)
	require.True(t, found, "a key-fetch failure must leave the value in place")
}
