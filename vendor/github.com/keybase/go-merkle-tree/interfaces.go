package merkleTree

import "golang.org/x/net/context"

// StorageEngine specifies how to store and lookup merkle tree nodes
// and roots.  You can use a DB like Dynamo or SQL to do this.
type StorageEngine interface {
	StoreNode(context.Context, Hash, []byte) error
	CommitRoot(ctx context.Context, prev Hash, curr Hash, txinfo TxInfo) error
	LookupNode(context.Context, Hash) ([]byte, error)
	LookupRoot(context.Context) (Hash, error)
}
