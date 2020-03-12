package merkletree2

import (
	"bytes"
	"fmt"
	"sort"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-codec/codec"
)

// Tree is the MerkleTree class; it needs an engine and a configuration
// to run
type Tree struct {
	sync.RWMutex

	cfg Config
	eng StorageEngine

	newRootVersion RootVersion

	// step is an optimization parameter for GetKeyValuePairWithProof that
	// controls how many path positions at a time the tree requests from the
	// storage engine. Lower values result in more storage engine requests, but
	// less of the (somewhat expensive) bit fiddling operations.  Values higher
	// than 63 are not recommended as the bit operations (in the best case)
	// cannot be done using a single 64 bit word and become more expensive. This
	// is unnecessary if the tree has random keys (as such a tree should be
	// approximately balanced and have short-ish paths).
	step int

	// these two fields are used as buffers during tree building to avoid making
	// many short lived memory allocations
	bufKss  KeySpecificSecret
	bufLeaf Node
}

// NewTree makes a new tree
func NewTree(c Config, step int, e StorageEngine, v RootVersion) (*Tree, error) {
	if c.UseBlindedValueHashes {
		_, ok := e.(StorageEngineWithBlinding)
		if !ok {
			return nil, fmt.Errorf("The config requires a StorageEngineWithBlinding implementation as a StorageEngine")
		}
	}
	if step < 1 {
		return nil, fmt.Errorf("step must be a positive integer")
	}

	return &Tree{cfg: c, eng: e, step: step, newRootVersion: v}, nil
}

// Hash is a byte-array, used to represent a full collision-resistant hash.
type Hash []byte

// Equal compares two hashes byte by byte
func (h Hash) Equal(h2 Hash) bool {
	return bytes.Equal(h, h2)
}

// Key is a byte-array, and it is the type of the keys in the KeyValuePairs that
// the tree can store.
type Key []byte

// Equal compares two keys byte by byte
func (k Key) Equal(k2 Key) bool {
	return bytes.Equal(k, k2)
}

// Cmp compares two keys lexicographically as byte slices
func (k Key) Cmp(k2 Key) int {
	return bytes.Compare(k, k2)
}

// Seqno is an integer used to differentiate different versions of a merkle tree.
type Seqno int64

type SeqnoSortedAsInt []Seqno

func (d SeqnoSortedAsInt) Len() int {
	return len(d)
}

func (d SeqnoSortedAsInt) Swap(i, j int) {
	d[i], d[j] = d[j], d[i]
}

func (d SeqnoSortedAsInt) Less(i, j int) bool {
	return d[i] < d[j]
}

// ChildIndex specifies one of an iNode's child nodes.
type ChildIndex int

// KeyValuePair is something the merkle tree can store. The key can be something
// like a UID or a TLF ID.  The Value is a generic interface, so you can store
// anything there, as long as it obeys Msgpack-decoding behavior. The Value must
// be of the same type returned by ValueConstructor in the TreeConfig, otherwise
// the behavior is undefined.
type KeyValuePair struct {
	_struct struct{}    `codec:",toarray"` //nolint
	Key     Key         `codec:"k"`
	Value   interface{} `codec:"v"`
}

type EncodedValue []byte

func (e EncodedValue) Equal(e2 EncodedValue) bool {
	return bytes.Equal(e, e2)
}

// KeyEncodedValuePair is similar to a KeyValuePair, but the values is encoded
// as a byte slice.
type KeyEncodedValuePair struct {
	_struct struct{}     `codec:",toarray"` //nolint
	Key     Key          `codec:"k"`
	Value   EncodedValue `codec:"v"`
}

type KeyHashPair struct {
	_struct struct{} `codec:",toarray"` //nolint
	Key     Key      `codec:"k"`
	Hash    Hash     `codec:"h"`
}

// NodeType is used to distinguish serialized internal nodes from leaves in the tree
type NodeType uint8

const (
	NodeTypeNone  NodeType = 0
	NodeTypeINode NodeType = 1
	NodeTypeLeaf  NodeType = 2
)

// A Node is either an internal node or a leaf: INodes and LeafHashes cannot
// both have length > 0 (else msgpack encoding will fail).
type Node struct {
	INodes     []Hash
	LeafHashes []KeyHashPair
}

