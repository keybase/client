package merkletree2

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math/rand"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/msgpack"

	"github.com/stretchr/testify/require"
)

func TestEmptyTree(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2

	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	tests := []struct {
		cfg   Config
		kvps1 []KeyValuePair
		kvps2 []KeyValuePair
	}{
		{config1bitU, kvps1_1bit, kvps2_1bit},
		{config2bitsU, kvps1_1bit, kvps2_1bit},
		{config3bitsU, kvps1_3bits, kvps2_3bits},
		{config1bitB, kvps1_1bit, kvps2_1bit},
		{config2bitsB, kvps1_1bit, kvps2_1bit},
		{config3bitsB, kvps1_3bits, kvps2_3bits},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)

			seq, root, hash, err := tree.GetLatestRoot(NewLoggerContextTodoForTesting(t), nil)
			require.Error(t, err)
			require.IsType(t, NoLatestRootFoundError{}, err)
			require.Equal(t, Seqno(0), seq, "Tree should have Seqno 0 as no insertions were made, got %v instead", seq)
			require.Nil(t, root.BareRootHash, "Tree root should not have a bareRootHash as no insertions were made")
			require.Nil(t, hash, "Tree root should not have a root hash as no insertions were made")

			for _, kvp := range test.kvps1 {
				_, err := tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				_, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}

			// building a tree without keys should succeed.
			s, _, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, nil, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s)
		})
	}

}

func TestBuildTreeAndGetKeyValuePair(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	tests := []struct {
		cfg   Config
		kvps1 []KeyValuePair
		kvps2 []KeyValuePair
	}{
		{config1bitU, kvps1_1bit, kvps2_1bit},
		{config2bitsU, kvps1_1bit, kvps2_1bit},
		{config3bitsU, kvps1_3bits, kvps2_3bits},
		{config1bitB, kvps1_1bit, kvps2_1bit},
		{config2bitsB, kvps1_1bit, kvps2_1bit},
		{config3bitsB, kvps1_3bits, kvps2_3bits},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)

			// This kvp has a key which is not part of test.kvps1
			kvpAddedAtSeqno2 := test.kvps2[len(test.kvps2)-2]

			_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 0, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 0, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)

			_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			_, _, err = tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps1, nil)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				_, err := tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err := tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				kvpRet, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)

				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}

			_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			_, _, err = tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps2, nil)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				kvpRet, err := tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)

				kvpRet, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Value, kvpRet.Value)
			}

			_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			for _, kvp := range test.kvps2 {
				_, err := tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err := tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 2, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				kvpRet, err = tree.GetKeyValuePairUnsafe(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)

				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 2, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}
		})
	}

}

func TestBuildTreeAndGetKeyValuePairWithProof(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	tests := []struct {
		cfg   Config
		kvps1 []KeyValuePair
		kvps2 []KeyValuePair
	}{
		{config1bitU, kvps1_1bit, kvps2_1bit},
		{config2bitsU, kvps1_1bit, kvps2_1bit},
		{config3bitsU, kvps1_3bits, kvps2_3bits},
		{config1bitB, kvps1_1bit, kvps2_1bit},
		{config2bitsB, kvps1_1bit, kvps2_1bit},
		{config3bitsB, kvps1_3bits, kvps2_3bits},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)

			// This kvp has a key which is not part of test.kvps1
			kvpAddedAtSeqno2 := test.kvps2[len(test.kvps2)-2]

			_, _, err = tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 0, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)

			_, _, err = tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)

			_, _, err = tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps1, nil)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				_, _, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, _, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}

			_, _, err = tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			_, _, err = tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps2, nil)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				kvpRet, _, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
			}
			_, _, err = tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			for _, kvp := range test.kvps2 {
				_, _, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, _, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 2, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(NewLoggerContextTodoForTesting(t), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}
		})
	}
}

