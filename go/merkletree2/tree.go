package merkletree2

import (
	"bytes"
	"fmt"
	"math/big"
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

	// step is an optimization parameter for GetKeyValuePairWithProof that
	// controls how many path positions at a time the tree requests from the
	// storage engine. Lower values result in more storage engine requests, but
	// less of the (somewhat expensive) bit fiddling operations.  Values higher
	// than 63 are not recommended as the bit operations (in the best case)
	// cannot be done using a single 64 bit word and become more expensive. This
	// is unnecessary if the tree has random keys (as such a tree should be
	// approximately balanced and have short-ish paths).
	step int
}

// NewTree makes a new tree
func NewTree(c Config, step int, e StorageEngine) (*Tree, error) {
	if c.UseBlindedValueHashes {
		_, ok := e.(StorageEngineWithBlinding)
		if !ok {
			return nil, fmt.Errorf("The config requires a StorageEngineWithBlinding implementation as a StorageEngine")
		}
	}
	if step < 1 {
		return nil, fmt.Errorf("step must be a positive integer")
	}

	return &Tree{cfg: c, eng: e, step: step}, nil
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
	} else if n.INodes != nil && len(n.INodes) > 0 {
		e.MustEncode(NodeTypeINode)
		e.MustEncode(n.INodes)
	} else if n.LeafHashes != nil && len(n.LeafHashes) > 0 {
		e.MustEncode(NodeTypeLeaf)
		e.MustEncode(n.LeafHashes)
	} else {
		e.MustEncode(nil)
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

type RootMetadata struct {
	// TODO Add timestamp, version.....
	_struct          struct{} `codec:",toarray"` //nolint
	Seqno            Seqno    `codec:"n"`
	BareRootHash     Hash     `codec:"r"`
	SkipPointersHash Hash     `codec:"s"`
}

func (t *Tree) makeNextRootMetadata(curr *RootMetadata, newRootHash Hash) RootMetadata {
	if curr == nil {
		return RootMetadata{Seqno: 1, BareRootHash: newRootHash}
	}
	return RootMetadata{Seqno: curr.Seqno + 1, BareRootHash: newRootHash}
}

func (t *Tree) GenerateAndStoreMasterSecret(
	ctx logger.CtxAndLogger, tr Transaction, s Seqno) (ms MasterSecret, err error) {
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
	ctx logger.CtxAndLogger, tr Transaction, sortedKVPairs []KeyValuePair) (s Seqno, rootHash Hash, err error) {
	t.Lock()
	defer t.Unlock()

	latestSeqNo, rootMetadata, err := t.eng.LookupLatestRoot(ctx, tr)
	if err != nil {
		if _, isNoLatestRootFoundError := err.(NoLatestRootFoundError); isNoLatestRootFoundError {
			ctx.Debug("No root found. Starting a new merkle tree.")
			latestSeqNo = 0
			rootMetadata = RootMetadata{}
		} else {
			return 0, nil, err
		}
	}

	newSeqno := latestSeqNo + 1

	sortedKEVPairs, err := t.encodeKVPairs(sortedKVPairs)
	if err != nil {
		return 0, nil, err
	}

	if err = t.eng.StoreKEVPairs(ctx, tr, newSeqno, sortedKEVPairs); err != nil {
		return 0, nil, err
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
		t.cfg.getRootPosition(), sortedKEVPairs); err != nil {
		return 0, nil, err
	}

	newRootMetadata := t.makeNextRootMetadata(&rootMetadata, newBareRootHash)

	if err = t.eng.StoreRootMetadata(ctx, tr, newRootMetadata); err != nil {
		return 0, nil, err
	}

	_, hash, err := t.cfg.Encoder.EncodeAndHashGeneric(newRootMetadata)

	return newSeqno, hash, err
}

func (t *Tree) hashTreeRecursive(ctx logger.CtxAndLogger, tr Transaction, s Seqno, ms MasterSecret,
	p *Position, sortedKEVPairs []KeyEncodedValuePair) (ret Hash, err error) {
	select {
	case <-ctx.Ctx().Done():
		return nil, ctx.Ctx().Err()
	default:
	}

	if len(sortedKEVPairs) <= t.cfg.MaxValuesPerLeaf {
		ret, err = t.makeAndStoreLeaf(ctx, tr, s, ms, p, sortedKEVPairs)
		return ret, err
	}

	node := Node{INodes: make([]Hash, t.cfg.ChildrenPerNode)}

	pairsNotYetSelected := sortedKEVPairs
	var nextChild *Position
	for i, child := ChildIndex(0), t.cfg.getChild(p, ChildIndex(0)); i < ChildIndex(t.cfg.ChildrenPerNode); i++ {
		var end int
		if i+1 < ChildIndex(t.cfg.ChildrenPerNode) {
			nextChild = t.cfg.getChild(p, i+1)
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
			ret, err = t.hashTreeRecursive(ctx, tr, s, ms, child, pairsSelected)
			if err != nil {
				return nil, err
			}
			// Note that some internal nodes might have some null children with
			// no hash. Each node will have at least one child (or one Key if it
			// is a leaf).
			node.INodes[i] = ret
		}
		child = nextChild
	}
	if _, ret, err = t.cfg.Encoder.EncodeAndHashGeneric(node); err != nil {
		return nil, err
	}
	err = t.eng.StoreNode(ctx, tr, s, p, ret)
	return ret, err

}

// makeKeyHashPairsFromKeyValuePairs preserves ordering
func (t *Tree) makeKeyHashPairsFromKeyValuePairs(ms MasterSecret, unhashed []KeyEncodedValuePair) (hashed []KeyHashPair, err error) {
	hashed = make([]KeyHashPair, len(unhashed))

	for i, kevp := range unhashed {
		hash, err := t.cfg.Encoder.HashKeyEncodedValuePairWithKeySpecificSecret(kevp, t.cfg.Encoder.ComputeKeySpecificSecret(ms, kevp.Key))
		if err != nil {
			return nil, err
		}
		hashed[i].Key = kevp.Key
		hashed[i].Hash = hash
	}
	return hashed, nil
}

func (t *Tree) makeAndStoreLeaf(ctx logger.CtxAndLogger, tr Transaction, s Seqno, ms MasterSecret, p *Position, sortedKEVPairs []KeyEncodedValuePair) (ret Hash, err error) {

	khps, err := t.makeKeyHashPairsFromKeyValuePairs(ms, sortedKEVPairs)
	if err != nil {
		return nil, err
	}

	leaf := Node{LeafHashes: khps}

	if _, ret, err = t.cfg.Encoder.EncodeAndHashGeneric(leaf); err != nil {
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
func (t *Tree) GetKeyValuePairUnsafe(ctx logger.CtxAndLogger, tr Transaction, s Seqno, k Key) (kvp KeyValuePair, err error) {
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
func (t *Tree) GetKeyValuePair(ctx logger.CtxAndLogger, tr Transaction, s Seqno, k Key) (KeyValuePair, error) {
	// Checking the Seqno was committed.
	_, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, err
	}

	return t.GetKeyValuePairUnsafe(ctx, tr, s, k)
}

type MerkleInclusionProof struct {
	_struct           struct{}          `codec:",toarray"` //nolint
	KeySpecificSecret KeySpecificSecret `codec:"k"`
	OtherPairsInLeaf  []KeyHashPair     `codec:"l"`
	// SiblingHashesOnPath are ordered by level from the farthest to the closest
	// to the root, and lexicographically within each level.
	SiblingHashesOnPath []Hash       `codec:"s"`
	RootMetadataNoHash  RootMetadata `codec:"e"`
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
	li := (*big.Int)(&(p[i].Position)).BitLen()
	lj := (*big.Int)(&(p[j].Position)).BitLen()
	if li > lj {
		return true
	} else if li < lj {
		return false
	}
	return (*big.Int)(&(p[i].Position)).CmpAbs((*big.Int)(&(p[j].Position))) < 0
}

func (p PosHashPairsInMerkleProofOrder) Swap(i, j int) {
	p[i], p[j] = p[j], p[i]
}

var _ sort.Interface = PosHashPairsInMerkleProofOrder{}

func (t *Tree) GetKeyValuePairWithProof(ctx logger.CtxAndLogger, tr Transaction, s Seqno, k Key) (kvp KeyValuePair, proof MerkleInclusionProof, err error) {

	// Lookup the appropriate root.
	rootMetadata, err := t.eng.LookupRoot(ctx, tr, s)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
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
			return KeyValuePair{}, MerkleInclusionProof{}, err
		}

		var currSiblings []PositionHashPair
		// if we found a PositionHashPair corrisponding to the first element in
		// deepestAndCurrSiblingPositions, it means the path might be deeper and we
		// need to fetch more siblings.
		if len(deepestAndCurrSiblings) > 0 && deepestAndCurrSiblings[0].Position.Equals(&deepestAndCurrSiblingPositions[0]) {
			currSiblings = deepestAndCurrSiblings[1:]
			needMore = true
		} else {
			currSiblings = deepestAndCurrSiblings
			needMore = false
		}
		siblingPosHashPairs = append(currSiblings, siblingPosHashPairs...)
	}

	sort.Sort(PosHashPairsInMerkleProofOrder(siblingPosHashPairs))

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
		return KeyValuePair{}, MerkleInclusionProof{}, err
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

	// Lookup hashes of key value pairs stored at the same leaf.
	// These pairs are ordered by key.
	kevps, seqnos, err := t.eng.LookupKEVPairsUnderPosition(ctx, tr, s, leafPos)
	if err != nil {
		return KeyValuePair{}, MerkleInclusionProof{}, err
	}
	var msMap map[Seqno]MasterSecret
	if t.cfg.UseBlindedValueHashes {
		msMap, err = t.eng.(StorageEngineWithBlinding).LookupMasterSecrets(ctx, tr, seqnos)
		if err != nil {
			return KeyValuePair{}, MerkleInclusionProof{}, err
		}
	}

	// Find the key value pair we are looking for in the leaf
	for i, kevpi := range kevps {
		if kevpi.Key.Equal(k) {
			valContainer := t.cfg.ConstructValueContainer()
			err = t.cfg.Encoder.Decode(&valContainer, kevpi.Value)
			if err != nil {
				return KeyValuePair{}, MerkleInclusionProof{}, err
			}
			kvp = KeyValuePair{Key: k, Value: valContainer}
			if t.cfg.UseBlindedValueHashes {
				proof.KeySpecificSecret = t.cfg.Encoder.ComputeKeySpecificSecret(msMap[seqnos[i]], kvp.Key)
			} else {
				proof.KeySpecificSecret = nil
			}
			break
		}
	}
	if kvp.Key == nil {
		return KeyValuePair{}, MerkleInclusionProof{}, NewKeyNotFoundError()
	}

	proof.OtherPairsInLeaf = make([]KeyHashPair, len(kevps)-1)
	j := 0
	for i, kevpi := range kevps {
		if kevpi.Key.Equal(k) {
			continue
		}

		var hash Hash
		hash, err = t.cfg.Encoder.HashKeyEncodedValuePairWithKeySpecificSecret(kevpi, t.cfg.Encoder.ComputeKeySpecificSecret(msMap[seqnos[i]], kevpi.Key))
		if err != nil {
			return KeyValuePair{}, MerkleInclusionProof{}, err
		}
		proof.OtherPairsInLeaf[j] = KeyHashPair{Key: kevpi.Key, Hash: hash}
		j++
	}

	return kvp, proof, nil
}

func (t *Tree) ExecTransaction(ctx logger.CtxAndLogger, txFn func(logger.CtxAndLogger, Transaction) error) error {
	return t.eng.ExecTransaction(ctx, txFn)
}

// GetLatestRoot returns the latest RootMetadata which was stored in the
// tree (and its Hash and Seqno). If no such record was stored yet,
// GetLatestRoot returns 0 as a Seqno and a NoLatestRootFound error.
func (t *Tree) GetLatestRoot(ctx logger.CtxAndLogger, tr Transaction) (s Seqno, root RootMetadata, rootHash Hash, err error) {
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