var _ codec.Selfer = &Node{}

func (n *Node) CodecEncodeSelf(e *codec.Encoder) {
	if n.INodes != nil && n.LeafHashes != nil && len(n.INodes) > 0 && len(n.LeafHashes) > 0 {
		panic("Cannot Encode a node with both Inodes and LeafHashes")
	}

	if n.INodes != nil && len(n.INodes) > 0 {
		e.MustEncode(NodeTypeINode)
		e.MustEncode(n.INodes)
		return
	}

	// Note: we encode empty nodes (with empty or nil LeafHashes) as leaf nodes.
	// This is so we can represent a tree with no values as a single (empty)
	// leaf node.
	e.MustEncode(NodeTypeLeaf)
	// encode empty slices and nil slices equally
	if len(n.LeafHashes) == 0 {
		e.MustEncode([]KeyHashPair(nil))
	} else {
		e.MustEncode(n.LeafHashes)
	}
}

func (n *Node) CodecDecodeSelf(d *codec.Decoder) {
	var nodeType NodeType
	d.MustDecode(&nodeType)
	switch nodeType {
	case NodeTypeINode:
		d.MustDecode(&n.INodes)
	case NodeTypeLeaf:
		d.MustDecode(&n.LeafHashes)
	default:
		panic("Unrecognized NodeType")
	}
}

type PositionHashPair struct {
	_struct  struct{} `codec:",toarray"` //nolint
	Position Position `codec:"p"`
	Hash     Hash     `codec:"h"`
}

type RootVersion uint8

const (
	RootVersionV1      RootVersion = 1
	CurrentRootVersion RootVersion = RootVersionV1
)

type RootMetadata struct {
	_struct          struct{} `codec:",toarray"` //nolint
	RootVersion      RootVersion
	EncodingType     EncodingType
	Seqno            Seqno
	BareRootHash     Hash
	SkipPointersHash Hash

	//  AddOnsHash is the (currently empty) hash of a (not yet defined) data
	//  structure which will contain a map[string]Hash (or even
	//  map[string]interface{}) which can contain arbitrary values. This AddOn
	//  struct is not used in verifying proofs, and new elements can be added to
	//  this map without bumping the RootVersion. Clients are expected to ignore
	//  fields in this map which they do not understand.
	AddOnsHash Hash
}

func (t *Tree) makeNextRootMetadata(ctx logger.ContextInterface, tr Transaction, curr *RootMetadata, newRootHash Hash, addOnsHash Hash) (RootMetadata, error) {
	root := RootMetadata{
		RootVersion:  t.newRootVersion,
		EncodingType: t.cfg.Encoder.GetEncodingType(),
		BareRootHash: newRootHash,
		AddOnsHash:   addOnsHash,
	}

	// If there is no previous root, we do not need to include any skips, so
	// return early.
	if curr == nil || curr.Seqno == 0 {
		root.Seqno = 1
		return root, nil
	}

	newSeqno := curr.Seqno + 1
	skipSeqnos := SkipPointersForSeqno(newSeqno)

	skips, err := t.eng.LookupRootHashes(ctx, tr, skipSeqnos)
	if err != nil {
		return RootMetadata{}, fmt.Errorf("makeNextRootMetadata: error retrieving previous hashes %+v: %v", skipSeqnos, err)
	}

	_, skipsHash, err := t.cfg.Encoder.EncodeAndHashGeneric(skips)
	if err != nil {
		return RootMetadata{}, fmt.Errorf("makeNextRootMetadata: error encoding %+v, err: %v", skips, err)
	}

	root.Seqno = curr.Seqno + 1
	root.SkipPointersHash = skipsHash

	return root, nil
}

func (t *Tree) GenerateAndStoreMasterSecret(
	ctx logger.ContextInterface, tr Transaction, s Seqno) (ms MasterSecret, err error) {
	ms, err = t.cfg.Encoder.GenerateMasterSecret(s)
	if err != nil {
		return nil, err
	}
	err = t.eng.(StorageEngineWithBlinding).StoreMasterSecret(ctx, tr, s, ms)
	if err != nil {
		return nil, err
	}
	return ms, nil
}

