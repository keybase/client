package merkleTree

// StorageEngine specifies how to store and lookup merkle tree nodes
// and roots.  You can use a DB like Dynamo or SQL to do this.
type StorageEngine interface {
	StoreNode(Hash, []byte) error
	CommitRoot(prev Hash, curr Hash, txinfo TxInfo) error
	LookupNode(Hash) ([]byte, error)
	LookupRoot() (Hash, error)
}
