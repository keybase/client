package merkletree2

import "golang.org/x/net/context"

// StorageEngine specifies how to store and lookup merkle tree nodes, roots and
// KeyValuePairs. You can use a DB like Dynamo or SQL to do this.
type StorageEngine interface {
	// TODO update transaction management together with the blind architect
	NewTransaction(context.Context) (Transaction, error)
	CommitTransaction(context.Context, Transaction) error
	AbortTransaction(context.Context, Transaction)

	// StoreKVPairs stores the []KeyValuePair in the tree.
	StoreKVPairs(context.Context, Transaction, Seqno, []KeyValuePair) error

	StoreNode(context.Context, Transaction, Seqno, Position, Hash) error

	StoreRootMetadataNode(context.Context, Transaction, RootMetadataNode) error

	// LookupLatestRoot returns the latest root metadata and sequence number in
	// the tree. If no root is found, then it returns 0 as the seqno and an
	// empty RootMetadataNode, but NO error.
	LookupLatestRoot(context.Context, Transaction) (Seqno, RootMetadataNode, error)

	// If there is no root for the specified Seqno, an InvalidSeqnoError is returned.
	LookupRoot(context.Context, Transaction, Seqno) (RootMetadataNode, error)

	// LookupNode returns, for any position, the hash of the node with the
	// highest Seqno s' <= s which was stored at position p. For example, if
	// StoreNode(ctx, t, 5, p, hash5) and StoreNode(ctx, 6, p, hash6) and
	// StoreNode(ctx, t, 8, p, hash8) were called for a specific position p,
	// then LookupNode(ctx, t, 7, p) would return hash6. It returns an error if
	// no such node was stored in the tree.
	LookupNode(c context.Context, t Transaction, s Seqno, p Position) (Hash, error)

	// LookupNodes is analogous to LookupNode, but it takes more than one
	// position and returns pairs of a Position and the corresponding node Hash
	// only for the nodes which are found in the tree. Positions should be
	// returned in the same order in which they are requested, and no error is
	// returned if some of the positions are not found.
	LookupNodes(c context.Context, t Transaction, s Seqno, positions []Position) ([]PositionHashPair, error)

	// LookupKVPair returns the KeyValuePair (and its Hash) with the highest Seqno s1 <=
	// s which was stored at position p (similarly to LookupNode).
	LookupKVPair(c context.Context, t Transaction, s Seqno, k Key) (kvp KeyValuePair, s1 Seqno, err error)

	// LookupKeyHashPairsUnderPosition returns all KeyValuePairs which were
	// stored at a position p' which is a descendent of p and at the maximum
	// Seqno s' <= s (similarly to LookupNode). For each such pair, it returns
	// the Seqno at which it was stored (in the same order).
	LookupKeyValuePairsUnderPosition(ctx context.Context, tr Transaction, s Seqno, p Position) ([]KeyValuePair, []Seqno, error)

	StoreMasterSecret(ctx context.Context, tr Transaction, s Seqno, ms MasterSecret) error
	LookupMasterSecrets(ctx context.Context, tr Transaction, s []Seqno) (map[Seqno]MasterSecret, error)
}

// Transaction references a DB transaction.
type Transaction interface{}