func (t *Tree) encodeKVPairs(sortedKVPairs []KeyValuePair) (kevPairs []KeyEncodedValuePair, err error) {
	kevPairs = make([]KeyEncodedValuePair, len(sortedKVPairs))
	for i, kvp := range sortedKVPairs {
		v, err := t.cfg.Encoder.Encode(kvp.Value)
		if err != nil {
			return nil, err
		}
		kevPairs[i].Key = kvp.Key
		kevPairs[i].Value = EncodedValue(v)
	}
	return kevPairs, nil
}

// Build builds a new tree version, taking a batch input. The
// sortedKeyValuePairs must be sorted (lexicographically) by Key.
//
// NOTE: The input to this function should contain at least all the keys which
// were inserted in previous versions of the tree, and each key should only
// appear once, otherwise this procedure will put the tree into an inconsistent
// state. This function does not check the condition is true for efficiency
// reasons.
func (t *Tree) Build(
	ctx logger.ContextInterface, tr Transaction, sortedKVPairs []KeyValuePair, addOnsHash Hash) (s Seqno, rootHash Hash, err error) {
	t.Lock()
	defer t.Unlock()

	latestSeqNo, rootMetadata, err := t.eng.LookupLatestRoot(ctx, tr)
	switch err.(type) {
	case nil:
	case NoLatestRootFoundError:
		ctx.Debug("No root found. Starting a new merkle tree.")
		latestSeqNo = 0
		rootMetadata = RootMetadata{}
	default:
		return 0, nil, err
	}

	newSeqno := latestSeqNo + 1

	sortedKEVPairs, err := t.encodeKVPairs(sortedKVPairs)
	if err != nil {
		return 0, nil, err
	}

	if len(sortedKEVPairs) > 0 {
		if err = t.eng.StoreKEVPairs(ctx, tr, newSeqno, sortedKEVPairs); err != nil {
			return 0, nil, err
		}
	}

	var ms MasterSecret
	if t.cfg.UseBlindedValueHashes {
		ms, err = t.GenerateAndStoreMasterSecret(ctx, tr, newSeqno)
		if err != nil {
			return 0, nil, err
		}
	} else {
		ms = nil
	}

	var newBareRootHash Hash
	if newBareRootHash, err = t.hashTreeRecursive(ctx, tr, newSeqno, ms,
		t.cfg.GetRootPosition(), sortedKEVPairs); err != nil {
		return 0, nil, err
	}

	newRootMetadata, err := t.makeNextRootMetadata(ctx, tr, &rootMetadata, newBareRootHash, addOnsHash)
	if err != nil {
		return 0, nil, err
	}

	_, newRootHash, err := t.cfg.Encoder.EncodeAndHashGeneric(newRootMetadata)
	if err != nil {
		return 0, nil, err
	}

	if err = t.eng.StoreRootMetadata(ctx, tr, newRootMetadata, newRootHash); err != nil {
		return 0, nil, err
	}

	_, hash, err := t.cfg.Encoder.EncodeAndHashGeneric(newRootMetadata)

	return newSeqno, hash, err
}

func (t *Tree) hashTreeRecursive(ctx logger.ContextInterface, tr Transaction, s Seqno, ms MasterSecret,
	p *Position, sortedKEVPairs []KeyEncodedValuePair) (ret Hash, err error) {
	select {
	case <-ctx.Ctx().Done():
		return nil, ctx.Ctx().Err()
	default:
	}

	if len(sortedKEVPairs) <= t.cfg.MaxValuesPerLeaf {
		err = t.makeAndStoreLeaf(ctx, tr, s, ms, p, sortedKEVPairs, &ret)
		return ret, err
	}

	node := Node{INodes: make([]Hash, t.cfg.ChildrenPerNode)}

	pairsNotYetSelected := sortedKEVPairs
	var nextChild *Position
	for i, child := ChildIndex(0), t.cfg.GetChild(p, ChildIndex(0)); i < ChildIndex(t.cfg.ChildrenPerNode); i++ {
		var end int
		if i+1 < ChildIndex(t.cfg.ChildrenPerNode) {
			nextChild = t.cfg.GetChild(p, i+1)
			maxKey := t.cfg.getMinKey(nextChild)

			end = sort.Search(len(pairsNotYetSelected), func(n int) bool {
				return pairsNotYetSelected[n].Key.Cmp(maxKey) >= 0
			})
		} else {
			end = len(pairsNotYetSelected)
		}

		if end > 0 {
			pairsSelected := pairsNotYetSelected[0:end]
			pairsNotYetSelected = pairsNotYetSelected[end:]
			node.INodes[i], err = t.hashTreeRecursive(ctx, tr, s, ms, child, pairsSelected)
			if err != nil {
				return nil, err
			}
		}
		child = nextChild
	}
	if err = t.cfg.Encoder.HashGeneric(node, &ret); err != nil {
		return nil, err
	}
	err = t.eng.StoreNode(ctx, tr, s, p, ret)
	return ret, err
}

