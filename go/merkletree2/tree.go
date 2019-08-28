package merkletree2

import (
	"bytes"
	"sort"
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// Tree is the MerkleTree class; it needs an engine and a configuration
// to run
type Tree struct {
	sync.RWMutex
	TreeConfig

	eng StorageEngine
	log logger.Logger
}

// NewTree makes a new tree
func NewTree(c TreeConfig, e StorageEngine, l logger.Logger) *Tree {
	return &Tree{TreeConfig: c, eng: e, log: l}
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
type Seqno int

// ChildIndex specifies one of an iNode's child nodes.
type ChildIndex int

// KeyValuePair is something the merkle tree can store. The key can be something
// like a UID or a TLF ID.  The Value is a generic interface, so you can store
// anything there, as long as it obeys Msgpack-decoding behavior.
type KeyValuePair struct {
	_struct struct{}    `codec:",toarray"`
	Key     Key         `codec:"k"`
	Value   interface{} `codec:"v"`
}

type KeyValuePairsOrderedByKey []KeyValuePair

func (k KeyValuePairsOrderedByKey) Len() int {
	return len(k)
}

func (k KeyValuePairsOrderedByKey) Less(i, j int) bool {
	return k[i].Key.Cmp(k[j].Key) < 0
}

func (k KeyValuePairsOrderedByKey) Swap(i, j int) {
	k[i], k[j] = k[j], k[i]
}

var _ sort.Interface = KeyValuePairsOrderedByKey{}

type KeyHashPair struct {
	_struct struct{} `codec:",toarray"`
	Key     Key      `codec:"k"`
	Hash    Hash     `codec:"h"`
}

// NodeType is used to distinguish internal nodes from leaves in the tree
type NodeType int

const (
	NodeTypeNone  NodeType = 0
	NodeTypeINode NodeType = 1
	NodeTypeLeaf  NodeType = 2
)

// Node is a node in the merkle tree. Can be either an interior iNode or a leaf.
// Internal nodes store the hashes of their children, while leaves store store
// KeyValuePairsHashed (the Value in each pair is not required to verify the
// hash of a a leaf node).
type Node struct {
	INodes     []Hash        `codec:"i,omitempty"`
	LeafHashes []KeyHashPair `codec:"l,omitempty"`
	Type       NodeType      `codec:"t"`
}

type PositionHashPair struct {
	p Position
	h Hash
}

type RootMetadataNode struct {
	// TODO Add skip pointers, timestamp, version.....
	Seqno        Seqno
	BareRootHash Hash
}

func (t *Tree) makeNextRootMNode(curr *RootMetadataNode, newRootHash Hash) RootMetadataNode {
	if curr == nil {
		return RootMetadataNode{Seqno: 1, BareRootHash: newRootHash}
	}
	return RootMetadataNode{Seqno: curr.Seqno + 1, BareRootHash: newRootHash}
}

func (t *Tree) GenerateAndStoreMasterSecret(
	ctx context.Context, tr Transaction, s Seqno) (ms MasterSecret, err error) {
	ms, err = t.hasher.GenerateMasterSecret(s)
	if err != nil {
		return nil, err
	}
	err = t.eng.StoreMasterSecret(ctx, tr, s, ms)
	if err != nil {
		return nil, err
	}
	return ms, nil
}

// BuildNewTreeVersionFromAllKeys builds a new tree version, taking a batch
// input. The sortedKeyValuePairs must be sorted (lexicographically) by Key.
//
// NOTE: The input to this function should contain at least all the keys which
// were inserted in previous versions of the tree, otherwise this procedure will
// put the tree into an inconsistent state. This function does not check the
// condition is true for efficiency reasons.
func (t *Tree) BuildNewTreeVersionFromAllKeys(
	ctx context.Context, tr Transaction, sortedKVPairs []KeyValuePair) (err error) {
	t.Lock()
	defer t.Unlock()

	var latestSeqNo Seqno
	var rootMNode RootMetadataNode
	if latestSeqNo, rootMNode, err = t.eng.LookupLatestRoot(ctx, tr); err != nil {
		return err
	}
	if latestSeqNo == 0 {
		t.log.CWarningf(ctx, "No root found. Starting a new merkle tree.")
	}

	var ms MasterSecret
	if t.useBlindedValueHashes {
		ms, err = t.GenerateAndStoreMasterSecret(ctx, tr, latestSeqNo+1)
		if err != nil {
			return err
		}
	} else {
		ms = nil
	}

	var newRootHash Hash
	if newRootHash, err = t.hashTreeRecursive(ctx, tr, latestSeqNo+1, ms,
		*t.getRootPosition(), sortedKVPairs); err != nil {
		return err
	}

	newRoot := t.makeNextRootMNode(&rootMNode, newRootHash)

	if err = t.eng.StoreRootMetadataNode(ctx, tr, newRoot); err != nil {
		return err
	}

	if err = t.eng.CommitTransaction(ctx, tr); err != nil {
		return err
	}

	return err
}

func (t *Tree) hashTreeRecursive(ctx context.Context, tr Transaction, s Seqno, ms MasterSecret,
	p Position, sortedKVPairs []KeyValuePair) (ret Hash, err error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if len(sortedKVPairs) <= t.maxValuesPerLeaf {
		ret, err = t.makeAndStoreLeaf(ctx, tr, s, ms, p, sortedKVPairs)
		return ret, err
	}

	var node Node
	node.Type = NodeTypeINode
	node.INodes = make([]Hash, t.childrenPerNode)

	j := 0
	for i := ChildIndex(0); i < ChildIndex(t.childrenPerNode); i++ {
		childPos := *t.getChild(&p, i)
		start := j
		for j < len(sortedKVPairs) && childPos.isOnPathToKey(sortedKVPairs[j].Key) {
			j++
		}
		end := j
		if start < end {
			sublist := sortedKVPairs[start:end]
			ret, err = t.hashTreeRecursive(ctx, tr, s, ms, childPos, sublist)
			if err != nil {
				return nil, err
			}
			// Note that some internal nodes might have some null children with
			// no hash. Each node will have at least one child (or one Key if it
			// is a leaf).
			node.INodes[i] = ret
		}
	}
	if ret, err = t.hasher.EncodeAndHashGeneric(node); err != nil {
		return nil, err
	}
	err = t.eng.StoreNode(ctx, tr, s, p, ret)
	return ret, err

}

// makeKeyHashPairsFromKeyValuePairs preserves ordering
func (t *Tree) makeKeyHashPairsFromKeyValuePairs(ms MasterSecret, s Seqno, unhashed []KeyValuePair) (hashed []KeyHashPair, err error) {
	hashed = make([]KeyHashPair, len(unhashed))

	for i, kvp := range unhashed {
		hash, err := t.hasher.HashKeyValuePairWithMasterSecret(kvp, s, ms)
		if err != nil {
			return nil, err
		}
		hashed[i].Key = kvp.Key
		hashed[i].Hash = hash
	}
	return hashed, nil
}

func (t *Tree) makeAndStoreLeaf(ctx context.Context, tr Transaction, s Seqno, ms MasterSecret, p Position, sortedKVPairs []KeyValuePair) (ret Hash, err error) {

	khps, err := t.makeKeyHashPairsFromKeyValuePairs(ms, s, sortedKVPairs)
	if err != nil {
		return nil, err
	}

	if err = t.eng.StoreKVPairs(ctx, tr, s, sortedKVPairs); err != nil {
		return nil, err
	}

	var leaf Node
	leaf.Type = NodeTypeLeaf
	leaf.LeafHashes = khps

	if ret, err = t.hasher.EncodeAndHashGeneric(leaf); err != nil {
		return nil, err
	}
	if err = t.eng.StoreNode(ctx, tr, s, p, ret); err != nil {
		return nil, err
	}
	return ret, err
}

// Retrieves a KeyValuePair from the tree. Note that if the root at Seqno s was
// not committed yet, there might be no proof for this pair yet (hence it is
// unsafe).
func (t *Tree) GetKeyValuePairUnsafe(ctx context.Context, tr Transaction, s Seqno, k Key) (kvp KeyValuePair, err error) {
	if s == 0 {
		return KeyValuePair{}, NewInvalidSeqnoError("No keys stored at Seqno 0")
	}
	if len(k) != t.keysByteLength {
		return KeyValuePair{}, NewInvalidKeyError()
	}
	kvp, _, err = t.eng.LookupKVPair(ctx, tr, s, k)
	if err != nil {
		return KeyValuePair{}, err
	}
	return kvp, nil
}

// Retrieves a KeyValuePair from the tree. Note that if the root at Seqno s was
// not committed yet, an InvalidSeqnoError is returned.
func (t *Tree) GetKeyValuePair(ctx context.Context, tr Transaction, s Seqno, k Key) (KeyValuePair, error) {
	// Checking the Seqno was committed.
	_, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, err
	}

	return t.GetKeyValuePairUnsafe(ctx, tr, s, k)
}

type MerkleInclusionProof struct {
	_struct           struct{} `codec:",toarray"`
	KeySpecificSecret KeySpecificSecret
	OtherPairsInLeaf  []KeyHashPair
	// SiblingHashesOnPath are ordered by level from the farthest to the closest
	// to the root, and lexicographically within each level.
	SiblingHashesOnPath []Hash
	RootNodeNoHash      RootMetadataNode
}

func (t *Tree) GetKeyValuePairWithProof(ctx context.Context, tr Transaction, s Seqno, k Key) (kvp KeyValuePair, proof MerkleInclusionProof, err error) {

	// Lookup the appropriate root.
	rootMNode, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	proof.RootNodeNoHash = rootMNode
	// clear up hash to make the proof smaller.
	proof.RootNodeNoHash.BareRootHash = nil

	// Lookup hashes of siblings along the path.
	siblingPositions, err := t.getSiblingPositionsOnPathToKey(k)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	// Assumes nodes are returned in the same order in which they are being requested
	siblingPosHashPairs, err := t.eng.LookupNodes(ctx, tr, s, siblingPositions)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	// The level of the first sibling equals the level of the leaf node for the
	// key we are producing the proof for.
	leafLevel := t.getLevel(&(siblingPosHashPairs[0].p))
	deepestPosition, err := t.getDeepestPositionForKey(k)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	leafPos := t.getParentAtLevel(deepestPosition, uint(leafLevel))
	proof.SiblingHashesOnPath = make([]Hash, leafLevel*(t.childrenPerNode-1))
	leafChildIndexes := t.positionToChildIndexes(leafPos)
	// Flatten the siblingPosHashPairs Hashes into a []Hash.
	for _, pos := range siblingPosHashPairs {
		if t.getDeepestChildIndex(&pos.p) < leafChildIndexes[leafLevel-t.getLevel(&pos.p)] {
			proof.SiblingHashesOnPath[(leafLevel-t.getLevel(&pos.p))*(t.childrenPerNode-1)+int(t.getDeepestChildIndex(&pos.p))] = pos.h
		} else {
			proof.SiblingHashesOnPath[(leafLevel-t.getLevel(&pos.p))*(t.childrenPerNode-1)+int(t.getDeepestChildIndex(&pos.p))-1] = pos.h
		}
	}

	// Lookup hashes of key value pairs stored at the same leaf.
	// These pairs are ordered by key.
	kvps, seqnos, err := t.eng.LookupKeyValuePairsUnderPosition(ctx, tr, s, *leafPos)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	var msMap map[Seqno]MasterSecret
	if t.useBlindedValueHashes {
		msMap, err = t.eng.LookupMasterSecrets(ctx, tr, seqnos)
		if err != nil {
			return KeyValuePair{}, MerkleInclusionProof{}, err
		}
	}
	proof.OtherPairsInLeaf = make([]KeyHashPair, len(kvps)-1)
	j := 0
	for i, kvpi := range kvps {
		if kvpi.Key.Equal(k) {
			kvp = kvpi
			if t.useBlindedValueHashes {
				proof.KeySpecificSecret = t.hasher.ComputeKeySpecificSecret(msMap[seqnos[i]], seqnos[i], kvp.Key)
			} else {
				proof.KeySpecificSecret = nil
			}
			continue
		}

		var hash Hash
		if t.useBlindedValueHashes {
			hash, err = t.hasher.HashKeyValuePairWithMasterSecret(kvpi, seqnos[i], msMap[seqnos[i]])
		} else {
			hash, err = t.hasher.HashKeyValuePairWithMasterSecret(kvpi, seqnos[i], nil)
		}
		if err != nil {
			return KeyValuePair{}, MerkleInclusionProof{}, err
		}
		proof.OtherPairsInLeaf[j] = KeyHashPair{Key: kvpi.Key, Hash: hash}
		j++
	}

	return kvp, proof, nil
}

// GetLatestRoot returns the latest RootMetadataNode which was stored in the
// tree (and its Hash and Seqno). If no such record was stored yet,
// GetLatestRoot returns 0 as a Seqno and no error.
func (t *Tree) GetLatestRoot(ctx context.Context, tr Transaction) (s Seqno, root RootMetadataNode, rootHash Hash, err error) {
	s, root, err = t.eng.LookupLatestRoot(ctx, tr)
	if err != nil || s == 0 {
		return 0, RootMetadataNode{}, nil, err
	}
	rootHash, err = t.hasher.EncodeAndHashGeneric(root)
	if err != nil {
		return 0, RootMetadataNode{}, nil, err
	}

	return s, root, rootHash, nil
}
