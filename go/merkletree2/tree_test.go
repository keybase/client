package merkletree2

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/keybase/client/go/msgpack"

	"github.com/keybase/client/go/logger"

	"github.com/stretchr/testify/require"
)

func TestEmptyTree(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)

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
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)

			seq, root, hash, err := tree.GetLatestRoot(context.TODO(), nil)
			require.Error(t, err)
			require.IsType(t, NoLatestRootFoundError{}, err)
			require.Equal(t, Seqno(0), seq, "Tree should have Seqno 0 as no insertions were made, got %v instead", seq)
			require.Nil(t, root.BareRootHash, "Tree root should not have a bareRootHash as no insertions were made")
			require.Nil(t, hash, "Tree root should not have a root hash as no insertions were made")

			for _, kvp := range test.kvps1 {
				_, err := tree.GetKeyValuePairUnsafe(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				_, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

				_, err = tree.GetKeyValuePair(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				_, err = tree.GetKeyValuePair(context.TODO(), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}
		})
	}

}

func TestBuildTreeAndGetKeyValuePair(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
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
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)

			// This kvp has a key which is not part of test.kvps1
			kvpAddedAtSeqno2 := test.kvps2[len(test.kvps2)-2]

			_, err = tree.GetKeyValuePair(context.TODO(), nil, 0, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 0, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)

			_, err = tree.GetKeyValuePair(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			_, err = tree.Build(context.TODO(), nil, test.kvps1)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				_, err := tree.GetKeyValuePairUnsafe(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err := tree.GetKeyValuePairUnsafe(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				kvpRet, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 7, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)

				_, err = tree.GetKeyValuePair(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err = tree.GetKeyValuePair(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(context.TODO(), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}

			_, err = tree.GetKeyValuePair(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			_, err = tree.Build(context.TODO(), nil, test.kvps2)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				kvpRet, err := tree.GetKeyValuePairUnsafe(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)

				kvpRet, err = tree.GetKeyValuePair(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Value, kvpRet.Value)
			}

			_, err = tree.GetKeyValuePair(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)
			_, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			for _, kvp := range test.kvps2 {
				_, err := tree.GetKeyValuePairUnsafe(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err := tree.GetKeyValuePairUnsafe(context.TODO(), nil, 2, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				kvpRet, err = tree.GetKeyValuePairUnsafe(context.TODO(), nil, 7, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)

				_, err = tree.GetKeyValuePair(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, err = tree.GetKeyValuePair(context.TODO(), nil, 2, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(context.TODO(), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}
		})
	}

}

func TestBuildTreeAndGetKeyValuePairWithProof(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
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
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)

			// This kvp has a key which is not part of test.kvps1
			kvpAddedAtSeqno2 := test.kvps2[len(test.kvps2)-2]

			_, _, err = tree.GetKeyValuePairWithProof(context.TODO(), nil, 0, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)

			_, _, err = tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)

			_, err = tree.Build(context.TODO(), nil, test.kvps1)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				_, _, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, _, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(context.TODO(), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}

			_, _, err = tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			_, err = tree.Build(context.TODO(), nil, test.kvps2)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				kvpRet, _, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
			}
			_, _, err = tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvpAddedAtSeqno2.Key)
			require.Error(t, err)
			require.IsType(t, KeyNotFoundError{}, err, "Expected KeyNotFoundError, but got %v", err)

			for _, kvp := range test.kvps2 {
				_, _, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 0, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
				kvpRet, _, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 2, kvp.Key)
				require.NoError(t, err, "Unexpected error for key %v: %v", kvp.Key, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				_, err = tree.GetKeyValuePair(context.TODO(), nil, 7, kvp.Key)
				require.Error(t, err)
				require.IsType(t, InvalidSeqnoError{}, err, "Expected InvalidSeqnoError, but got %v", err)
			}
		})
	}
}

func TestHonestMerkleProofsVerifySuccesfully(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3)
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
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			rootHash1, err := tree.Build(context.TODO(), nil, test.kvps1)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.True(t, kvp.Key.Equal(kvpRet.Key))
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash1))
			}

			rootHash2, err := tree.Build(context.TODO(), nil, test.kvps2)
			require.NoError(t, err)

			for _, kvp := range test.kvps2 {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 2, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Key, kvpRet.Key)
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash2))
			}

			for _, kvp := range test.kvps1 {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.True(t, kvp.Key.Equal(kvpRet.Key))
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash1))
			}

		})
	}

}

