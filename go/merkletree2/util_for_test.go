package merkletree2

import (
	"errors"
	"fmt"
	"math/big"
	"math/rand"
	"sort"
	"strconv"
	"testing"

	"github.com/keybase/client/go/msgpack"

	"github.com/stretchr/testify/require"
)

func makePositionFromStringForTesting(s string) (Position, error) {
	posInt, err := strconv.ParseInt(s, 2, 64)
	if err != nil {
		return Position{}, err
	}
	return (Position)(*big.NewInt(posInt)), nil
}

func getTreeCfgsWith1_2_3BitsPerIndexBlinded(t *testing.T) (config1bit, config2bits, config3bits Config) {
	config1bit, err := NewConfig(IdentityHasherBlinded{}, true, 1, 1, 1)
	require.NoError(t, err)

	config2bits, err = NewConfig(IdentityHasherBlinded{}, true, 2, 1, 1)
	require.NoError(t, err)

	config3bits, err = NewConfig(IdentityHasherBlinded{}, true, 3, 1, 3)
	require.NoError(t, err)

	return config1bit, config2bits, config3bits
}

func getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t *testing.T) (config1bit, config2bits, config3bits Config) {
	config1bit, err := NewConfig(IdentityHasher{}, false, 1, 1, 1)
	require.NoError(t, err)

	config2bits, err = NewConfig(IdentityHasher{}, false, 2, 1, 1)
	require.NoError(t, err)

	config3bits, err = NewConfig(IdentityHasher{}, false, 3, 1, 3)
	require.NoError(t, err)

	return config1bit, config2bits, config3bits
}

func getSampleKVPS3bits() (kvps1, kvps2, kvps3 []KeyValuePair) {
	kvps1 = []KeyValuePair{
		{Key: []byte{0x00, 0x00, 0x00}, Value: "key0x000000Seqno1"},
		{Key: []byte{0x00, 0x00, 0x01}, Value: "key0x000001Seqno1"},
		{Key: []byte{0x00, 0x10, 0x00}, Value: "key0x001000Seqno1"},
		{Key: []byte{0xff, 0xff, 0xff}, Value: "key0xffffffSeqno1"},
	}

	kvps2 = []KeyValuePair{
		{Key: []byte{0x00, 0x00, 0x00}, Value: "key0x000000Seqno2"},
		{Key: []byte{0x00, 0x00, 0x01}, Value: "key0x000001Seqno2"},
		{Key: []byte{0x00, 0x10, 0x00}, Value: "key0x001000Seqno2"},
		{Key: []byte{0xff, 0xff, 0xfe}, Value: "key0xfffffeSeqno2"},
		{Key: []byte{0xff, 0xff, 0xff}, Value: "key0xffffffSeqno2"},
	}

	kvps3 = []KeyValuePair{
		{Key: []byte{0x00, 0x00, 0x00}, Value: "key0x000000Seqno3"},
		{Key: []byte{0x00, 0x00, 0x01}, Value: "key0x000001Seqno3"},
		{Key: []byte{0x00, 0x10, 0x00}, Value: "key0x001000Seqno3"},
		{Key: []byte{0xff, 0xff, 0xfd}, Value: "key0xfffffdSeqno3"},
		{Key: []byte{0xff, 0xff, 0xfe}, Value: "key0xfffffeSeqno3"},
		{Key: []byte{0xff, 0xff, 0xff}, Value: "key0xffffffSeqno3"},
	}
	return kvps1, kvps2, kvps3
}