func TestHonestMerkleProofsVerifySuccesfully(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	tests := []struct {
		cfg   Config
		kvps1 []KeyValuePair
		kvps2 []KeyValuePair
	}{
		{config1bitU, kvps1_1bit, kvps2_1bit},
		{config2bitsU, kvps1_1bit, kvps2_1bit},
		{config3bitsU, kvps1_3bits, kvps2_3bits},
		{config3bits2valsPerLeafU, kvps1_3bits, kvps2_3bits},
		{config1bitB, kvps1_1bit, kvps2_1bit},
		{config2bitsB, kvps1_1bit, kvps2_1bit},
		{config3bitsB, kvps1_3bits, kvps2_3bits},
		{config3bits2valsPerLeafB, kvps1_3bits, kvps2_3bits},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps1[:len(test.kvps1)-1], nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			for _, kvp := range test.kvps1[:len(test.kvps1)-1] {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.True(t, kvp.Key.Equal(kvpRet.Key))
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash1))
			}
			// test absence proofs
			kvp := test.kvps1[len(test.kvps1)-1]
			eVal, proof, err := tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash1, kvp.Key)
			require.NoError(t, err)
			require.Nil(t, eVal)
			require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), kvp.Key, &proof, rootHash1))

			s2, rootHash2, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps2[:len(test.kvps2)-1], nil)
			require.NoError(t, err)
			require.EqualValues(t, 2, s2)

			for _, kvp := range test.kvps2[:len(test.kvps2)-1] {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 2, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash2))
			}
			// test absence proofs
			kvp = test.kvps2[len(test.kvps2)-1]
			eVal, proof, err = tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash2, kvp.Key)
			require.NoError(t, err)
			require.Nil(t, eVal)
			require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), kvp.Key, &proof, rootHash2))

			for _, kvp := range test.kvps1[:len(test.kvps1)-1] {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.True(t, kvp.Key.Equal(kvpRet.Key))
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash1))
			}
			// test absence proofs
			kvp = test.kvps1[len(test.kvps1)-1]
			eVal, proof, err = tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash1, kvp.Key)
			require.NoError(t, err)
			require.Nil(t, eVal)
			require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), kvp.Key, &proof, rootHash1))

		})
	}

}

func TestHonestMerkleProofsVerifySuccesfullyLargeTree(t *testing.T) {
	blindedBinaryTreeConfig, err := NewConfig(NewBlindedSHA512_256v1Encoder(), true, 1, 1, 32, ConstructStringValueContainer)
	require.NoError(t, err)

	unblindedBinaryTreeConfig, err := NewConfig(SHA512_256Encoder{}, false, 1, 1, 32, ConstructStringValueContainer)
	require.NoError(t, err)

	blinded16aryTreeConfig, err := NewConfig(NewBlindedSHA512_256v1Encoder(), true, 4, 4, 32, ConstructStringValueContainer)
	require.NoError(t, err)

	blinded16aryShallowTreeConfig, err := NewConfig(NewBlindedSHA512_256v1Encoder(), true, 4, 4, 2, ConstructStringValueContainer)
	require.NoError(t, err)

	blindedBinaryShallowTreeConfig, err := NewConfig(NewBlindedSHA512_256v1Encoder(), true, 1, 1, 2, ConstructStringValueContainer)
	require.NoError(t, err)

	// Make test deterministic.
	rand.Seed(1)

	tests := []struct {
		cfg         Config
		step        int
		numIncPairs int
		numExcPairs int
		rootVersion RootVersion
	}{
		{blindedBinaryTreeConfig, 63, 8000, 800, RootVersionV1},
		{blindedBinaryTreeConfig, 1, 200, 200, RootVersionV1},
		{blindedBinaryTreeConfig, 2, 200, 200, RootVersionV1},
		{blindedBinaryTreeConfig, 80, 200, 200, RootVersionV1},
		{unblindedBinaryTreeConfig, 16, 1000, 200, RootVersionV1},
		{blinded16aryTreeConfig, 16, 1000, 200, RootVersionV1},
		{blindedBinaryShallowTreeConfig, 16, 1000, 200, RootVersionV1},
		{blinded16aryShallowTreeConfig, 16, 1000, 200, RootVersionV1},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, test.step, NewInMemoryStorageEngine(test.cfg), test.rootVersion)
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			keys, keysNotInTree, err := makeRandomKeysForTesting(uint(test.cfg.KeysByteLength), test.numIncPairs, test.numExcPairs)
			require.NoError(t, err)
			kvp1, err := makeRandomKVPFromKeysForTesting(keys)
			require.NoError(t, err)
			kvp2, err := makeRandomKVPFromKeysForTesting(keys)
			require.NoError(t, err)

			s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvp1, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			for i, key := range keys {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, key)
				require.NoError(t, err)
				require.True(t, key.Equal(kvpRet.Key))
				require.Equal(t, kvp1[i].Value, kvpRet.Value)
				err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp1[i], &proof, rootHash1)
				require.NoErrorf(t, err, "Error verifying proof for key %v: %v", key, err)
			}
			for _, key := range keysNotInTree {
				eVal, proof, err := tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash1, key)
				require.NoError(t, err)
				require.Nil(t, eVal)
				require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), key, &proof, rootHash1))
			}

			s2, rootHash2, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvp2, nil)
			require.NoError(t, err)
			require.EqualValues(t, 2, s2)

			for i, key := range keys {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 2, key)
				require.NoError(t, err)
				require.True(t, key.Equal(kvpRet.Key))
				require.Equal(t, kvp2[i].Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp2[i], &proof, rootHash2))

				kvpRet, proof, err = tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, key)
				require.NoError(t, err)
				require.True(t, key.Equal(kvpRet.Key))
				require.Equal(t, kvp1[i].Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp1[i], &proof, rootHash1))
			}
			for _, key := range keysNotInTree {
				eVal, proof, err := tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash2, key)
				require.NoError(t, err)
				require.Nil(t, eVal)
				require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), key, &proof, rootHash2))

				eVal, proof, err = tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash2, key)
				require.NoError(t, err)
				require.Nil(t, eVal)
				require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), key, &proof, rootHash2))
			}
		})
	}

}

