package merkletree2

import (
	"bytes"
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

// BuildNewTreeVersionFromAllKeys builds a new tree version, taking a batch
// input. The sortedKeyValuePairs must be sorted (lexicographically) by Key.
//
// NOTE: The input to this function should contain at least all the keys which
// were inserted in previous versions of the tree, otherwise this procedure will
// put the tree into an inconsistent state. This function does not check the
// condition is true for efficiency reasons.
func (t *Tree) BuildNewTreeVersionFromAllKeys(
	ctx context.Context, sortedKVPairs []KeyValuePair) (err error) {
	t.Lock()
	defer t.Unlock()

	var tr Transaction
	if tr, err = t.eng.NewTransaction(ctx); err != nil {
		return err
	}

	var latestSeqNo Seqno
	var rootMNode RootMetadataNode
	if latestSeqNo, rootMNode, err = t.eng.LookupLatestRoot(ctx, tr); err != nil {
		t.eng.AbortTransaction(ctx, tr)
		return err
	}
	if latestSeqNo == 0 {
		t.log.CWarningf(ctx, "No root found. Starting a new merkle tree.")
	}

	var newRootHash Hash
	if newRootHash, err = t.hashTreeRecursive(ctx, tr, latestSeqNo+1,
		*t.getRootPosition(), sortedKVPairs); err != nil {
		t.eng.AbortTransaction(ctx, tr)
		return err
	}

	newRoot := t.makeNextRootMNode(&rootMNode, newRootHash)

	if err = t.eng.StoreRootMetadataNode(ctx, tr, newRoot); err != nil {
		t.eng.AbortTransaction(ctx, tr)
		return err
	}

	if err = t.eng.CommitTransaction(ctx, tr); err != nil {
		t.eng.AbortTransaction(ctx, tr)
		return err
	}

	return err
}

func (t *Tree) hashTreeRecursive(ctx context.Context, tr Transaction, s Seqno,
	p Position, sortedKVPairs []KeyValuePair) (ret Hash, err error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if len(sortedKVPairs) <= t.maxValuesPerLeaf {
		ret, err = t.makeAndStoreLeaf(ctx, tr, s, p, sortedKVPairs)
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
			ret, err = t.hashTreeRecursive(ctx, tr, s, childPos, sublist)
			if err != nil {
				return nil, err
			}
			// Note that some internal nodes might have some null children with
			// no hash. Each node will have at least one child (or one Key if it
			// is a leaf).
			node.INodes[i] = ret
		}
	}
	if ret, err = t.EncodeAndHash(node); err != nil {
		return nil, err
	}
	err = t.eng.StoreNode(ctx, tr, s, p, ret)
	return ret, err

}

// makeKeyHashPairsFromKeyValuePairs preserves ordering
func makeKeyHashPairsFromKeyValuePairs(unhashed []KeyValuePair, h Hasher) (hashed []KeyHashPair, hashes []Hash, err error) {
	hashed = make([]KeyHashPair, len(unhashed))
	hashes = make([]Hash, len(unhashed))

	for i, kv := range unhashed {
		var enc []byte
		if enc, err = encodeToBytes(kv); err != nil {
			return nil, nil, err
		}
		hashed[i].Key = kv.Key
		hashed[i].Hash = h.Hash(enc)
		hashes[i] = hashed[i].Hash
	}
	return hashed, hashes, nil
}