// makeKeyHashPairsFromKeyValuePairs preserves ordering
func (t *Tree) makeKeyHashPairsFromKeyValuePairs(ms MasterSecret, unhashed []KeyEncodedValuePair, node *Node) (err error) {
	if cap(node.LeafHashes) < len(unhashed) {
		node.LeafHashes = make([]KeyHashPair, len(unhashed))
	}
	node.LeafHashes = node.LeafHashes[:len(unhashed)]

	for i, kevp := range unhashed {
		t.cfg.Encoder.ComputeKeySpecificSecretTo(ms, kevp.Key, &t.bufKss)
		err = t.cfg.Encoder.HashKeyEncodedValuePairWithKeySpecificSecretTo(kevp, t.bufKss, &node.LeafHashes[i].Hash)
		if err != nil {
			return err
		}
		node.LeafHashes[i].Key = kevp.Key
	}
	return nil
}

func (t *Tree) makeAndStoreLeaf(ctx logger.ContextInterface, tr Transaction, s Seqno, ms MasterSecret, p *Position, sortedKEVPairs []KeyEncodedValuePair, ret *Hash) (err error) {

	err = t.makeKeyHashPairsFromKeyValuePairs(ms, sortedKEVPairs, &t.bufLeaf)
	if err != nil {
		return err
	}

	if err = t.cfg.Encoder.HashGeneric(t.bufLeaf, ret); err != nil {
		return err
	}
	if err = t.eng.StoreNode(ctx, tr, s, p, *ret); err != nil {
		return err
	}
	return nil
}

// Retrieves a KeyValuePair from the tree. Note that if the root at Seqno s was
// not committed yet, there might be no proof for this pair yet (hence it is
// unsafe).
func (t *Tree) GetKeyValuePairUnsafe(ctx logger.ContextInterface, tr Transaction, s Seqno, k Key) (kvp KeyValuePair, err error) {
	if s == 0 {
		return KeyValuePair{}, NewInvalidSeqnoError(0, fmt.Errorf("No keys stored at Seqno 0"))
	}
	if len(k) != t.cfg.KeysByteLength {
		return KeyValuePair{}, NewInvalidKeyError()
	}
	val, _, err := t.eng.LookupKEVPair(ctx, tr, s, k)
	if err != nil {
		return KeyValuePair{}, err
	}
	valContainer := t.cfg.ConstructValueContainer()
	err = t.cfg.Encoder.Decode(&valContainer, val)
	if err != nil {
		return KeyValuePair{}, err
	}
	return KeyValuePair{Key: k, Value: valContainer}, nil
}

// Retrieves a KeyValuePair from the tree. Note that if the root at Seqno s was
// not committed yet, an InvalidSeqnoError is returned.
func (t *Tree) GetKeyValuePair(ctx logger.ContextInterface, tr Transaction, s Seqno, k Key) (KeyValuePair, error) {
	// Checking the Seqno was committed.
	_, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, err
	}

	return t.GetKeyValuePairUnsafe(ctx, tr, s, k)
}