func TestSomeMaliciousInclusionProofsFail(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	tests := []struct {
		cfg   Config
		kvps1 []KeyValuePair
		kvps2 []KeyValuePair
	}{
		{config1bitU, kvps1_1bit, kvps2_1bit},
		{config2bitsU, kvps1_1bit, kvps2_1bit},
		{config3bitsU, kvps1_3bits, kvps2_3bits},
		{config3bits2valsPerLeafU, kvps1_3bits, kvps2_3bits},
		{config1bitB, kvps1_1bit, kvps2_1bit},
		{config2bitsB, kvps1_1bit, kvps2_1bit},
		{config3bitsB, kvps1_3bits, kvps2_3bits},
		{config3bits2valsPerLeafB, kvps1_3bits, kvps2_3bits},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps1, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			for _, kvp := range test.kvps1 {
				// First, sanity check that honest proofs pass
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash1))

				// Change the value
				kvpFakeVal := KeyValuePair{Key: kvp.Key, Value: "ALTERED_VALUE"}
				err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvpFakeVal, &proof, rootHash1)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// Change the key
				keyFake := Key(append([]byte(nil), ([]byte(kvp.Key))...))
				([]byte(keyFake))[0] = 1 + ([]byte(keyFake))[0]
				kvpFakeKey := KeyValuePair{Key: keyFake, Value: kvp.Value}
				err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvpFakeKey, &proof, rootHash1)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// Change the root hash
				rootHashFake := Hash(append([]byte(nil), ([]byte(rootHash1))...))
				([]byte(rootHashFake))[0] = 1 + ([]byte(rootHashFake))[0]
				err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHashFake)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// nil root hash
				err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, nil)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// empty proof
				err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &MerkleInclusionProof{}, rootHash1)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// Change the blinding key-specific secret (where appropriate)
				if tree.cfg.UseBlindedValueHashes {
					require.NotNil(t, proof.KeySpecificSecret)
					require.True(t, len(proof.KeySpecificSecret) > 0, "Kss: %X", proof.KeySpecificSecret)

					fakeKSS := KeySpecificSecret(append([]byte(nil), ([]byte)(proof.KeySpecificSecret)...))
					([]byte(fakeKSS))[0] = 1 + ([]byte(fakeKSS))[0]
					fakeProof := proof
					fakeProof.KeySpecificSecret = fakeKSS
					err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeProof, rootHash1)
					require.Error(t, err)
					require.IsType(t, ProofVerificationFailedError{}, err)
				}
			}
		})
	}
}

