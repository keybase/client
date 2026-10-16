package encrypteddb

import (
	"context"
	"errors"
	"testing"

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

	err = DecodeBox(ctx, []byte("not-a-box"), keyA, &res)
	require.ErrorIs(t, err, ErrUndecodable)
	require.NotErrorIs(t, err, ErrDecryptionFailed)

	var wrongType map[string]int
	err = DecodeBox(ctx, boxed, keyA, &wrongType)
	require.ErrorIs(t, err, ErrUndecodable)

	err = DecodeBox(ctx, boxed, keyFails, &res)
	require.ErrorIs(t, err, keyErr)
	require.NotErrorIs(t, err, ErrDecryptionFailed)
	require.NotErrorIs(t, err, ErrUndecodable)
}
