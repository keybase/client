package merkletree2

import (
	"fmt"

	"golang.org/x/net/context"
)

type MerkleProofVerifier struct {
	cfg Config
}

func NewMerkleProofVerifier(c Config) MerkleProofVerifier {
	return MerkleProofVerifier{cfg: c}
}

func (m *MerkleProofVerifier) VerifyInclusionProof(ctx context.Context, kvp KeyValuePair, proof MerkleInclusionProof, expRootHash Hash) error {

	// Hash the key value pair
	kvpHash, err := m.cfg.encoder.HashKeyValuePairWithKeySpecificSecret(kvp, proof.KeySpecificSecret)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}

	if len(kvp.Key) != m.cfg.keysByteLength {
		return NewProofVerificationFailedError(fmt.Errorf("Key has wrong length for this tree: %v (expected %v)", len(kvp.Key), m.cfg.keysByteLength))
	}

	if len(proof.OtherPairsInLeaf)+1 > m.cfg.maxValuesPerLeaf {
		return NewProofVerificationFailedError(fmt.Errorf("Too many keys in leaf: %v > %v", len(proof.OtherPairsInLeaf)+1, m.cfg.maxValuesPerLeaf))
	}

	// Reconstruct the leaf node
	leaf := Node{LeafHashes: make([]KeyHashPair, len(proof.OtherPairsInLeaf)+1)}

	// LeafHashes is obtained by adding kvp into OtherPairsInLeaf while maintaining sorted order
	for i, j, isInserted := 0, 0, false; i < len(proof.OtherPairsInLeaf)+1; i++ {
		if (j < len(proof.OtherPairsInLeaf) && !isInserted && proof.OtherPairsInLeaf[j].Key.Cmp(kvp.Key) > 0) || j >= len(proof.OtherPairsInLeaf) {
			leaf.LeafHashes[i] = KeyHashPair{Key: kvp.Key, Hash: kvpHash}
			isInserted = true
		} else {
			leaf.LeafHashes[i] = proof.OtherPairsInLeaf[j]
			j++
		}

		// Ensure all the KeyHashPairs in the leaf node are different
		if i > 0 && leaf.LeafHashes[i-1].Key.Cmp(leaf.LeafHashes[i].Key) >= 0 {
			return NewProofVerificationFailedError(fmt.Errorf("Error in Leaf Key ordering or duplicated key: %v >= %v", leaf.LeafHashes[i-1].Key, leaf.LeafHashes[i].Key))
		}
	}

	// Recompute the hashes on the nodes on the path from the leaf to the root.
	nodeHash, err := m.cfg.encoder.EncodeAndHashGeneric(leaf)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}

	sibH := proof.SiblingHashesOnPath
	if len(sibH)%(m.cfg.childrenPerNode-1) != 0 {
		return NewProofVerificationFailedError(fmt.Errorf("Invalid number of SiblingHashes %v", len(sibH)))
	}
	keyAsPos, err := m.cfg.getDeepestPositionForKey(kvp.Key)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}
	leafPosition := m.cfg.getParentAtLevel(keyAsPos, uint(len(sibH)/(m.cfg.childrenPerNode-1)))

	// recompute the hash of the root node by recreating all the internal nodes
	// on the path from the leaf to the root.
	i := 0
	for _, childIndex := range m.cfg.positionToChildIndexPath(leafPosition) {
		sibHAtLevel := sibH[i : i+m.cfg.childrenPerNode-1]

		node := Node{INodes: make([]Hash, m.cfg.childrenPerNode)}
		copy(node.INodes, sibHAtLevel[:int(childIndex)])
		node.INodes[int(childIndex)] = nodeHash
		copy(node.INodes[int(childIndex)+1:], sibHAtLevel[int(childIndex):])

		i += m.cfg.childrenPerNode - 1
		nodeHash, err = m.cfg.encoder.EncodeAndHashGeneric(node)
		if err != nil {
			return NewProofVerificationFailedError(err)
		}
	}

	// Compute the hash of the RootMetadata by filling in the BareRootHash
	// with the value computed above.
	rootMetadata := proof.RootMetadataNoHash
	rootMetadata.BareRootHash = nodeHash
	rootHash, err := m.cfg.encoder.EncodeAndHashGeneric(rootMetadata)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}

	// Check the rootHash computed matches the expected value.
	if !rootHash.Equal(expRootHash) {
		return NewProofVerificationFailedError(fmt.Errorf("expected rootHash does not match the computed one: expected %X but got %X", expRootHash, rootHash))
	}

	// Success!
	return nil
}