func TestSomeMaliciousExclusionProofsFail(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, _, _ := getSampleKVPS1bit()
	kvps1_3bits, _, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	tests := []struct {
		cfg      Config
		kvps1    []KeyValuePair
		extraKey Key
	}{
		{config1bitU, kvps1_1bit, []byte{0xaa}},
		{config2bitsU, kvps1_1bit, []byte{0xaa}},
		{config3bitsU, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
		{config3bits2valsPerLeafU, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
		{config1bitB, kvps1_1bit, []byte{0xaa}},
		{config2bitsB, kvps1_1bit, []byte{0xaa}},
		{config3bitsB, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
		{config3bits2valsPerLeafB, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps1, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			// First, sanity check that honest proofs pass
			eVal, proof, err := tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash1, test.extraKey)
			require.NoError(t, err)
			require.Nil(t, eVal)
			require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), test.extraKey, &proof, rootHash1))

			// This key is in the tree, so the exclusion proof should fail
			keyFake := test.kvps1[0].Key
			err = verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), keyFake, &proof, rootHash1)
			require.Error(t, err)
			require.IsType(t, ProofVerificationFailedError{}, err)
			// Even an inclusion proof for the right key should fail when verified as an exclusion proof
			eVal, incProof, err := tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash1, keyFake)
			require.NoError(t, err)
			require.NotNil(t, eVal)
			err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), test.kvps1[0], &incProof, rootHash1)
			require.NoError(t, err)
			err = verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), test.kvps1[0].Key, &incProof, rootHash1)
			require.Error(t, err)
			require.IsType(t, ProofVerificationFailedError{}, err)

			// Change the root hash
			rootHashFake := Hash(append([]byte(nil), ([]byte(rootHash1))...))
			([]byte(rootHashFake))[0] = 1 + ([]byte(rootHashFake))[0]
			err = verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), test.extraKey, &proof, rootHashFake)
			require.Error(t, err)
			require.IsType(t, ProofVerificationFailedError{}, err)

			// nil root hash
			err = verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), test.extraKey, &proof, nil)
			require.Error(t, err)
			require.IsType(t, ProofVerificationFailedError{}, err)

			// empty proof
			err = verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), test.extraKey, &MerkleInclusionProof{}, rootHash1)
			require.Error(t, err)
			require.IsType(t, ProofVerificationFailedError{}, err)
		})
	}
}

func TestExclProofOnEmptyTree(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, _, _ := getSampleKVPS1bit()
	kvps1_3bits, _, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	tests := []struct {
		cfg      Config
		kvps1    []KeyValuePair
		extraKey Key
	}{
		{config1bitU, kvps1_1bit, []byte{0xaa}},
		{config2bitsU, kvps1_1bit, []byte{0xaa}},
		{config3bitsU, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
		{config3bits2valsPerLeafU, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
		{config1bitB, kvps1_1bit, []byte{0xaa}},
		{config2bitsB, kvps1_1bit, []byte{0xaa}},
		{config3bitsB, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
		{config3bits2valsPerLeafB, kvps1_3bits, []byte{0xaa, 0xaa, 0xaa}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, nil, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			eVal, proof, err := tree.GetEncodedValueWithInclusionOrExclusionProofFromRootHash(NewLoggerContextTodoForTesting(t), nil, rootHash1, test.extraKey)
			require.NoError(t, err)
			require.Nil(t, eVal)
			require.NoError(t, verifier.VerifyExclusionProof(NewLoggerContextTodoForTesting(t), test.extraKey, &proof, rootHash1))
		})
	}
}

func TestVerifyInclusionProofFailureBranches(t *testing.T) {

	cfg, err := NewConfig(IdentityHasherBlinded{}, true, 2, 4, 2, ConstructStringValueContainer)
	require.NoError(t, err)
	defaultStep := 2

	kvps := []KeyValuePair{
		{Key: []byte{0x00, 0x00}, Value: "key0x0000Seqno1"},
		{Key: []byte{0x00, 0x01}, Value: "key0x0001Seqno1"},
		{Key: []byte{0x00, 0x02}, Value: "key0x0002Seqno1"},
		{Key: []byte{0x01, 0x10}, Value: "key0x0100Seqno1"},
		{Key: []byte{0x01, 0x11}, Value: "key0x0111Seqno1"},
		{Key: []byte{0x01, 0x12}, Value: "key0x0112Seqno1"},
	}

	tree, err := NewTree(cfg, defaultStep, NewInMemoryStorageEngine(cfg), RootVersionV1)
	require.NoError(t, err)
	verifier := NewMerkleProofVerifier(cfg)

	s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvps, nil)
	require.NoError(t, err)
	require.EqualValues(t, 1, s1)

	// First, sanity check that honest proofs pass
	kvp := kvps[1]
	kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
	require.NoError(t, err)
	require.Equal(t, kvp.Value, kvpRet.Value)
	require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash1))

	// nil proof
	err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, nil, rootHash1)
	require.Error(t, err)
	require.Contains(t, err.Error(), "nil proof")

	// Wrong key length
	fakeKvp := kvp
	fakeKvp.Key = []byte{0x00}
	err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), fakeKvp, &proof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Key has wrong length")

	// Proof has too many key hash pairs
	fakeProof := proof
	fakeProof.OtherPairsInLeaf = make([]KeyHashPair, cfg.MaxValuesPerLeaf)
	err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeProof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Too many keys in leaf")

	// switch order in other pairs
	fakeProof = proof
	fakeProof.OtherPairsInLeaf = make([]KeyHashPair, len(proof.OtherPairsInLeaf))
	copy(fakeProof.OtherPairsInLeaf, proof.OtherPairsInLeaf)
	fakeProof.OtherPairsInLeaf[0], fakeProof.OtherPairsInLeaf[1] = fakeProof.OtherPairsInLeaf[1], fakeProof.OtherPairsInLeaf[0]
	err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeProof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Error in Leaf Key ordering or duplicated key")

	// wrong number of siblings
	fakeProof = proof
	fakeProof.SiblingHashesOnPath = fakeProof.SiblingHashesOnPath[1:]
	err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeProof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Invalid number of SiblingHashes")

	// Change the root hash
	rootHashFake := Hash(append([]byte(nil), ([]byte(rootHash1))...))
	([]byte(rootHashFake))[0] = 1 + ([]byte(rootHashFake))[0]
	err = verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHashFake)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "expected rootHash does not match the computed one")
}