func TestHonestMerkleProofsVerifySuccesfullyLargeTree(t *testing.T) {
	blindedBinaryTreeConfig, err := NewConfig(BlindedSHA512_256v1Encoder{}, true, 1, 1, 32)
	require.NoError(t, err)

	unblindedBinaryTreeConfig, err := NewConfig(SHA512_256Encoder{}, false, 1, 1, 32)
	require.NoError(t, err)

	blinded16aryTreeConfig, err := NewConfig(BlindedSHA512_256v1Encoder{}, true, 4, 4, 32)
	require.NoError(t, err)

	blinded16aryShallowTreeConfig, err := NewConfig(BlindedSHA512_256v1Encoder{}, true, 4, 4, 2)
	require.NoError(t, err)

	blindedBinaryShallowTreeConfig, err := NewConfig(BlindedSHA512_256v1Encoder{}, true, 1, 1, 2)
	require.NoError(t, err)

	// Make test deterministic.
	rand.Seed(1)

	tests := []struct {
		cfg      Config
		numPairs int
	}{
		{blindedBinaryTreeConfig, 4000},
		{unblindedBinaryTreeConfig, 1000},
		{blinded16aryTreeConfig, 1000},
		// The last two threes have a much smaller key space and are therefore
		// more dense.
		{blindedBinaryShallowTreeConfig, 1000},
		{blinded16aryShallowTreeConfig, 1000},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			keys, err := makeRandomKeysForTesting(uint(test.cfg.keysByteLength), test.numPairs)
			require.NoError(t, err)
			kvp1, err := makeRandomKVPFromKeysForTesting(keys)
			require.NoError(t, err)
			kvp2, err := makeRandomKVPFromKeysForTesting(keys)
			require.NoError(t, err)

			rootHash1, err := tree.Build(context.TODO(), nil, kvp1)
			require.NoError(t, err)

			for i, key := range keys {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, key)
				require.NoError(t, err)
				require.True(t, key.Equal(kvpRet.Key))
				require.Equal(t, kvp1[i].Value, kvpRet.Value)
				t.Logf("proof: %v", proof.OtherPairsInLeaf)
				err = verifier.VerifyInclusionProof(context.TODO(), kvp1[i], proof, rootHash1)
				require.NoErrorf(t, err, "Error verifying proof for key %v: %v", key, err)
			}

			rootHash2, err := tree.Build(context.TODO(), nil, kvp2)
			require.NoError(t, err)

			for i, key := range keys {
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 2, key)
				require.NoError(t, err)
				require.True(t, key.Equal(kvpRet.Key))
				require.Equal(t, kvp2[i].Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp2[i], proof, rootHash2))

				kvpRet, proof, err = tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, key)
				require.NoError(t, err)
				require.True(t, key.Equal(kvpRet.Key))
				require.Equal(t, kvp1[i].Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp1[i], proof, rootHash1))
			}
		})
	}

}

func TestSomeMaliciousProofsFail(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3)
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
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)
			verifier := MerkleProofVerifier{cfg: test.cfg}

			rootHash1, err := tree.Build(context.TODO(), nil, test.kvps1)
			require.NoError(t, err)

			for _, kvp := range test.kvps1 {
				// First, sanity check that honest proofs pass
				kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
				require.NoError(t, err)
				require.Equal(t, kvp.Value, kvpRet.Value)
				require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash1))

				// Change the value
				kvpFakeVal := KeyValuePair{Key: kvp.Key, Value: "ALTERED_VALUE"}
				err = verifier.VerifyInclusionProof(context.TODO(), kvpFakeVal, proof, rootHash1)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// Change the key
				keyFake := Key(append([]byte(nil), ([]byte(kvp.Key))...))
				([]byte(keyFake))[0] = 1 + ([]byte(keyFake))[0]
				kvpFakeKey := KeyValuePair{Key: keyFake, Value: kvp.Value}
				err = verifier.VerifyInclusionProof(context.TODO(), kvpFakeKey, proof, rootHash1)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// Change the root hash
				rootHashFake := Hash(append([]byte(nil), ([]byte(rootHash1))...))
				([]byte(rootHashFake))[0] = 1 + ([]byte(rootHashFake))[0]
				err = verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHashFake)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// nil root hash
				err = verifier.VerifyInclusionProof(context.TODO(), kvp, proof, nil)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// empty proof
				err = verifier.VerifyInclusionProof(context.TODO(), kvp, MerkleInclusionProof{}, rootHash1)
				require.Error(t, err)
				require.IsType(t, ProofVerificationFailedError{}, err)

				// Change the blinding key-specific secret (where appropriate)
				if tree.cfg.useBlindedValueHashes {
					require.NotNil(t, proof.KeySpecificSecret)
					require.True(t, len(proof.KeySpecificSecret) > 0, "Kss: %X", proof.KeySpecificSecret)

					fakeKSS := KeySpecificSecret(append([]byte(nil), ([]byte)(proof.KeySpecificSecret)...))
					([]byte(fakeKSS))[0] = 1 + ([]byte(fakeKSS))[0]
					var fakeProof MerkleInclusionProof
					fakeProof = proof
					fakeProof.KeySpecificSecret = fakeKSS
					err = verifier.VerifyInclusionProof(context.TODO(), kvp, fakeProof, rootHash1)
					require.Error(t, err)
					require.IsType(t, ProofVerificationFailedError{}, err)
				}
			}
		})
	}

}

