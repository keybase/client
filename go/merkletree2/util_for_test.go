package merkletree2

import (
	"crypto/sha512"
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
	config1bit, err := NewConfig(IdentityHasherBlinded{}, true, 1, 1, 1, ConstructStringValueContainer)
	require.NoError(t, err)

	config2bits, err = NewConfig(IdentityHasherBlinded{}, true, 2, 1, 1, ConstructStringValueContainer)
	require.NoError(t, err)

	config3bits, err = NewConfig(IdentityHasherBlinded{}, true, 3, 1, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	return config1bit, config2bits, config3bits
}

func getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t *testing.T) (config1bit, config2bits, config3bits Config) {
	config1bit, err := NewConfig(IdentityHasher{}, false, 1, 1, 1, ConstructStringValueContainer)
	require.NoError(t, err)

	config2bits, err = NewConfig(IdentityHasher{}, false, 2, 1, 1, ConstructStringValueContainer)
	require.NoError(t, err)

	config3bits, err = NewConfig(IdentityHasher{}, false, 3, 1, 3, ConstructStringValueContainer)
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

func (i IdentityHasher) Encode(o interface{}) (dst []byte, err error) {
	return dst, i.EncodeTo(o, &dst)
}

func (i IdentityHasher) EncodeTo(o interface{}, out *[]byte) (err error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return err
	}
	*out = append((*out)[:0], enc...)
	return nil
}

func (i IdentityHasher) GetEncodingType() EncodingType {
	return EncodingTypeForTesting
}

func (i IdentityHasher) Decode(dest interface{}, src []byte) error {
	return msgpack.Decode(dest, src)
}

func (i IdentityHasher) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, _ KeySpecificSecret) (Hash, error) {
	return i.Encode(kevp)
}

func (i IdentityHasher) HashKeyEncodedValuePairWithKeySpecificSecretTo(kevp KeyEncodedValuePair, _ KeySpecificSecret, h *Hash) (err error) {
	*h, err = i.Encode(kevp)
	return err
}

func (i IdentityHasher) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := i.Encode(o)
	if err != nil {
		return nil, nil, fmt.Errorf("Encoding error in IdentityHasher for %v: %v", o, err)
	}
	return enc, Hash(enc), nil
}

func (i IdentityHasher) HashGeneric(o interface{}, h *Hash) (err error) {
	_, *h, err = i.EncodeAndHashGeneric(o)
	return err
}

func (i IdentityHasher) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := i.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return i.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

func (i IdentityHasher) GenerateMasterSecret(Seqno) (MasterSecret, error) {
	return nil, errors.New("Should not call GenerateMasterSecret on an unblinded hasher")
}

func (i IdentityHasher) ComputeKeySpecificSecret(ms MasterSecret, k Key) KeySpecificSecret {
	return nil
}

func (i IdentityHasher) ComputeKeySpecificSecretTo(ms MasterSecret, k Key, kss *KeySpecificSecret) {
}

// Useful to debug tests. Hash(b) == b, with extra blinding fields injected as appropriate
type IdentityHasherBlinded struct{}

var _ Encoder = IdentityHasherBlinded{}

func (i IdentityHasherBlinded) GetEncodingType() EncodingType {
	return EncodingTypeForTesting
}

func (i IdentityHasherBlinded) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return nil, nil, fmt.Errorf("Msgpack error in IdentityHasher for %v: %v", o, err)
	}
	return enc, Hash(enc), nil
}

func (i IdentityHasherBlinded) HashGeneric(o interface{}, h *Hash) (err error) {
	_, *h, err = i.EncodeAndHashGeneric(o)
	return err
}

func (i IdentityHasherBlinded) Encode(o interface{}) (dst []byte, err error) {
	return dst, i.EncodeTo(o, &dst)
}

func (i IdentityHasherBlinded) EncodeTo(o interface{}, out *[]byte) (err error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return err
	}
	*out = append((*out)[:0], enc...)
	return nil
}

func (i IdentityHasherBlinded) Decode(dest interface{}, src []byte) error {
	return msgpack.Decode(dest, src)
}

func (i IdentityHasherBlinded) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := i.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return i.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

func (i IdentityHasherBlinded) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, kss KeySpecificSecret) (Hash, error) {
	enc, err := i.Encode(struct {
		Kevp KeyEncodedValuePair
		Kss  KeySpecificSecret
	}{Kevp: kevp, Kss: kss})
	if err != nil {
		panic(err)
	}
	return Hash(enc), nil
}

