package merkletree2

import (
	"fmt"

	"github.com/keybase/client/go/logger"
)

type MerkleProofVerifier struct {
	cfg Config
}

func NewMerkleProofVerifier(c Config) MerkleProofVerifier {
	return MerkleProofVerifier{cfg: c}
}

func (m *MerkleProofVerifier) VerifyInclusionProof(ctx logger.ContextInterface, kvp KeyValuePair, proof *MerkleInclusionProof, expRootHash Hash) error {
	if proof == nil {
		return NewProofVerificationFailedError(fmt.Errorf("nil proof"))
	}

	// Hash the key value pair
	kvpHash, err := m.cfg.Encoder.HashKeyValuePairWithKeySpecificSecret(kvp, proof.KeySpecificSecret)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}

	if len(kvp.Key) != m.cfg.KeysByteLength {
		return NewProofVerificationFailedError(fmt.Errorf("Key has wrong length for this tree: %v (expected %v)", len(kvp.Key), m.cfg.KeysByteLength))
	}

	if len(proof.OtherPairsInLeaf)+1 > m.cfg.MaxValuesPerLeaf {
		return NewProofVerificationFailedError(fmt.Errorf("Too many keys in leaf: %v > %v", len(proof.OtherPairsInLeaf)+1, m.cfg.MaxValuesPerLeaf))
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
	_, nodeHash, err := m.cfg.Encoder.EncodeAndHashGeneric(leaf)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}

	sibH := proof.SiblingHashesOnPath
	if len(sibH)%(m.cfg.ChildrenPerNode-1) != 0 {
		return NewProofVerificationFailedError(fmt.Errorf("Invalid number of SiblingHashes %v", len(sibH)))
	}
	keyAsPos, err := m.cfg.getDeepestPositionForKey(kvp.Key)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}
	leafPosition := m.cfg.getParentAtLevel(keyAsPos, uint(len(sibH)/(m.cfg.ChildrenPerNode-1)))

	// recompute the hash of the root node by recreating all the internal nodes
	// on the path from the leaf to the root.
	i := 0
	for _, childIndex := range m.cfg.positionToChildIndexPath(leafPosition) {
		sibHAtLevel := sibH[i : i+m.cfg.ChildrenPerNode-1]

		node := Node{INodes: make([]Hash, m.cfg.ChildrenPerNode)}
		copy(node.INodes, sibHAtLevel[:int(childIndex)])
		node.INodes[int(childIndex)] = nodeHash
		copy(node.INodes[int(childIndex)+1:], sibHAtLevel[int(childIndex):])

		i += m.cfg.ChildrenPerNode - 1
		_, nodeHash, err = m.cfg.Encoder.EncodeAndHashGeneric(node)
		if err != nil {
			return NewProofVerificationFailedError(err)
		}
	}

	// Compute the hash of the RootMetadata by filling in the BareRootHash
	// with the value computed above.
	rootMetadata := proof.RootMetadataNoHash
	rootMetadata.BareRootHash = nodeHash
	_, rootHash, err := m.cfg.Encoder.EncodeAndHashGeneric(rootMetadata)
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

func (m *MerkleProofVerifier) computeSkipsHashForSeqno(s Seqno, skipsMap map[Seqno]Hash) (Hash, error) {
	skipSeqnos := SkipPointersForSeqno(s)
	skips := make([]Hash, len(skipSeqnos))
	for i, s := range skipSeqnos {
		skip, found := skipsMap[s]
		if !found {
			return nil, fmt.Errorf("the skipsMap in the proof does not contain necessary hash of seqno %v ", s)
		}
		skips[i] = skip
	}
	_, hash, err := m.cfg.Encoder.EncodeAndHashGeneric(skips)
	if err != nil {
		return nil, fmt.Errorf("Error encoding %+v: %v", skips, err)
	}

	return hash, nil
}