func TestTreeWithoutInternalNodes(t *testing.T) {

	tests := []struct {
		step int
	}{
		{1},
		{2},
		{3},
		{30},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("Empy tree with %v step", test.step), func(t *testing.T) {

			cfg, err := NewConfig(IdentityHasherBlinded{}, true, 2, 4, 2, ConstructStringValueContainer)
			require.NoError(t, err)
			tree, err := NewTree(cfg, test.step, NewInMemoryStorageEngine(cfg), RootVersionV1)
			require.NoError(t, err)
			verifier := NewMerkleProofVerifier(cfg)

			kvps1 := []KeyValuePair{
				{Key: []byte{0x00, 0x00}, Value: "key0x0000Seqno1"},
			}

			s1, rootHash1, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvps1, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			kvp := kvps1[0]
			kvpRet, proof, err := tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 1, kvp.Key)
			require.NoError(t, err)
			require.True(t, kvp.Key.Equal(kvpRet.Key))
			require.Equal(t, kvp.Value, kvpRet.Value)
			require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash1))

			kvps2 := []KeyValuePair{
				{Key: []byte{0x00, 0x00}, Value: "key0x0000Seqno2"},
				{Key: []byte{0x00, 0x01}, Value: "key0x0001Seqno2"},
				{Key: []byte{0x00, 0x02}, Value: "key0x0002Seqno2"},
			}

			s2, rootHash2, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvps2, nil)
			require.NoError(t, err)
			require.EqualValues(t, 2, s2)

			kvp = kvps2[1]
			kvpRet, proof, err = tree.GetKeyValuePairWithProof(NewLoggerContextTodoForTesting(t), nil, 2, kvp.Key)
			require.NoError(t, err)
			require.True(t, kvp.Key.Equal(kvpRet.Key))
			require.Equal(t, kvp.Value, kvpRet.Value)
			require.NoError(t, verifier.VerifyInclusionProof(NewLoggerContextTodoForTesting(t), kvp, &proof, rootHash2))
		})
	}
}

