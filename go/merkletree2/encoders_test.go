package merkletree2

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBlindedSHA512_256v1Encoder(t *testing.T) {
	encoder := BlindedSHA512_256v1Encoder{}

	hashLength := 32

	h, err := encoder.EncodeAndHashGeneric("pizza")
	require.NoError(t, err)
	require.Len(t, h, hashLength)

	h2, err := encoder.EncodeAndHashGeneric("pasta")
	require.NoError(t, err)
	require.Len(t, h, hashLength)
	require.NotEqual(t, h, h2)

	ms, err := encoder.GenerateMasterSecret(0)
	require.NoError(t, err)
	require.Len(t, ms, hashLength)

	ms2, err := encoder.GenerateMasterSecret(0)
	require.NoError(t, err)
	require.Len(t, ms2, hashLength)
	require.NotEqual(t, ms, ms2)

	ks := encoder.ComputeKeySpecificSecret(ms, Key([]byte{0x00, 0x01}))
	require.Len(t, ks, hashLength)
	ks2 := encoder.ComputeKeySpecificSecret(ms, Key([]byte{0x00, 0x01}))
	require.Len(t, ks, hashLength)
	require.Equal(t, ks, ks2)
	ks3 := encoder.ComputeKeySpecificSecret(ms, Key([]byte{0x00, 0x02}))
	require.Len(t, ks3, hashLength)
	require.NotEqual(t, ks, ks3)

	h, err = encoder.HashKeyValuePairWithKeySpecificSecret(KeyValuePair{Key: Key([]byte{0x00, 0x01}), Value: "pizza"}, ks)
	require.NoError(t, err)
	require.Len(t, h, hashLength)

	h2, err = encoder.HashKeyValuePairWithKeySpecificSecret(KeyValuePair{Key: Key([]byte{0x00, 0x01}), Value: "pizza"}, ks)
	require.NoError(t, err)
	require.Len(t, h2, hashLength)
	require.Equal(t, h, h2)

	h3, err := encoder.HashKeyValuePairWithKeySpecificSecret(KeyValuePair{Key: Key([]byte{0x00, 0x01}), Value: "pizza"}, ks3)
	require.NoError(t, err)
	require.Len(t, h3, hashLength)
	require.NotEqual(t, h, h3)

	h4, err := encoder.HashKeyValuePairWithKeySpecificSecret(KeyValuePair{Key: Key([]byte{0x00, 0x02}), Value: "pizza"}, ks)
	require.NoError(t, err)
	require.Len(t, h4, hashLength)
	require.NotEqual(t, h, h3)
}