// computeFinalSkipPointersHashFromPath recomputes the SkipPointersHash for all
// the seqnos on the SkipPointersPath(initialSeqno, finalSeqno), using the
// information contained in the proof and returns the last one, as well as a
// boolean indicating wether the proof is a full proof or is compressed (i.e. it
// is part of a MerkleInclusionExtensionProof).
func (m *MerkleProofVerifier) computeFinalSkipPointersHashFromPath(ctx logger.ContextInterface, proof *MerkleExtensionProof, initialSeqno Seqno, initialRootHash Hash, finalSeqno Seqno) (h Hash, isPartOfIncExtProof bool, err error) {
	rootHashMap := make(map[Seqno]Hash)
	rootHashes, err := ComputeRootHashSeqnosNeededInExtensionProof(initialSeqno, finalSeqno)
	if err != nil {
		return nil, false, NewProofVerificationFailedError(err)
	}
	if len(rootHashes) != len(proof.RootHashes) {
		return nil, false, NewProofVerificationFailedError(fmt.Errorf("The proof does not have the expected number of root hashes: exp %v, got %v", len(rootHashes), len(proof.RootHashes)))
	}
	for i, s := range rootHashes {
		rootHashMap[s] = proof.RootHashes[i]
	}

	rootMap := make(map[Seqno]RootMetadata)
	roots, err := ComputeRootMetadataSeqnosNeededInExtensionProof(initialSeqno, finalSeqno, true)
	if err != nil {
		return nil, false, NewProofVerificationFailedError(err)
	}
	if len(roots) == len(proof.PreviousRootsNoSkips) {
		// compressed proof
		isPartOfIncExtProof = true
	} else if len(roots) == len(proof.PreviousRootsNoSkips)-1 {
		// full proof
		isPartOfIncExtProof = false
	} else {
		// invalid proof
		return nil, false, NewProofVerificationFailedError(fmt.Errorf("The proof does not have the expected number of roots: exp %v or %v, got %v", len(roots), len(roots)+1, len(proof.PreviousRootsNoSkips)))
	}

	for i, s := range roots {
		rootMap[s] = proof.PreviousRootsNoSkips[i]
	}

	prevRootHash := initialRootHash
	prevSeqno := initialSeqno

	var currentSkipsHash Hash

	skipPath, err := SkipPointersPath(initialSeqno, finalSeqno)
	if err != nil {
		return nil, false, NewProofVerificationFailedError(err)
	}
	for i, currentSeqno := range skipPath {
		rootHashMap[prevSeqno] = prevRootHash

		currentSkipsHash, err = m.computeSkipsHashForSeqno(currentSeqno, rootHashMap)
		if err != nil {
			return nil, false, NewProofVerificationFailedError(err)
		}

		// the rest of the loop prepares for the next loop iteration, so we can
		// skip it the last time.
		if i == len(skipPath)-1 {
			break
		}

		currentMeta := rootMap[currentSeqno]
		currentMeta.SkipPointersHash = currentSkipsHash
		_, currRootHash, err := m.cfg.Encoder.EncodeAndHashGeneric(currentMeta)
		if err != nil {
			return nil, false, NewProofVerificationFailedError(err)
		}

		prevSeqno = currentSeqno
		prevRootHash = currRootHash
	}

	return currentSkipsHash, isPartOfIncExtProof, nil
}

func (m *MerkleProofVerifier) verifyExtensionProofFinal(ctx logger.ContextInterface, rootMetadata RootMetadata, skipsHash Hash, expRootHash Hash) error {
	rootMetadata.SkipPointersHash = skipsHash
	_, hash, err := m.cfg.Encoder.EncodeAndHashGeneric(rootMetadata)
	if err != nil {
		return NewProofVerificationFailedError(err)
	}
	if !hash.Equal(expRootHash) {
		return NewProofVerificationFailedError(fmt.Errorf("verifyExtensionProofFinal: hash mismatch %X != %X", expRootHash, hash))
	}
	return nil
}