// A MerkleInclusionProof proves that a specific key value pair is stored in a
// merkle tree, given the RootMetadata hash of such tree. It can also be used to
// prove that a specific key is not part of the tree (we call this an exclusion
// or absence proof)
type MerkleInclusionProof struct {
	_struct           struct{}          `codec:",toarray"` //nolint
	KeySpecificSecret KeySpecificSecret `codec:"k"`
	// When this struct is used as an exclusion proof, OtherPairsInLeaf is set
	// to nil if the proof ends at an internal node, and set to a slice of
	// length 0 or more if the proof ends at a (possibly empty) leaf node. In
	// particular, a tree with no keys is encoded with the root being the only
	// (empty leaf) node.
	OtherPairsInLeaf []KeyHashPair `codec:"l"`
	// SiblingHashesOnPath are ordered by level from the farthest to the closest
	// to the root, and lexicographically within each level.
	SiblingHashesOnPath []Hash       `codec:"s"`
	RootMetadataNoHash  RootMetadata `codec:"e"`
}

// A MerkleExtensionProof proves, given the RootMetadata hashes of two merkle
// trees and their respective Seqno values, that: - the two merkle trees have
// the expected Seqno values, - the most recent merkle tree "points back" to the
// least recent one through a chain of SkipPointers that refer to merkle trees
// at intermediate Seqnos.
type MerkleExtensionProof struct {
	_struct              struct{}       `codec:",toarray"` //nolint
	RootHashes           []Hash         `codec:"h"`
	PreviousRootsNoSkips []RootMetadata `codec:"k"`
}

// An MerkleInclusionExtensionProof combines a MerkleInclusionProof and a
// MerkleExtensionProof. The redundant fields are deleted so that sending a
// combined proof is more efficient than sending both of them individually.
type MerkleInclusionExtensionProof struct {
	_struct              struct{} `codec:",toarray"` //nolint
	MerkleInclusionProof MerkleInclusionProof
	MerkleExtensionProof MerkleExtensionProof
}

// This type orders positionHashPairs by position, more specificelly first by
// level descending (nodes with higher level first) and then within each level
// in ascending order. This is the order required by the merkle proof verifier
// to easily reconstruct a path.
type PosHashPairsInMerkleProofOrder []PositionHashPair

func (p PosHashPairsInMerkleProofOrder) Len() int {
	return len(p)
}

func (p PosHashPairsInMerkleProofOrder) Less(i, j int) bool {
	return p[i].Position.CmpInMerkleProofOrder(&(p[j].Position)) < 0
}

func (p PosHashPairsInMerkleProofOrder) Swap(i, j int) {
	p[i], p[j] = p[j], p[i]
}

var _ sort.Interface = PosHashPairsInMerkleProofOrder{}

// If the key is not in the tree at the root with the specified hash, this function returns a nil value, a proof
// which certifies that and no error.
func (t *Tree) GetEncodedValueWithInclusionOrExclusionProofFromRootHash(ctx logger.ContextInterface, tr Transaction, rootHash Hash, k Key) (val EncodedValue, proof MerkleInclusionProof, err error) {
	// Lookup the appropriate root.
	rootMetadata, err := t.eng.LookupRootFromHash(ctx, tr, rootHash)
	if err != nil {
		return nil, MerkleInclusionProof{}, err
	}
	return t.getEncodedValueWithInclusionProofOrExclusionProof(ctx, tr, rootMetadata, k)
}

// If the key is not in the tree at seqno s, this function returns a KeyNotFoundError and no absence proof.
func (t *Tree) GetEncodedValueWithInclusionProof(ctx logger.ContextInterface, tr Transaction, s Seqno, k Key) (val EncodedValue, proof MerkleInclusionProof, err error) {
	// Lookup the appropriate root.
	rootMetadata, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return nil, MerkleInclusionProof{}, err
	}
	val, proof, err = t.getEncodedValueWithInclusionProofOrExclusionProof(ctx, tr, rootMetadata, k)
	if err != nil {
		return nil, MerkleInclusionProof{}, err
	}
	if val == nil {
		return nil, MerkleInclusionProof{}, NewKeyNotFoundError()
	}
	return val, proof, nil
}