func getSampleKVPS1bit() (kvps1, kvps2, kvps3 []KeyValuePair) {
	kvps1 = []KeyValuePair{
		{Key: []byte{0x00}, Value: "key0x00Seqno1"},
		{Key: []byte{0x01}, Value: "key0x01Seqno1"},
		{Key: []byte{0x10}, Value: "key0x10Seqno1"},
		{Key: []byte{0xff}, Value: "key0xffSeqno1"}}

	kvps2 = []KeyValuePair{
		{Key: []byte{0x00}, Value: "key0x00Seqno2"},
		{Key: []byte{0x01}, Value: "key0x01Seqno2"},
		{Key: []byte{0x10}, Value: "key0x10Seqno2"},
		{Key: []byte{0xfe}, Value: "key0xfeSeqno2"},
		{Key: []byte{0xff}, Value: "key0xffSeqno2"},
	}

	kvps3 = []KeyValuePair{
		{Key: []byte{0x00}, Value: "key0x00Seqno3"},
		{Key: []byte{0x01}, Value: "key0x01Seqno3"},
		{Key: []byte{0x10}, Value: "key0x10Seqno3"},
		{Key: []byte{0xfd}, Value: "key0xfdSeqno3"},
		{Key: []byte{0xfe}, Value: "key0xfeSeqno3"},
		{Key: []byte{0xff}, Value: "key0xffSeqno3"},
	}

	return kvps1, kvps2, kvps3
}

// Useful to debug tests. Hash(b) == b
type IdentityHasher struct{}

var _ Encoder = IdentityHasher{}

func (i IdentityHasher) EncodeAndHashGeneric(o interface{}) (Hash, error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return nil, fmt.Errorf("Msgpack error in IdentityHasher for %v: %v", o, err)
	}
	return Hash(enc), nil
}

func (i IdentityHasher) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	return i.EncodeAndHashGeneric(kvp)
}

func (i IdentityHasher) GenerateMasterSecret(Seqno) (MasterSecret, error) {
	return nil, errors.New("Should not call GenerateMasterSecret on an unblinded hasher")
}

func (i IdentityHasher) ComputeKeySpecificSecret(ms MasterSecret, k Key) KeySpecificSecret {
	return nil
}

// Useful to debug tests. Hash(b) == b, with extra blinding fields injected as appropriate
type IdentityHasherBlinded struct{}

var _ Encoder = IdentityHasherBlinded{}

func (i IdentityHasherBlinded) EncodeAndHashGeneric(o interface{}) (Hash, error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return nil, fmt.Errorf("Msgpack error in IdentityHasher for %v: %v", o, err)
	}
	return Hash(enc), nil
}

func (i IdentityHasherBlinded) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	enc, err := msgpack.EncodeCanonical(struct {
		Kvp KeyValuePair
		Kss KeySpecificSecret
	}{Kvp: kvp, Kss: kss})
	if err != nil {
		panic(err)
	}
	return Hash(enc), nil

}

func (i IdentityHasherBlinded) GenerateMasterSecret(Seqno) (MasterSecret, error) {
	ms := make([]byte, 1)
	_, err := rand.Read(ms)
	return MasterSecret(ms), err
}

func (i IdentityHasherBlinded) ComputeKeySpecificSecret(ms MasterSecret, k Key) KeySpecificSecret {
	kss, err := msgpack.EncodeCanonical(struct {
		Ms MasterSecret
		K  Key
	}{Ms: ms, K: k})
	if err != nil {
		panic(err)
	}
	return KeySpecificSecret(kss)
}

// returns a list of sorted and unique keys of size numPairs
func makeRandomKeysForTesting(keysByteLength uint, numPairs int) ([]Key, error) {
	if keysByteLength < 8 && numPairs > 1<<(keysByteLength*8) {
		return nil, fmt.Errorf("too many keys requested !")
	}

	keyMap := make(map[string]bool, numPairs)
	for len(keyMap) < numPairs {
		key := make([]byte, keysByteLength)
		_, err := rand.Read(key)
		if err != nil {
			return nil, err
		}
		keyMap[string(key)] = true
	}

	keyStrings := make([]string, 0, numPairs)

	for k := range keyMap {
		keyStrings = append(keyStrings, k)
	}

	sort.Strings(keyStrings)

	keys := make([]Key, numPairs)
	for i, k := range keyStrings {
		keys[i] = Key(k)
	}

	return keys, nil
}

func makeRandomKVPFromKeysForTesting(keys []Key) ([]KeyValuePair, error) {
	kvps := make([]KeyValuePair, len(keys))
	for i, key := range keys {
		kvps[i].Key = key
		kvps[i].Value = make([]byte, 10)
		_, err := rand.Read(kvps[i].Value.([]byte))
		if err != nil {
			return nil, err
		}
	}
	return kvps, nil
}
