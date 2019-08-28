package merkletree2

import (
	"fmt"

	"golang.org/x/net/context"
)

type MerkleProofVerifier struct {
	TreeConfig
}

func NewMerkleProofVerifier(t TreeConfig) MerkleProofVerifier {
	return MerkleProofVerifier{TreeConfig: t}
}

func (m *MerkleProofVerifier) VerifyInclusionProof(ctx context.Context, kvp KeyValuePair, proof MerkleInclusionProof, expRootHash Hash) error {

	// Hash the key value pair
	kvpHash, err := m.hasher.HashKeyValuePairWithKeySpecificSecret(kvp, proof.KeySpecificSecret)
	if err != nil {
		return NewProofVerificationFailedErrorFromCause(err)
	}

	if len(proof.OtherPairsInLeaf)+1 > m.maxValuesPerLeaf {
		return NewProofVerificationFailedError(fmt.Sprintf("Too many keys in leaf: %v", len(proof.OtherPairsInLeaf)+1))
	}

	// Reconstruct the leaf node
	var leaf Node
	leaf.Type = NodeTypeLeaf
	leaf.LeafHashes = make([]KeyHashPair, len(proof.OtherPairsInLeaf)+1)
	// LeafHashes is obtained by adding kvp into OtherPairsInLeaf while maintaining sorted order
	for i, j, k := 0, 0, 0; i < len(proof.OtherPairsInLeaf)+1; i++ {
		if (j < len(proof.OtherPairsInLeaf) && k < 1 && proof.OtherPairsInLeaf[j].Key.Cmp(kvp.Key) > 0) || j >= len(proof.OtherPairsInLeaf) {
			leaf.LeafHashes[i] = KeyHashPair{Key: kvp.Key, Hash: kvpHash}
			k++
		} else {
			leaf.LeafHashes[i] = proof.OtherPairsInLeaf[j]
			j++
		}

		// Ensure all the KeyHashPairs in the leaf node are different
		if i > 0 && leaf.LeafHashes[i-1].Key.Cmp(leaf.LeafHashes[i].Key) >= 0 {
			return NewProofVerificationFailedError(fmt.Sprintf("Error in Leaf Key ordering or duplicated key: %v >= %v", leaf.LeafHashes[i-1].Key, leaf.LeafHashes[i].Key))
		}
	}
	if len(leaf.LeafHashes) > m.maxValuesPerLeaf {
		return NewProofVerificationFailedError(fmt.Sprintf("Too many values in Leaf: %v > %v", len(leaf.LeafHashes), m.maxValuesPerLeaf))
	}

	// Recompute the hashes on the nodes on the path from the leaf to the root.
	nodeHash, err := m.hasher.EncodeAndHashGeneric(leaf)
	if err != nil {
		return NewProofVerificationFailedErrorFromCause(err)
	}

	sibH := proof.SiblingHashesOnPath
	if len(sibH)%(m.childrenPerNode-1) != 0 {
		return NewProofVerificationFailedError(fmt.Sprintf("Invalid number of SiblingHashes %v", len(sibH)))
	}
	keyAsPos, err := m.getDeepestPositionForKey(kvp.Key)
	if err != nil {
		return NewProofVerificationFailedErrorFromCause(err)
	}
	leafPosition := m.getParentAtLevel(keyAsPos, uint(len(sibH)/(m.childrenPerNode-1)))

	for _, childIndex := range m.positionToChildIndexes(leafPosition) {
		var node Node
		node.Type = NodeTypeINode
		node.INodes = make([]Hash, m.childrenPerNode)
		copy(node.INodes, sibH[:int(childIndex)])
		node.INodes[int(childIndex)] = nodeHash
		copy(node.INodes[int(childIndex)+1:], sibH[int(childIndex):m.childrenPerNode-1])

		sibH = sibH[m.childrenPerNode-1:]
		nodeHash, err = m.hasher.EncodeAndHashGeneric(node)
		if err != nil {
			return NewProofVerificationFailedErrorFromCause(err)
		}
	}

	// Compute the hash of the RootMetadataNode by filling in the BareRootHash
	// with the value computed above.
	rootMNode := proof.RootNodeNoHash
	rootMNode.BareRootHash = nodeHash
	rootHash, err := m.hasher.EncodeAndHashGeneric(rootMNode)
	if err != nil {
		return NewProofVerificationFailedErrorFromCause(err)
	}

	// Check the rootHash computed matches the expected value.
	if !rootHash.Equal(expRootHash) {
		return NewProofVerificationFailedError(fmt.Sprintf("expRootHash %X does not match the computed one %X", expRootHash, rootHash))
	}

	// Success!
	return nil
}