// if the key is not in the tree, this function returns a nil value, a proof
// which certifies that and no error.
func (t *Tree) getEncodedValueWithInclusionProofOrExclusionProof(ctx logger.ContextInterface, tr Transaction, rootMetadata RootMetadata, k Key) (val EncodedValue, proof MerkleInclusionProof, err error) {
	if len(k) != t.cfg.KeysByteLength {
		return nil, MerkleInclusionProof{}, fmt.Errorf("The supplied key has the wrong length: exp %v, got %v", t.cfg.KeysByteLength, len(k))
	}

	s := rootMetadata.Seqno
	proof.RootMetadataNoHash = rootMetadata
	// clear up hash to make the proof smaller.
	proof.RootMetadataNoHash.BareRootHash = nil

	var siblingPosHashPairs []PositionHashPair
	needMore := true
	for curr := 1; needMore && curr <= t.cfg.MaxDepth; curr += t.step + 1 {
		// The first element is the position at level curr+step on the path from
		// the root to k (on a complete tree). The next ones are all the
		// necessary siblings at levels from curr+step to curr (both included)
		// on such path.
		deepestAndCurrSiblingPositions := t.cfg.getDeepestPositionAtLevelAndSiblingsOnPathToKey(k, curr+t.step, curr)
		deepestAndCurrSiblings, err := t.eng.LookupNodes(ctx, tr, s, deepestAndCurrSiblingPositions)
		if err != nil {
			return nil, MerkleInclusionProof{}, err
		}

		sort.Sort(PosHashPairsInMerkleProofOrder(deepestAndCurrSiblings))

		var currSiblings []PositionHashPair
		// if we found a PositionHashPair corrisponding to the first element in
		// deepestAndCurrSiblingPositions, it means the path might be deeper and we
		// need to fetch more siblings.
		candidateDeepest := len(deepestAndCurrSiblings)
		if len(deepestAndCurrSiblings) > 0 {
			candidateDeepest = sort.Search(len(deepestAndCurrSiblings), func(i int) bool {
				return deepestAndCurrSiblings[i].Position.CmpInMerkleProofOrder(&deepestAndCurrSiblingPositions[0]) >= 0
			})
		}
		if candidateDeepest < len(deepestAndCurrSiblings) && deepestAndCurrSiblings[candidateDeepest].Position.Equals(&deepestAndCurrSiblingPositions[0]) {
			currSiblings = deepestAndCurrSiblings[:candidateDeepest]
			currSiblings = append(currSiblings, deepestAndCurrSiblings[candidateDeepest+1:]...)
		} else {
			currSiblings = deepestAndCurrSiblings
			needMore = false
		}
		siblingPosHashPairs = append(currSiblings, siblingPosHashPairs...)
	}

	var leafLevel int
	if len(siblingPosHashPairs) == 0 {
		// If there are no siblings, the key must be stored on the root
		leafLevel = 0
	} else {
		// The level of the first sibling equals the level of the leaf node for the
		// key we are producing the proof for.
		leafLevel = t.cfg.getLevel(&(siblingPosHashPairs[0].Position))
	}

	deepestPosition, err := t.cfg.getDeepestPositionForKey(k)
	if err != nil {
		return nil, MerkleInclusionProof{}, err
	}
	leafPos := t.cfg.getParentAtLevel(deepestPosition, uint(leafLevel))

	proof.SiblingHashesOnPath = make([]Hash, leafLevel*(t.cfg.ChildrenPerNode-1))
	leafChildIndexes := t.cfg.positionToChildIndexPath(leafPos)
	// Flatten the siblingPosHashPairs Hashes into a []Hash.
	for _, pos := range siblingPosHashPairs {
		if t.cfg.getDeepestChildIndex(&pos.Position) < leafChildIndexes[leafLevel-t.cfg.getLevel(&pos.Position)] {
			proof.SiblingHashesOnPath[(leafLevel-t.cfg.getLevel(&pos.Position))*(t.cfg.ChildrenPerNode-1)+int(t.cfg.getDeepestChildIndex(&pos.Position))] = pos.Hash
		} else {
			proof.SiblingHashesOnPath[(leafLevel-t.cfg.getLevel(&pos.Position))*(t.cfg.ChildrenPerNode-1)+int(t.cfg.getDeepestChildIndex(&pos.Position))-1] = pos.Hash
		}
	}

	var kevps []KeyEncodedValuePair

	// We have two cases: either the node at leafPos is actually a leaf
	// (which might or not contain the key which we are trying to look up),
	// or such node does not exists at all (which happens only if the key we
	// are looking up is not part of the tree at that seqno).
	_, err = t.eng.LookupNode(ctx, tr, s, leafPos)
	if err != nil {
		// NodeNotFoundError is ignored as the inclusion proof we
		// produce will prove that the key is not in the tree.
		if _, nodeNotFound := err.(NodeNotFoundError); !nodeNotFound {
			return nil, MerkleInclusionProof{}, err
		}
	} else {
		if t.cfg.MaxValuesPerLeaf == 1 {
			// Try to avoid LookupKEVPairsUnderPosition if possible as it is a range
			// query and thus more expensive.
			kevp, _, err := t.eng.LookupKEVPair(ctx, tr, s, k)
			if err != nil {
				// KeyNotFoundError is ignored as the inclusion proof we
				// produce will prove that the key is not in the tree.
				if _, keyNotFound := err.(KeyNotFoundError); !keyNotFound {
					return nil, MerkleInclusionProof{}, err
				}
			} else {
				kevps = append(kevps, KeyEncodedValuePair{Key: k, Value: kevp})
			}
		}

		// if len(kevps)>0, then MaxValuesPerLeaf == 1 and we found the key we
		// are looking for, so there is no need to look for other keys under
		// leafPos.
		if len(kevps) == 0 {
			// Lookup hashes of key value pairs stored at the same leaf.
			// These pairs are ordered by key.
			kevps, _, err = t.eng.LookupKEVPairsUnderPosition(ctx, tr, s, leafPos)
			if err != nil {
				// KeyNotFoundError is ignored. This would happen when we are
				// trying to produce an absence proof on an empty tree: there
				// would be a leaf node containing no keys.
				if _, keyNotFound := err.(KeyNotFoundError); !keyNotFound {
					return nil, MerkleInclusionProof{}, err
				}
				kevps = make([]KeyEncodedValuePair, 0)
			}
		}
	}

	var ms MasterSecret
	if t.cfg.UseBlindedValueHashes && len(kevps) > 0 {
		msMap, err := t.eng.(StorageEngineWithBlinding).LookupMasterSecrets(ctx, tr, []Seqno{s})
		if err != nil {
			return nil, MerkleInclusionProof{}, err
		}
		ms = msMap[s]
	}

	// OtherPairsInLeaf will have length equal to kevps - 1  in an inclusion
	// proof, and kevps in an absence proof.
	if kevps != nil {
		proof.OtherPairsInLeaf = make([]KeyHashPair, 0, len(kevps))
	}
	for _, kevpi := range kevps {
		if kevpi.Key.Equal(k) {
			val = kevpi.Value
			if t.cfg.UseBlindedValueHashes {
				proof.KeySpecificSecret = t.cfg.Encoder.ComputeKeySpecificSecret(ms, k)
			} else {
				proof.KeySpecificSecret = nil
			}
			continue
		}

		var hash Hash
		hash, err = t.cfg.Encoder.HashKeyEncodedValuePairWithKeySpecificSecret(kevpi, t.cfg.Encoder.ComputeKeySpecificSecret(ms, kevpi.Key))
		if err != nil {
			return nil, MerkleInclusionProof{}, err
		}
		proof.OtherPairsInLeaf = append(proof.OtherPairsInLeaf, KeyHashPair{Key: kevpi.Key, Hash: hash})
	}

	return val, proof, nil
}