func TestVerifyInclusionProofFailureBranches(t *testing.T) {

	cfg, err := NewConfig(IdentityHasherBlinded{}, true, 2, 4, 2)
	require.NoError(t, err)

	kvps := []KeyValuePair{
		KeyValuePair{Key: []byte{0x00, 0x00}, Value: "key0x0000Seqno1"},
		KeyValuePair{Key: []byte{0x00, 0x01}, Value: "key0x0001Seqno1"},
		KeyValuePair{Key: []byte{0x00, 0x02}, Value: "key0x0002Seqno1"},
		KeyValuePair{Key: []byte{0x01, 0x10}, Value: "key0x0100Seqno1"},
		KeyValuePair{Key: []byte{0x01, 0x11}, Value: "key0x0111Seqno1"},
		KeyValuePair{Key: []byte{0x01, 0x12}, Value: "key0x0112Seqno1"},
	}

	tree, err := NewTree(cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
	require.NoError(t, err)
	verifier := MerkleProofVerifier{cfg: cfg}

	rootHash1, err := tree.Build(context.TODO(), nil, kvps)
	require.NoError(t, err)

	// First, sanity check that honest proofs pass
	kvp := kvps[1]
	kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
	require.NoError(t, err)
	require.Equal(t, kvp.Value, kvpRet.Value)
	require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash1))

	// Wrong key length
	fakeKvp := kvp
	fakeKvp.Key = []byte{0x00}
	err = verifier.VerifyInclusionProof(context.TODO(), fakeKvp, proof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Key has wrong length")

	// Proof has too many key hash pairs
	fakeProof := proof
	fakeProof.OtherPairsInLeaf = make([]KeyHashPair, cfg.maxValuesPerLeaf)
	err = verifier.VerifyInclusionProof(context.TODO(), kvp, fakeProof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Too many keys in leaf")

	// switch order in other pairs
	fakeProof = proof
	fakeProof.OtherPairsInLeaf = make([]KeyHashPair, len(proof.OtherPairsInLeaf))
	copy(fakeProof.OtherPairsInLeaf, proof.OtherPairsInLeaf)
	fakeProof.OtherPairsInLeaf[0], fakeProof.OtherPairsInLeaf[1] = fakeProof.OtherPairsInLeaf[1], fakeProof.OtherPairsInLeaf[0]
	err = verifier.VerifyInclusionProof(context.TODO(), kvp, fakeProof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Error in Leaf Key ordering or duplicated key")

	// wrong number of siblings
	fakeProof = proof
	fakeProof.SiblingHashesOnPath = fakeProof.SiblingHashesOnPath[1:]
	err = verifier.VerifyInclusionProof(context.TODO(), kvp, fakeProof, rootHash1)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "Invalid number of SiblingHashes")

	// Change the root hash
	rootHashFake := Hash(append([]byte(nil), ([]byte(rootHash1))...))
	([]byte(rootHashFake))[0] = 1 + ([]byte(rootHashFake))[0]
	err = verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHashFake)
	require.Error(t, err)
	require.IsType(t, ProofVerificationFailedError{}, err)
	require.Contains(t, err.Error(), "expected rootHash does not match the computed one")

}