func TestGetLatestRoot(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	defaultStep := 2
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	tests := []struct {
		cfg   Config
		kvps1 []KeyValuePair
		kvps2 []KeyValuePair
	}{
		{config1bitU, kvps1_1bit, kvps2_1bit},
		{config2bitsU, kvps1_1bit, kvps2_1bit},
		{config3bitsU, kvps1_3bits, kvps2_3bits},
		{config3bits2valsPerLeafU, kvps1_3bits, kvps2_3bits},
		{config1bitB, kvps1_1bit, kvps2_1bit},
		{config2bitsB, kvps1_1bit, kvps2_1bit},
		{config3bitsB, kvps1_3bits, kvps2_3bits},
		{config3bits2valsPerLeafB, kvps1_3bits, kvps2_3bits},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.BitsPerIndex, test.cfg.MaxValuesPerLeaf, test.cfg.UseBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, defaultStep, NewInMemoryStorageEngine(test.cfg), RootVersionV1)
			require.NoError(t, err)

			s1, rootHash1Exp, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps1, nil)
			require.NoError(t, err)
			require.EqualValues(t, 1, s1)

			_, _, rootHash1, err := tree.GetLatestRoot(NewLoggerContextTodoForTesting(t), nil)
			require.NoError(t, err)
			require.True(t, rootHash1Exp.Equal(rootHash1))

			s2, rootHash2Exp, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, test.kvps2, nil)
			require.NoError(t, err)
			require.EqualValues(t, 2, s2)

			_, _, rootHash2, err := tree.GetLatestRoot(NewLoggerContextTodoForTesting(t), nil)
			require.NoError(t, err)
			require.True(t, rootHash2Exp.Equal(rootHash2))

			require.False(t, rootHash1.Equal(rootHash2))
		})
	}

}

func TestNodeEncodingBasic(t *testing.T) {
	n := Node{}
	enc, err := msgpack.EncodeCanonical(&n)
	require.NoError(t, err)

	var den Node
	err = msgpack.Decode(&den, enc)
	require.NoError(t, err)
	require.Equal(t, n, den)
	require.NotEqual(t, Node{LeafHashes: []KeyHashPair{}}, den)

	n.INodes = make([]Hash, 2)
	_, err = msgpack.EncodeCanonical(&n)
	require.NoError(t, err)

	n.LeafHashes = make([]KeyHashPair, 2)
	_, err = msgpack.EncodeCanonical(&n)
	require.Error(t, err)
	require.Contains(t, err.Error(), "msgpack encode error")

	n = Node{INodes: []Hash{Hash([]byte{0x01, 0x02}), Hash([]byte{0x03, 0x04})}}
	enc, err = msgpack.EncodeCanonical(&n)
	require.NoError(t, err)

	t.Logf("enc : %X", enc)

	var dn Node
	err = msgpack.Decode(&dn, enc)
	require.NoError(t, err)
	require.Equal(t, n, dn)

	n2 := Node{LeafHashes: []KeyHashPair{{Key: Key([]byte{0x01, 0x02}), Hash: Hash([]byte{0x03, 0x03})}}}
	enc, err = msgpack.EncodeCanonical(&n2)
	require.NoError(t, err)

	var dn2 Node
	err = msgpack.Decode(&dn2, enc)
	require.NoError(t, err)
	require.Equal(t, n2, dn2)
	require.NotEqual(t, dn, dn2)
}

func TestInclusionExtensionProofsPass(t *testing.T) {
	cfg, err := NewConfig(SHA512_256Encoder{}, false, 1, 1, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	// make test deterministic
	rand.Seed(1)

	tree, err := NewTree(cfg, 2, NewInMemoryStorageEngine(cfg), RootVersionV1)
	require.NoError(t, err)

	keys, _, err := makeRandomKeysForTesting(uint(cfg.KeysByteLength), 5, 0)
	require.NoError(t, err)

	rootHashes := make(map[Seqno]Hash)

	maxSeqno := Seqno(100)
	// build a bunch of tree versions:
	for j := Seqno(1); j < maxSeqno; j++ {
		kvps, err := makeRandomKVPFromKeysForTesting(keys)
		addOnsHash := Hash(nil)
		// put a random AddOnsHash in half of the tree roots
		if rand.Intn(2) == 1 {
			buf := make([]byte, 32)
			rand.Read(buf)
			addOnsHash = Hash(buf)
		}
		require.NoError(t, err)
		_, hash, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvps, addOnsHash)
		rootHashes[j] = hash
		require.NoError(t, err)
	}

	verifier := NewMerkleProofVerifier(cfg)

	numTests := 50
	for j := 0; j < numTests; j++ {
		startSeqno := Seqno(rand.Intn(int(maxSeqno)-1) + 1)
		endSeqno := Seqno(rand.Intn(int(maxSeqno)-1) + 1)
		if startSeqno > endSeqno {
			startSeqno, endSeqno = endSeqno, startSeqno
		}

		eProof, err := tree.GetExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno)
		require.NoError(t, err)

		err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
		require.NoError(t, err)

		k := keys[rand.Intn(len(keys))]

		kvp, ieProof, err := tree.GetKeyValuePairWithInclusionExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno, k)
		require.NoError(t, err)
		require.Equal(t, k, kvp.Key)

		err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
		require.NoError(t, err)
	}

	// Test the special cases start == end and start == end - 1
	startSeqno := Seqno(rand.Intn(int(maxSeqno)-1) + 1)
	endSeqno := startSeqno

	eProof, err := tree.GetExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno)
	require.NoError(t, err)

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)

	k := keys[rand.Intn(len(keys))]

	kvp, ieProof, err := tree.GetKeyValuePairWithInclusionExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno, k)
	require.NoError(t, err)
	require.Equal(t, k, kvp.Key)

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)

	endSeqno = startSeqno + 1

	eProof, err = tree.GetExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno)
	require.NoError(t, err)

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)

	kvp, ieProof, err = tree.GetKeyValuePairWithInclusionExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno, k)
	require.NoError(t, err)
	require.Equal(t, k, kvp.Key)

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)
}