func (t *Tree) makeAndStoreLeaf(ctx context.Context, tr Transaction, s Seqno, p Position, sortedKVPairs []KeyValuePair) (ret Hash, err error) {

	khps, hashes, err := makeKeyHashPairsFromKeyValuePairs(sortedKVPairs, t.hasher)
	if err != nil {
		return nil, err
	}

	if err = t.eng.StoreKVPairs(ctx, tr, s, sortedKVPairs, hashes); err != nil {
		return nil, err
	}

	var leaf Node
	leaf.Type = NodeTypeLeaf
	leaf.LeafHashes = khps

	if ret, err = t.EncodeAndHash(leaf); err != nil {
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
func (t *Tree) GetKeyValuePairUnsafe(ctx context.Context, tr Transaction, s Seqno, k Key) (KeyValuePair, Hash, error) {
	if s == 0 {
		return KeyValuePair{}, Hash{}, NewInvalidSeqnoError("No keys stored at Seqno 0")
	}
	if len(k) != t.keysByteLength {
		return KeyValuePair{}, Hash{}, NewInvalidKeyError()
	}
	kvp, hash, err := t.eng.LookupKVPair(ctx, tr, s, k)
	if err != nil {
		return KeyValuePair{}, Hash{}, err
	}
	return kvp, hash, nil
}

// Retrieves a KeyValuePair from the tree. Note that if the root at Seqno s was
// not committed yet, an InvalidSeqnoError is returned.
func (t *Tree) GetKeyValuePair(ctx context.Context, tr Transaction, s Seqno, k Key) (KeyValuePair, Hash, error) {
	// Checking the Seqno was committed.
	_, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, Hash{}, err
	}

	return t.GetKeyValuePairUnsafe(ctx, tr, s, k)
}

type MerkleInclusionProof struct {
	OtherPairsInLeaf []KeyHashPair
	// SiblingHashesOnPath are ordered by level from the farthest to the closest
	// to the root, and lexicographically within each level.
	SiblingHashesOnPath []Hash
	rootNodeNoHash      RootMetadataNode
}

func (t *Tree) GetKeyValuePairWithProof(ctx context.Context, tr Transaction, s Seqno, k Key) (keyValuePair KeyValuePair, pairHash Hash, proof MerkleInclusionProof, err error) {

	// Lookup key value pair.
	kvp, kvpHash, err := t.GetKeyValuePair(ctx, tr, s, k)
	if err != nil {
		return KeyValuePair{}, Hash{}, MerkleInclusionProof{}, err
	}

	// Lookup the appropriate root.
	rootMNode, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, Hash{}, MerkleInclusionProof{}, err
	}
	proof.rootNodeNoHash = rootMNode
	// clear up hash to make the proof smaller.
	proof.rootNodeNoHash.BareRootHash = nil

	// Lookup hashes of siblings along the path.
	siblingPositions, err := t.getSiblingPositionsOnPathToKey(k)
	if err != nil {
		return KeyValuePair{}, Hash{}, MerkleInclusionProof{}, err
	}
	// Assumes nodes are returned in the same order in which they are being requested
	siblingPosHashPairs, err := t.eng.LookupNodes(ctx, tr, s, siblingPositions)
	if err != nil {
		return KeyValuePair{}, Hash{}, MerkleInclusionProof{}, err
	}
	// The level of the first sibling equals the level of the leaf node for the
	// key we are producing the proof for.
	leafLevel := t.getLevel(&(siblingPosHashPairs[0].p))
	deepestPosition, err := t.getDeepestPositionForKey(k)
	if err != nil {
		return KeyValuePair{}, Hash{}, MerkleInclusionProof{}, err
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
	//leafLevel := len(positionHashPairs) / (t.childrenPerNode - 1)
	//leafPos := t.getParentAtLevel(deepestPosition, uint(leafLevel))
	// These pairs are ordered by key
	khps, err := t.eng.LookupKeyHashPairsUnderPosition(ctx, tr, s, *leafPos)
	if err != nil {
		return KeyValuePair{}, Hash{}, MerkleInclusionProof{}, err
	}
	//Remove the key k (which we are making a proof for and thus does not need
	//to be part of the proof itself) from the slice.
	for i, khp := range khps {
		if khp.Key.Equal(k) {
			khps = append(khps[:i], khps[i+1:]...)
			break
		}
	}
	proof.OtherPairsInLeaf = khps

	return kvp, kvpHash, proof, nil
}

// GetLatestRoot returns the latest RootMetadataNode which was stored in the
// tree (and its Hash and Seqno). If no such record was stored yet,
// GetLatestRoot returns 0 as a Seqno and no error.
func (t *Tree) GetLatestRoot(ctx context.Context, tr Transaction) (s Seqno, root RootMetadataNode, rootHash Hash, err error) {
	s, root, err = t.eng.LookupLatestRoot(ctx, tr)
	if err != nil || s == 0 {
		return 0, RootMetadataNode{}, nil, err
	}
	rootHash, err = t.EncodeAndHash(root)
	if err != nil {
		return 0, RootMetadataNode{}, nil, err
	}

	return s, root, rootHash, nil
}