func (m *MerkleProofVerifier) VerifyExtensionProof(ctx logger.ContextInterface, proof *MerkleExtensionProof, initialSeqno Seqno, initialRootHash Hash, finalSeqno Seqno, expRootHash Hash) error {
	if proof == nil {
		return NewProofVerificationFailedError(fmt.Errorf("nil proof"))
	}

	// Optimization: if initialSeqno == finalSeqno it is enough to compare
	// hashes, so if the proof is empty we can just do that.
	if initialSeqno == finalSeqno && len(proof.PreviousRootsNoSkips) == 0 && len(proof.RootHashes) == 0 {
		if initialRootHash.Equal(expRootHash) {
			return nil
		}
		return NewProofVerificationFailedError(fmt.Errorf("Hash mismatch: initialSeqno == finalSeqno == %v but %X != %X", initialSeqno, initialRootHash, expRootHash))
	}

	skipsHash, isPartOfIncExtProof, err := m.computeFinalSkipPointersHashFromPath(ctx, proof, initialSeqno, initialRootHash, finalSeqno)
	if err != nil {
		return err
	}
	if isPartOfIncExtProof {
		return NewProofVerificationFailedError(fmt.Errorf("The proof does not have the expected number of roots: it appears to be a compressed proof, but is not part of a MerkleInclusionExtensionProof"))
	}

	return m.verifyExtensionProofFinal(ctx, proof.PreviousRootsNoSkips[len(proof.PreviousRootsNoSkips)-1], skipsHash, expRootHash)
}

func (m *MerkleProofVerifier) VerifyInclusionExtensionProof(ctx logger.ContextInterface, kvp KeyValuePair, proof *MerkleInclusionExtensionProof, initialSeqno Seqno, initialRootHash Hash, finalSeqno Seqno, expRootHash Hash) (err error) {
	if proof == nil {
		return NewProofVerificationFailedError(fmt.Errorf("nil proof"))
	}

	// Shallow copy so that we can modify some fields without altering the original proof.
	incProof := proof.MerkleInclusionProof

	switch incProof.RootMetadataNoHash.Seqno {
	case finalSeqno:
		// pass
	case 0:
		// the seqno can be omitted for efficiency.
		incProof.RootMetadataNoHash.Seqno = finalSeqno
	default:
		return NewProofVerificationFailedError(fmt.Errorf("inclusion proof contains wrong Seqno: exp %v got %v", finalSeqno, incProof.RootMetadataNoHash.Seqno))
	}

	// If initialSeqno == finalSeqno, no extension proof is necessary so if it is not there we skip checking it.
	if initialSeqno != finalSeqno || len(proof.MerkleExtensionProof.PreviousRootsNoSkips) > 0 || len(proof.MerkleExtensionProof.PreviousRootsNoSkips) > 0 {
		skipsHashForNewRoot, isPartOfIncExtProof, err := m.computeFinalSkipPointersHashFromPath(ctx, &proof.MerkleExtensionProof, initialSeqno, initialRootHash, incProof.RootMetadataNoHash.Seqno)
		if err != nil {
			return err
		}

		if !isPartOfIncExtProof {
			// The server did not compress the inner extension proof, so we check it.
			err := m.verifyExtensionProofFinal(ctx, proof.PreviousRootsNoSkips[len(proof.PreviousRootsNoSkips)-1], skipsHashForNewRoot, expRootHash)
			if err != nil {
				return err
			}
		}

		// the server can also send a proof with an empty
		// proof.RootMetadataNoHash.SkipPointersHash. If this value is not sent, and
		// there was some other tampering, the skipsHashForNewRoot will cause the
		// inclusion proof to fail.
		if incProof.RootMetadataNoHash.SkipPointersHash != nil && !incProof.RootMetadataNoHash.SkipPointersHash.Equal(skipsHashForNewRoot) {
			return NewProofVerificationFailedError(
				fmt.Errorf("extension proof failed: expected %X but got %X", skipsHashForNewRoot, proof.RootMetadataNoHash.SkipPointersHash))
		}
		incProof.RootMetadataNoHash.SkipPointersHash = skipsHashForNewRoot
	}

	return m.VerifyInclusionProof(ctx, kvp, &incProof, expRootHash)
}