func TestExtensionProofsFailureBranches(t *testing.T) {
	cfg, err := NewConfig(SHA512_256Encoder{}, false, 1, 1, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	// make test deterministic
	rand.Seed(1)

	tree, err := NewTree(cfg, 2, NewInMemoryStorageEngine(cfg), RootVersionV1)
	require.NoError(t, err)

	keys, _, err := makeRandomKeysForTesting(uint(cfg.KeysByteLength), 5, 0)
	require.NoError(t, err)

	rootHashes := make(map[Seqno]Hash)

	maxSeqno := Seqno(100)
	// build a bunch of tree versions:
	for j := Seqno(1); j < maxSeqno; j++ {
		kvps, err := makeRandomKVPFromKeysForTesting(keys)
		require.NoError(t, err)
		_, hash, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvps, nil)
		rootHashes[j] = hash
		require.NoError(t, err)
	}

	verifier := NewMerkleProofVerifier(cfg)

	startSeqno := Seqno(20)
	endSeqno := Seqno(39)

	// real proof verifies successfully
	eProof, err := tree.GetExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno)
	require.NoError(t, err)
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)

	// nil proof
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "nil proof")

	// "good proofs" verified wrt the wrong parameters should fail
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, endSeqno, rootHashes[startSeqno], startSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "start > end")

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno+1, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno+1, rootHashes[startSeqno], endSeqno+1, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of root hashes")

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno+1, rootHashes[startSeqno+1], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &eProof, startSeqno+1, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno+1])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	// no previous roots
	fakeEProof := eProof
	fakeEProof.PreviousRootsNoSkips = nil
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &fakeEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	// no root hashes
	fakeEProof = eProof
	fakeEProof.RootHashes = nil
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &fakeEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of root hashes")

	// a root hash has been tampered with
	fakeEProof = eProof
	fakeEProof.RootHashes = make([]Hash, len(eProof.RootHashes))
	copy(fakeEProof.RootHashes, eProof.RootHashes)
	fakeHashB := sha256.Sum256([]byte("tampered hash!"))
	fakeHash := Hash(fakeHashB[:])
	fakeEProof.RootHashes[1] = fakeHash
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &fakeEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "verifyExtensionProofFinal: hash mismatch")

	// no PreviousRootsNoSkips
	fakeEProof = eProof
	fakeEProof.PreviousRootsNoSkips = nil
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &fakeEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	// a root metadata has been tampered with
	fakeEProof = eProof
	fakeEProof.PreviousRootsNoSkips = make([]RootMetadata, len(eProof.PreviousRootsNoSkips))
	copy(fakeEProof.PreviousRootsNoSkips, eProof.PreviousRootsNoSkips)
	fakeRoot := RootMetadata{RootVersion: RootVersionV1, Seqno: Seqno(257), SkipPointersHash: fakeHash}
	fakeEProof.PreviousRootsNoSkips[1] = fakeRoot
	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), &fakeEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "verifyExtensionProofFinal: hash mismatch")

	//failure when the proof is not necessary
	startSeqno = Seqno(20)
	endSeqno = startSeqno

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)

	err = verifier.VerifyExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, rootHashes[startSeqno], endSeqno, fakeHash)
	require.Error(t, err)
	require.Contains(t, err.Error(), "Hash mismatch: initialSeqno == finalSeqno")
}