func (t *Tree) GetKeyValuePairWithProof(ctx logger.ContextInterface, tr Transaction, s Seqno, k Key) (kvp KeyValuePair, proof MerkleInclusionProof, err error) {
	val, proof, err := t.GetEncodedValueWithInclusionProof(ctx, tr, s, k)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}

	valContainer := t.cfg.ConstructValueContainer()
	err = t.cfg.Encoder.Decode(&valContainer, val)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	kvp = KeyValuePair{Key: k, Value: valContainer}

	return kvp, proof, nil
}

func (t *Tree) getExtensionProof(ctx logger.ContextInterface, tr Transaction, fromSeqno, toSeqno Seqno, isPartOfIncExtProof bool) (proof MerkleExtensionProof, err error) {
	// Optimization: no proof is required to show something extends itself.
	if fromSeqno == toSeqno {
		return MerkleExtensionProof{}, nil
	}

	seqnos, err := ComputeRootHashSeqnosNeededInExtensionProof(fromSeqno, toSeqno)
	if err != nil {
		return MerkleExtensionProof{}, err
	}
	hashes, err := t.eng.LookupRootHashes(ctx, tr, seqnos)
	if err != nil {
		return MerkleExtensionProof{}, err
	}

	seqnos, err = ComputeRootMetadataSeqnosNeededInExtensionProof(fromSeqno, toSeqno, isPartOfIncExtProof)
	if err != nil {
		return MerkleExtensionProof{}, err
	}
	roots, err := t.eng.LookupRoots(ctx, tr, seqnos)
	if err != nil {
		return MerkleExtensionProof{}, err
	}

	proof.RootHashes = hashes
	proof.PreviousRootsNoSkips = roots

	return proof, nil
}

