package merkletree2

import "golang.org/x/net/context"

// StorageEngine specifies how to store and lookup merkle tree nodes, roots and
// KeyEncodedValuePairs. You can use a DB like Dynamo or SQL to do this.
type StorageEngine interface {
	ExecTransaction(ctx context.Context, txFn func(context.Context, Transaction) error) error

	// StoreKVPairs stores the []KeyEncodedValuePair in the tree.
	StoreKEVPairs(context.Context, Transaction, Seqno, []KeyEncodedValuePair) error

	StoreNode(context.Context, Transaction, Seqno, *Position, Hash) error

	StoreNodes(context.Context, Transaction, Seqno, []PositionHashPair) error

	StoreRootMetadata(context.Context, Transaction, RootMetadata) error

	// LookupLatestRoot returns the latest root metadata and sequence number in
	// the tree. If no root is found, then a NoLatestRootFound error is returned.
	LookupLatestRoot(context.Context, Transaction) (Seqno, RootMetadata, error)

	// If there is no root for the specified Seqno, an InvalidSeqnoError is returned.
	LookupRoot(context.Context, Transaction, Seqno) (RootMetadata, error)

	// LookupNode returns, for any position, the hash of the node with the
	// highest Seqno s' <= s which was stored at position p. For example, if
	// StoreNode(ctx, t, 5, p, hash5) and StoreNode(ctx, 6, p, hash6) and
	// StoreNode(ctx, t, 8, p, hash8) were called for a specific position p,
	// then LookupNode(ctx, t, 7, p) would return hash6. It returns an error if
	// no such node was stored in the tree.
	LookupNode(c context.Context, t Transaction, s Seqno, p *Position) (Hash, error)

	// LookupNodes is analogous to LookupNode, but it takes more than one
	// position and returns pairs of a Position and the corresponding node Hash
	// only for the nodes which are found in the tree. No error is returned if
	// some of the positions are not found.
	LookupNodes(c context.Context, t Transaction, s Seqno, positions []Position) ([]PositionHashPair, error)

	// LookupKVPair returns the KeyEncodedValuePair with the highest Seqno s1 <=
	// s which was stored at position p (similarly to LookupNode).
	LookupKEVPair(c context.Context, t Transaction, s Seqno, k Key) (val EncodedValue, s1 Seqno, err error)

	// LookupKeyHashPairsUnderPosition returns all KeyEncodedValuePairs (ordered by
	// Key) which were stored at a position p' which is a descendent of p and at
	// the maximum Seqno s' <= s (similarly to LookupNode). For each such pair,
	// it returns the Seqno at which it was stored (in the same order).
	LookupKEVPairsUnderPosition(ctx context.Context, t Transaction, s Seqno, p *Position) ([]KeyEncodedValuePair, []Seqno, error)
}

// StorageEngineWithBlinding extends the StorageEngine interface with methods to
// support storing and retrieving the blinding secrets.
type StorageEngineWithBlinding interface {
	StorageEngine

	StoreMasterSecret(ctx context.Context, t Transaction, s Seqno, ms MasterSecret) error
	LookupMasterSecrets(ctx context.Context, t Transaction, s []Seqno) (map[Seqno]MasterSecret, error)
}

// Transaction references a DB transaction.
type Transaction interface{}