func (i IdentityHasherBlinded) HashKeyEncodedValuePairWithKeySpecificSecretTo(kevp KeyEncodedValuePair, kss KeySpecificSecret, h *Hash) (err error) {
	*h, err = i.HashKeyEncodedValuePairWithKeySpecificSecret(kevp, kss)
	return err
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

func (i IdentityHasherBlinded) ComputeKeySpecificSecretTo(ms MasterSecret, k Key, kss *KeySpecificSecret) {
	var err error
	*kss, err = msgpack.EncodeCanonical(struct {
		Ms MasterSecret
		K  Key
	}{Ms: ms, K: k})
	if err != nil {
		panic(err)
	}
}

// returns two disjoint lists of sorted and unique keys of size numPairs1, numPairs2
func makeRandomKeysForTesting(keysByteLength uint, numPairs1, numPairs2 int) ([]Key, []Key, error) {
	numPairs := numPairs1 + numPairs2

	if keysByteLength < 8 && numPairs > 1<<(keysByteLength*8) {
		return nil, nil, fmt.Errorf("too many keys requested !")
	}

	keyMap := make(map[string]bool, numPairs)
	for len(keyMap) < numPairs {
		key := make([]byte, keysByteLength)
		_, err := rand.Read(key)
		if err != nil {
			return nil, nil, err
		}
		keyMap[string(key)] = true
	}

	keyStrings1 := make([]string, 0, numPairs1)
	keyStrings2 := make([]string, 0, numPairs2)

	i := 0
	for k := range keyMap {
		if i < numPairs1 {
			keyStrings1 = append(keyStrings1, k)
			i++
		} else {
			keyStrings2 = append(keyStrings2, k)
		}
	}

	sort.Strings(keyStrings1)
	sort.Strings(keyStrings2)

	keys1 := make([]Key, numPairs1)
	for i, k := range keyStrings1 {
		keys1[i] = Key(k)
	}

	keys2 := make([]Key, numPairs2)
	for i, k := range keyStrings2 {
		keys2[i] = Key(k)
	}

	return keys1, keys2, nil
}

func makeRandomKVPFromKeysForTesting(keys []Key) ([]KeyValuePair, error) {
	kvps := make([]KeyValuePair, len(keys))
	valBuffer := make([]byte, 10)
	for i, key := range keys {
		kvps[i].Key = key
		_, err := rand.Read(valBuffer)
		if err != nil {
			return nil, err
		}
		kvps[i].Value = string(valBuffer)
	}
	return kvps, nil
}

func ConstructStringValueContainer() interface{} {
	return ""
}

type SHA512_256Encoder struct{}

var _ Encoder = SHA512_256Encoder{}

func (e SHA512_256Encoder) GetEncodingType() EncodingType {
	return EncodingTypeForTesting
}

func (e SHA512_256Encoder) Encode(o interface{}) (dst []byte, err error) {
	return dst, e.EncodeTo(o, &dst)
}

func (e SHA512_256Encoder) EncodeTo(o interface{}, out *[]byte) (err error) {
	enc, err := msgpack.EncodeCanonical(o)
	if err != nil {
		return err
	}
	*out = append((*out)[:0], enc...)
	return nil
}

func (e SHA512_256Encoder) Decode(dest interface{}, src []byte) error {
	return msgpack.Decode(dest, src)
}

func (e SHA512_256Encoder) EncodeAndHashGeneric(o interface{}) ([]byte, Hash, error) {
	enc, err := e.Encode(o)
	if err != nil {
		return nil, nil, err
	}
	hasher := sha512.New512_256()
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, nil, err
	}
	return enc, hasher.Sum(nil), nil
}

func (e SHA512_256Encoder) HashGeneric(o interface{}, h *Hash) (err error) {
	_, *h, err = e.EncodeAndHashGeneric(o)
	return err
}

func (e SHA512_256Encoder) HashKeyValuePairWithKeySpecificSecret(kvp KeyValuePair, kss KeySpecificSecret) (Hash, error) {
	encVal, err := e.Encode(kvp.Value)
	if err != nil {
		return nil, err
	}
	return e.HashKeyEncodedValuePairWithKeySpecificSecret(KeyEncodedValuePair{Key: kvp.Key, Value: encVal}, kss)
}

func (e SHA512_256Encoder) HashKeyEncodedValuePairWithKeySpecificSecret(kevp KeyEncodedValuePair, kss KeySpecificSecret) (Hash, error) {
	if len(kss) > 0 {
		panic("This encoder does not support blinding with secrets.")
	}
	// TODO this double encoding is unnecessary. Consider removing.
	enc, err := e.Encode(kevp)
	if err != nil {
		return nil, err
	}
	hasher := sha512.New512_256()
	_, err = hasher.Write(enc)
	if err != nil {
		return nil, err
	}
	return hasher.Sum(nil), nil
}

func (e SHA512_256Encoder) HashKeyEncodedValuePairWithKeySpecificSecretTo(kevp KeyEncodedValuePair, kss KeySpecificSecret, h *Hash) (err error) {
	*h, err = e.HashKeyEncodedValuePairWithKeySpecificSecret(kevp, kss)
	return err
}

func (e SHA512_256Encoder) GenerateMasterSecret(_ Seqno) (MasterSecret, error) {
	return nil, fmt.Errorf("This encoder does not support blinding")
}

func (e SHA512_256Encoder) ComputeKeySpecificSecret(_ MasterSecret, _ Key) KeySpecificSecret {
	return nil
}

func (e SHA512_256Encoder) ComputeKeySpecificSecretTo(ms MasterSecret, k Key, kss *KeySpecificSecret) {
}