func TestTreeWithoutInternalNodes(t *testing.T) {

	cfg, err := NewConfig(IdentityHasherBlinded{}, true, 2, 4, 2)
	require.NoError(t, err)
	tree, err := NewTree(cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
	require.NoError(t, err)
	verifier := MerkleProofVerifier{cfg: cfg}

	kvps1 := []KeyValuePair{
		KeyValuePair{Key: []byte{0x00, 0x00}, Value: "key0x0000Seqno1"},
	}

	rootHash1, err := tree.Build(context.TODO(), nil, kvps1)
	require.NoError(t, err)

	kvp := kvps1[0]
	kvpRet, proof, err := tree.GetKeyValuePairWithProof(context.TODO(), nil, 1, kvp.Key)
	require.NoError(t, err)
	require.True(t, kvp.Key.Equal(kvpRet.Key))
	require.Equal(t, kvp.Value, kvpRet.Value)
	require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash1))

	kvps2 := []KeyValuePair{
		KeyValuePair{Key: []byte{0x00, 0x00}, Value: "key0x0000Seqno2"},
		KeyValuePair{Key: []byte{0x00, 0x01}, Value: "key0x0001Seqno2"},
		KeyValuePair{Key: []byte{0x00, 0x02}, Value: "key0x0002Seqno2"},
	}

	rootHash2, err := tree.Build(context.TODO(), nil, kvps2)
	require.NoError(t, err)

	kvp = kvps2[1]
	kvpRet, proof, err = tree.GetKeyValuePairWithProof(context.TODO(), nil, 2, kvp.Key)
	require.NoError(t, err)
	require.True(t, kvp.Key.Equal(kvpRet.Key))
	require.Equal(t, kvp.Value, kvpRet.Value)
	require.NoError(t, verifier.VerifyInclusionProof(context.TODO(), kvp, proof, rootHash2))
}

func TestGetLatestRoot(t *testing.T) {
	config1bitU, config2bitsU, config3bitsU := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)
	config1bitB, config2bitsB, config3bitsB := getTreeCfgsWith1_2_3BitsPerIndexBlinded(t)
	kvps1_1bit, kvps2_1bit, _ := getSampleKVPS1bit()
	kvps1_3bits, kvps2_3bits, _ := getSampleKVPS3bits()

	config3bits2valsPerLeafU, err := NewConfig(IdentityHasher{}, false, 3, 2, 3)
	require.NoError(t, err)
	config3bits2valsPerLeafB, err := NewConfig(IdentityHasherBlinded{}, true, 3, 2, 3)
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
		t.Run(fmt.Sprintf("%v bits %v values per leaf tree (blinded %v)", test.cfg.bitsPerIndex, test.cfg.maxValuesPerLeaf, test.cfg.useBlindedValueHashes), func(t *testing.T) {
			tree, err := NewTree(test.cfg, NewInMemoryStorageEngine(), logger.NewTestLogger(t))
			require.NoError(t, err)

			rootHash1Exp, err := tree.Build(context.TODO(), nil, test.kvps1)
			require.NoError(t, err)

			_, _, rootHash1, err := tree.GetLatestRoot(context.TODO(), nil)
			require.NoError(t, err)
			require.True(t, rootHash1Exp.Equal(rootHash1))

			rootHash2Exp, err := tree.Build(context.TODO(), nil, test.kvps2)
			require.NoError(t, err)

			_, _, rootHash2, err := tree.GetLatestRoot(context.TODO(), nil)
			require.NoError(t, err)
			require.True(t, rootHash2Exp.Equal(rootHash2))

			require.False(t, rootHash1.Equal(rootHash2))
		})
	}

}

func TestNodeEncodingBasic(t *testing.T) {
	n := Node{}
	_, err := msgpack.EncodeCanonical(&n)
	require.NoError(t, err)

	n.INodes = make([]Hash, 2)
	_, err = msgpack.EncodeCanonical(&n)
	require.NoError(t, err)

	n.LeafHashes = make([]KeyHashPair, 2)
	_, err = msgpack.EncodeCanonical(&n)
	require.Error(t, err)
	require.Contains(t, err.Error(), "msgpack encode error")

	n = Node{INodes: []Hash{Hash([]byte{0x01, 0x02}), Hash([]byte{0x03, 0x04})}}
	enc, err := msgpack.EncodeCanonical(&n)
	require.NoError(t, err)

	t.Logf("enc : %X", enc)

	var dn Node
	err = msgpack.Decode(&dn, enc)
	require.NoError(t, err)
	require.Equal(t, n, dn)

	n2 := Node{LeafHashes: []KeyHashPair{KeyHashPair{Key: Key([]byte{0x01, 0x02}), Hash: Hash([]byte{0x03, 0x03})}}}
	enc, err = msgpack.EncodeCanonical(&n2)
	require.NoError(t, err)

	var dn2 Node
	err = msgpack.Decode(&dn2, enc)
	require.NoError(t, err)
	require.Equal(t, n2, dn2)
	require.NotEqual(t, dn, dn2)
}
