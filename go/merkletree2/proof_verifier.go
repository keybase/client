package merkletree2

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

type MerkleProofVerifier struct {
	cfg Config
}

func NewMerkleProofVerifier(c Config) MerkleProofVerifier {
	return MerkleProofVerifier{cfg: c}
}

func (m *MerkleProofVerifier) VerifyInclusionProof(ctx logger.ContextInterface, kvp KeyValuePair, proof *MerkleInclusionProof, expRootHash Hash) (err error) {
	if kvp.Value == nil {
		return NewProofVerificationFailedError(fmt.Errorf("Keys cannot have nil values in the tree"))
	}
	return m.verifyInclusionOrExclusionProof(ctx, kvp, proof, expRootHash)
}

// VerifyExclusionProof uses a MerkleInclusionProof to assert that a specific key is not part of the tree
func (m *MerkleProofVerifier) VerifyExclusionProof(ctx logger.ContextInterface, k Key, proof *MerkleInclusionProof, expRootHash Hash) (err error) {
	return m.verifyInclusionOrExclusionProof(ctx, KeyValuePair{Key: k}, proof, expRootHash)
}

// if kvp.Value == nil, this functions checks that kvp.Key is not included in the tree. Otherwise, it checks that kvp is included in the tree.
func (m *MerkleProofVerifier) verifyInclusionOrExclusionProof(ctx logger.ContextInterface, kvp KeyValuePair, proof *MerkleInclusionProof, expRootHash Hash) (err error) {
	if proof == nil {
		return NewProofVerificationFailedError(fmt.Errorf("nil proof"))
	}

	var kvpHash Hash
	// Hash the key value pair if necessary
	if kvp.Value != nil {
		kvpHash, err = m.cfg.Encoder.HashKeyValuePairWithKeySpecificSecret(kvp, proof.KeySpecificSecret)
		if err != nil {
			return NewProofVerificationFailedError(err)
		}
	}

	if proof.RootMetadataNoHash.RootVersion != RootVersionV1 {
		return NewProofVerificationFailedError(libkb.NewAppOutdatedError(fmt.Errorf("RootVersion %v is not supported (this client can only handle V1)", proof.RootMetadataNoHash.RootVersion)))
	}

	if len(kvp.Key) != m.cfg.KeysByteLength {
		return NewProofVerificationFailedError(fmt.Errorf("Key has wrong length for this tree: %v (expected %v)", len(kvp.Key), m.cfg.KeysByteLength))
	}

	// inclusion proofs for existing values can have at most MaxValuesPerLeaf - 1
	// other pairs in the leaf, while exclusion proofs can have at most
	// MaxValuesPerLeaf.
	if (kvp.Value != nil && len(proof.OtherPairsInLeaf)+1 > m.cfg.MaxValuesPerLeaf) || (kvp.Value == nil && len(proof.OtherPairsInLeaf) > m.cfg.MaxValuesPerLeaf) {
		return NewProofVerificationFailedError(fmt.Errorf("Too many keys in leaf: %v > %v", len(proof.OtherPairsInLeaf)+1, m.cfg.MaxValuesPerLeaf))
	}

	// Reconstruct the leaf node if necessary
	var nodeHash Hash
	if kvp.Value != nil || proof.OtherPairsInLeaf != nil {
		valueToInsert := false
		leafHashesLength := len(proof.OtherPairsInLeaf)
		if kvp.Value != nil {
			leafHashesLength++
			valueToInsert = true
		}
		leaf := Node{LeafHashes: make([]KeyHashPair, leafHashesLength)}

		// LeafHashes is obtained by adding kvp into OtherPairsInLeaf while maintaining sorted order
		for i, j := 0, 0; i < leafHashesLength; i++ {
			if (j < len(proof.OtherPairsInLeaf) && valueToInsert && proof.OtherPairsInLeaf[j].Key.Cmp(kvp.Key) > 0) || j >= len(proof.OtherPairsInLeaf) {
				leaf.LeafHashes[i] = KeyHashPair{Key: kvp.Key, Hash: kvpHash}
				valueToInsert = false
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
		_, nodeHash, err = m.cfg.Encoder.EncodeAndHashGeneric(leaf)
		if err != nil {
			return NewProofVerificationFailedError(err)
		}
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
		return NewProofVerificationFailedError(fmt.Errorf("expected rootHash does not match the computed one (for key: %X, value: %v): expected %X but got %X", kvp.Key, kvp.Value, expRootHash, rootHash))
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
	// This function is annotated with an inline example.

	// We denote with Hi the hash of the RootMetadata Ri with seqno i.
	// Example inputs:
	// initialSeqno = 11
	// initialRootHash = H11
	// finalSeqno = 30
	// the proof contains:
	// - RootHashes = [ H8, H10, H14, H15, H24, H28, H29]
	// - PreviousRootsNoSkips = [R12, R16, (R30)] Note that R30 here is optional.
	//      We set isPartOfIncExtProof = true if it isn't there, but the output h is the same.

	// Note that:
	// SkipPointersPath(11,30) = [12,16,30]
	// SkipPointersForSeqno(12) = [8,10,11]
	// SkipPointersForSeqno(16) = [8,12,14,15]
	// SkipPointersForSeqno(30) = [16,24,28,29]

	rootHashMap := make(map[Seqno]Hash)
	rootHashSeqnos, err := ComputeRootHashSeqnosNeededInExtensionProof(initialSeqno, finalSeqno)
	// rootHashSeqnos = [8, 10, 14, 15, 24, 28, 29]
	if err != nil {
		return nil, false, NewProofVerificationFailedError(err)
	}
	if len(rootHashSeqnos) != len(proof.RootHashes) {
		return nil, false, NewProofVerificationFailedError(fmt.Errorf("The proof does not have the expected number of root hashes: exp %v, got %v", len(rootHashSeqnos), len(proof.RootHashes)))
	}
	for i, s := range rootHashSeqnos {
		rootHashMap[s] = proof.RootHashes[i]
	}
	// rootHashMap : { 8 -> H8, 10 -> H10, 14 -> H14, ... }

	rootMap := make(map[Seqno]RootMetadata)
	rootSeqnos, err := ComputeRootMetadataSeqnosNeededInExtensionProof(initialSeqno, finalSeqno, true)
	// rootSeqnos = [12, 16]
	if err != nil {
		return nil, false, NewProofVerificationFailedError(err)
	}
	if len(rootSeqnos) == len(proof.PreviousRootsNoSkips) {
		// compressed proof
		isPartOfIncExtProof = true
		// if len(proof.PreviousRootsNoSkips) == 2 (R30 is not there), we set isPartOfIncExtProof == true
	} else if len(rootSeqnos) == len(proof.PreviousRootsNoSkips)-1 {
		// full proof
		isPartOfIncExtProof = false
		// if len(proof.PreviousRootsNoSkips) == 3 (R30 is there), we set isPartOfIncExtProof == false
	} else {
		// invalid proof
		return nil, false, NewProofVerificationFailedError(fmt.Errorf("The proof does not have the expected number of roots: exp %v or %v, got %v", len(rootSeqnos), len(rootSeqnos)+1, len(proof.PreviousRootsNoSkips)))
	}

	for i, s := range rootSeqnos {
		if proof.PreviousRootsNoSkips[i].RootVersion != RootVersionV1 {
			return nil, false, NewProofVerificationFailedError(libkb.NewAppOutdatedError(fmt.Errorf("computeFinalSkipPointersHashFromPath: RootVersion %v at seqno %v is not supported (this client can only handle V1)", proof.PreviousRootsNoSkips[i].RootVersion, s)))
		}

		rootMap[s] = proof.PreviousRootsNoSkips[i]
	}
	// rootMap : { 12 -> R12, 16 -> R16}

	prevRootHash := initialRootHash
	// prevRootHash = H11
	prevSeqno := initialSeqno
	// prevSeqno = 11

	var currentSkipsHash Hash

	skipPath, err := SkipPointersPath(initialSeqno, finalSeqno)
	// SkipPointersPath(11,30) = [12,16,30]
	if err != nil {
		return nil, false, NewProofVerificationFailedError(err)
	}
	for i, currentSeqno := range skipPath {
		// We annotate this loop for i = 0, currentSeqno = 12

		rootHashMap[prevSeqno] = prevRootHash
		// rootHashMap : { 11 -> H11, 8 -> H8, 10 -> H10, 14 -> H14, ... }

		currentSkipsHash, err = m.computeSkipsHashForSeqno(currentSeqno, rootHashMap)
		// currentSkipsHash = SHA( [ H8, H10, H11 ] )
		// It is the expected value of SkipPointersHash for the root at currentSeqno = 12
		if err != nil {
			return nil, false, NewProofVerificationFailedError(err)
		}

		// the rest of the loop prepares for the next loop iteration, so we can
		// skip it the last time.
		if i == len(skipPath)-1 {
			break
		}

		currentMeta := rootMap[currentSeqno]
		// currentMeta = R12 (note that R12.SkipPointersHash = nil)
		currentMeta.SkipPointersHash = currentSkipsHash
		// set R12.SkipPointersHash to the value computed above
		_, currRootHash, err := m.cfg.Encoder.EncodeAndHashGeneric(currentMeta)
		// compute H12 (the expected hash of the root at seqno 12)
		if err != nil {
			return nil, false, NewProofVerificationFailedError(err)
		}

		prevSeqno = currentSeqno
		// prevSeqno = 12
		prevRootHash = currRootHash
		// prevRootHash = H12
	}
	// At the end of the loop, currentSkipsHash contains the expected
	// SkipPointersHash for the root at Seqno 30.

	return currentSkipsHash, isPartOfIncExtProof, nil
}

// verifyExtensionProofFinal inserts skipsHash as the SkipsPointersHash in
// rootMetadata, hashes it and checks that such hash matches expRootHash.
func (m *MerkleProofVerifier) verifyExtensionProofFinal(ctx logger.ContextInterface, rootMetadata RootMetadata, skipsHash Hash, expRootHash Hash) error {
	rootMetadata.SkipPointersHash = skipsHash
	if rootMetadata.RootVersion != RootVersionV1 {
		return NewProofVerificationFailedError(libkb.NewAppOutdatedError(fmt.Errorf("verifyExtensionProofFinal: RootVersion %v is not supported (this client can only handle V1)", rootMetadata.RootVersion)))
	}

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
	// Optimization: if initialSeqno == finalSeqno it is enough to compare
	// hashes, so if the proof is empty we can just do that.
	if initialSeqno == finalSeqno && (proof == nil || (len(proof.PreviousRootsNoSkips) == 0 && len(proof.RootHashes) == 0)) {
		if initialRootHash.Equal(expRootHash) {
			return nil
		}
		return NewProofVerificationFailedError(fmt.Errorf("Hash mismatch: initialSeqno == finalSeqno == %v but %X != %X", initialSeqno, initialRootHash, expRootHash))
	}

	if proof == nil {
		return NewProofVerificationFailedError(fmt.Errorf("nil proof"))
	}

	skipsHash, isPartOfIncExtProof, err := m.computeFinalSkipPointersHashFromPath(ctx, proof, initialSeqno, initialRootHash, finalSeqno)
	// For exmaple, if finalSeqno = 30, then skipsHash will be the expected
	// SkipPointersHash of the root at seqno 30 (i.e. SHA512([H16, H24, H28,
	// H29]) where Hi is the hash of the RootMetadata at seqno i)

	if err != nil {
		return err
	}
	if isPartOfIncExtProof {
		return NewProofVerificationFailedError(fmt.Errorf("The proof does not have the expected number of roots: it appears to be a compressed proof, but is not part of a MerkleInclusionExtensionProof"))
	}

	return m.verifyExtensionProofFinal(ctx, proof.PreviousRootsNoSkips[len(proof.PreviousRootsNoSkips)-1], skipsHash, expRootHash)
	// For exmaple, if finalSeqno = 30, this function uses the skipsHash above,
	// puts it inside RootMetadata at seqno 30, hashes it and checks the hash
	// matches expRootHash.
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
			err := m.verifyExtensionProofFinal(ctx, proof.MerkleExtensionProof.PreviousRootsNoSkips[len(proof.MerkleExtensionProof.PreviousRootsNoSkips)-1], skipsHashForNewRoot, expRootHash)
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
				fmt.Errorf("extension proof failed: expected %X but got %X", skipsHashForNewRoot, incProof.RootMetadataNoHash.SkipPointersHash))
		}
		incProof.RootMetadataNoHash.SkipPointersHash = skipsHashForNewRoot
	}

	return m.VerifyInclusionProof(ctx, kvp, &incProof, expRootHash)
}
