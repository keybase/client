package merkletree2

import (
	"crypto/sha512"
	"math/big"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func makePositionFromStringForTesting(s string) (Position, error) {
	posInt, err := strconv.ParseInt(s, 2, 64)
	if err != nil {
		return Position{}, err
	}
	return (Position)(*big.NewInt(posInt)), nil
}

func getTreeCfgsWith1_2_3BitsPerIndex(t *testing.T) (config1bit, config2bits, config3bits TreeConfig) {
	config1bit, err := NewConfig(SHA512Hasher{}, 1, 1, 1)
	require.NoError(t, err)

	config2bits, err = NewConfig(SHA512Hasher{}, 2, 1, 1)
	require.NoError(t, err)

	config3bits, err = NewConfig(SHA512Hasher{}, 3, 1, 3)
	require.NoError(t, err)

	return config1bit, config2bits, config3bits
}

func getSampleKVPS3bits() (kvps1, kvps2, kvps3 []KeyValuePair) {
	kvps1 = []KeyValuePair{
		KeyValuePair{Key: []byte{0x00, 0x00, 0x00}, Value: "key0x000000Seqno1"},
		KeyValuePair{Key: []byte{0x00, 0x00, 0x01}, Value: "key0x000001Seqno1"},
		KeyValuePair{Key: []byte{0x00, 0x10, 0x00}, Value: "key0x001000Seqno1"},
		KeyValuePair{Key: []byte{0xff, 0xff, 0xff}, Value: "key0xffffffSeqno1"}}

	kvps2 = []KeyValuePair{
		KeyValuePair{Key: []byte{0x00, 0x00, 0x00}, Value: "key0x000000Seqno2"},
		KeyValuePair{Key: []byte{0x00, 0x00, 0x01}, Value: "key0x000001Seqno2"},
		KeyValuePair{Key: []byte{0x00, 0x10, 0x00}, Value: "key0x001000Seqno2"},
		KeyValuePair{Key: []byte{0xff, 0xff, 0xff}, Value: "key0xffffffSeqno2"}}

	kvps3 = []KeyValuePair{
		KeyValuePair{Key: []byte{0x00, 0x00, 0x00}, Value: "key0x000000Seqno3"},
		KeyValuePair{Key: []byte{0x00, 0x00, 0x01}, Value: "key0x000001Seqno3"},
		KeyValuePair{Key: []byte{0x00, 0x10, 0x00}, Value: "key0x001000Seqno3"},
		KeyValuePair{Key: []byte{0xff, 0xff, 0xff}, Value: "key0xffffffSeqno3"}}
	return kvps1, kvps2, kvps3
}

func getSampleKVPS1bit() (kvps1, kvps2, kvps3 []KeyValuePair) {
	kvps1 = []KeyValuePair{
		KeyValuePair{Key: []byte{0x00}, Value: "key0x00Seqno1"},
		KeyValuePair{Key: []byte{0x01}, Value: "key0x01Seqno1"},
		KeyValuePair{Key: []byte{0x10}, Value: "key0x10Seqno1"},
		KeyValuePair{Key: []byte{0xff}, Value: "key0xffSeqno1"}}

	kvps2 = []KeyValuePair{
		KeyValuePair{Key: []byte{0x00}, Value: "key0x00Seqno2"},
		KeyValuePair{Key: []byte{0x01}, Value: "key0x01Seqno2"},
		KeyValuePair{Key: []byte{0x10}, Value: "key0x10Seqno2"},
		KeyValuePair{Key: []byte{0xff}, Value: "key0xffSeqno2"}}

	kvps3 = []KeyValuePair{
		KeyValuePair{Key: []byte{0x00}, Value: "key0x00Seqno3"},
		KeyValuePair{Key: []byte{0x01}, Value: "key0x01Seqno3"},
		KeyValuePair{Key: []byte{0x10}, Value: "key0x10Seqno3"},
		KeyValuePair{Key: []byte{0xff}, Value: "key0xffSeqno3"}}
	return kvps1, kvps2, kvps3
}

// SHA512Hasher is a simple SHA512 hash function application
type SHA512Hasher struct{}

// Hash the data
func (s SHA512Hasher) Hash(b []byte) Hash {
	tmp := sha512.Sum512(b)
	return Hash(tmp[:])
}

// Useful to debug tests. Hash(b) == b
type IdentityHasher struct{}

// Hash(b) == b
func (i IdentityHasher) Hash(b []byte) Hash {
	return Hash(append(b[:0:0], b...))
}
