package merkletree2

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
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

func (i IdentityHasher) HashKeyValuePairWithMasterSecret(kvp KeyValuePair, ms MasterSecret) (Hash, error) {
	return i.EncodeAndHashGeneric(kvp)
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

func (i IdentityHasherBlinded) HashKeyValuePairWithMasterSecret(kvp KeyValuePair, ms MasterSecret) (Hash, error) {
	kss := i.ComputeKeySpecificSecret(ms, kvp.Key)
	return i.HashKeyValuePairWithKeySpecificSecret(kvp, kss)
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