func (t *Tree) GetExtensionProof(ctx logger.ContextInterface, tr Transaction, fromSeqno, toSeqno Seqno) (proof MerkleExtensionProof, err error) {
	return t.getExtensionProof(ctx, tr, fromSeqno, toSeqno, false)
}

func (t *Tree) GetEncodedValueWithInclusionExtensionProof(ctx logger.ContextInterface, tr Transaction, haveSeqno, wantSeqno Seqno, k Key) (val EncodedValue, proof MerkleInclusionExtensionProof, err error) {
	val, incProof, err := t.GetEncodedValueWithInclusionProof(ctx, tr, wantSeqno, k)
	if err != nil {
		return nil, MerkleInclusionExtensionProof{}, err
	}
	proof.MerkleInclusionProof = incProof

	if haveSeqno != wantSeqno {
		// clear these fields to save bandwidth, they are redundant when an
		// inclusion proof is paired with an extension proof. Note that if
		// haveSeqno == wantSeqno, we don't do this optimization as the
		// extension proof is skipped.
		proof.MerkleInclusionProof.RootMetadataNoHash.SkipPointersHash = nil
		proof.MerkleInclusionProof.RootMetadataNoHash.Seqno = Seqno(0)
	}

	extProof, err := t.getExtensionProof(ctx, tr, haveSeqno, wantSeqno, true)
	if err != nil {
		return nil, MerkleInclusionExtensionProof{}, err
	}

	// clear these fields to save bandwidth
	for i := range extProof.PreviousRootsNoSkips {
		extProof.PreviousRootsNoSkips[i].SkipPointersHash = nil
	}

	proof.MerkleExtensionProof = extProof
	return val, proof, err
}

func (t *Tree) GetKeyValuePairWithInclusionExtensionProof(ctx logger.ContextInterface, tr Transaction, haveSeqno, wantSeqno Seqno, k Key) (kvp KeyValuePair, proof MerkleInclusionExtensionProof, err error) {
	val, proof, err := t.GetEncodedValueWithInclusionExtensionProof(ctx, tr, haveSeqno, wantSeqno, k)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionExtensionProof{}, err
	}

	valContainer := t.cfg.ConstructValueContainer()
	err = t.cfg.Encoder.Decode(&valContainer, val)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionExtensionProof{}, err
	}
	kvp = KeyValuePair{Key: k, Value: valContainer}

	return kvp, proof, nil
}

func (t *Tree) ExecTransaction(ctx logger.ContextInterface, txFn func(logger.ContextInterface, Transaction) error) error {
	return t.eng.ExecTransaction(ctx, txFn)
}

// GetLatestRoot returns the latest RootMetadata which was stored in the
// tree (and its Hash and Seqno). If no such record was stored yet,
// GetLatestRoot returns 0 as a Seqno and a NoLatestRootFound error.
func (t *Tree) GetLatestRoot(ctx logger.ContextInterface, tr Transaction) (s Seqno, root RootMetadata, rootHash Hash, err error) {
	s, root, err = t.eng.LookupLatestRoot(ctx, tr)
	if err != nil || s == 0 {
		return 0, RootMetadata{}, nil, err
	}
	_, rootHash, err = t.cfg.Encoder.EncodeAndHashGeneric(root)
	if err != nil {
		return 0, RootMetadata{}, nil, err
	}

	return s, root, rootHash, nil
}