func TestInclusionExtensionProofsFailureBranches(t *testing.T) {
	cfg, err := NewConfig(SHA512_256Encoder{}, false, 1, 1, 3, ConstructStringValueContainer)
	require.NoError(t, err)

	// make test deterministic
	rand.Seed(1)

	tree, err := NewTree(cfg, 2, NewInMemoryStorageEngine(cfg), RootVersionV1)
	require.NoError(t, err)

	keys, _, err := makeRandomKeysForTesting(uint(cfg.KeysByteLength), 5, 0)
	require.NoError(t, err)

	rootHashes := make(map[Seqno]Hash)

	maxSeqno := Seqno(100)
	// build a bunch of tree versions:
	for j := Seqno(1); j < maxSeqno; j++ {
		kvps, err := makeRandomKVPFromKeysForTesting(keys)
		require.NoError(t, err)
		_, hash, err := tree.Build(NewLoggerContextTodoForTesting(t), nil, kvps, nil)
		rootHashes[j] = hash
		require.NoError(t, err)
	}

	verifier := NewMerkleProofVerifier(cfg)

	startSeqno := Seqno(20)
	endSeqno := Seqno(39)

	k := keys[rand.Intn(len(keys))]

	// real proof verifies successfully
	kvp, ieProof, err := tree.GetKeyValuePairWithInclusionExtensionProof(NewLoggerContextTodoForTesting(t), nil, startSeqno, endSeqno, k)
	require.NoError(t, err)
	require.Equal(t, k, kvp.Key)

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.NoError(t, err)

	// nil proof
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, nil, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "nil proof")

	// "good proofs" verified wrt the wrong parameters should fail
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, endSeqno, rootHashes[startSeqno], startSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "start > end")

	fakeKvp := KeyValuePair{Key: kvp.Key, Value: EncodedValue([]byte("fake value"))}
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), fakeKvp, &ieProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected rootHash does not match the computed one")

	fakeKvp = KeyValuePair{Key: Key([]byte{0x00, 0x01, 0x02}), Value: kvp.Value}
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), fakeKvp, &ieProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected rootHash does not match the computed one")

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno+1, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno+1, rootHashes[startSeqno], endSeqno+1, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of root hashes")

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno+1, rootHashes[startSeqno+1], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &ieProof, startSeqno+1, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno+1])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	// no previous roots
	fakeIEProof := ieProof
	fakeIEProof.MerkleExtensionProof.PreviousRootsNoSkips = nil
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeIEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	// no root hashes
	fakeIEProof = ieProof
	fakeIEProof.MerkleExtensionProof.RootHashes = nil
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeIEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of root hashes")

	// a root hash has been tampered with
	fakeIEProof = ieProof
	fakeIEProof.MerkleExtensionProof.RootHashes = make([]Hash, len(ieProof.MerkleExtensionProof.RootHashes))
	copy(fakeIEProof.MerkleExtensionProof.RootHashes, ieProof.MerkleExtensionProof.RootHashes)
	fakeHashB := sha256.Sum256([]byte("tampered hash!"))
	fakeHash := Hash(fakeHashB[:])
	fakeIEProof.MerkleExtensionProof.RootHashes[1] = fakeHash
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeIEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected rootHash does not match the computed one")

	// no PreviousRootsNoSkips
	fakeIEProof = ieProof
	fakeIEProof.MerkleExtensionProof.PreviousRootsNoSkips = nil
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeIEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "The proof does not have the expected number of roots")

	// a root metadata has been tampered with
	fakeIEProof = ieProof
	fakeIEProof.MerkleExtensionProof.PreviousRootsNoSkips = make([]RootMetadata, len(ieProof.MerkleExtensionProof.PreviousRootsNoSkips))
	copy(fakeIEProof.MerkleExtensionProof.PreviousRootsNoSkips, ieProof.MerkleExtensionProof.PreviousRootsNoSkips)
	fakeRoot := RootMetadata{RootVersion: RootVersionV1, Seqno: Seqno(257), SkipPointersHash: fakeHash}
	fakeIEProof.MerkleExtensionProof.PreviousRootsNoSkips[1] = fakeRoot
	err = verifier.VerifyInclusionExtensionProof(NewLoggerContextTodoForTesting(t), kvp, &fakeIEProof, startSeqno, rootHashes[startSeqno], endSeqno, rootHashes[endSeqno])
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected rootHash does not match the computed one")

}

func NewLoggerContextTodoForTesting(t *testing.T) logger.ContextInterface {
	return logger.NewContext(context.TODO(), logger.NewTestLogger(t))
}
