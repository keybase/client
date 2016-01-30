/*
Package merkleTree is a generic Merkle Tree implementation, for provably publishing lots
of data under one succinct tree root.

Install:

   go get github.com/keybase/go-merkle-tree

Design:

This package outputs a MerkleTree with two types of nodes: interior index
nodes, or iNodes, and exterior data nodes, of Leaf nodes. The inodes
consist of tables that map prefixes to child pointers.  The leafs map a full
hash to a "value".

This is best demonstrated with a simple example. Let's say you are storing
the key-value pair (`0123456789abcdef`, {"name" : "max"}) in the Merkle tree.
Let's say that the shape of the tree is to have 256 children per inode.
Then this key-value pair might be stored under the path

	at root     node: 01 → aabbccdd
	at aabbccdd node: 23 → eeff5588
	at eeff5588 node: 34 → 99331122
	at 99331122 node: 0123456789abcdef → {"name" : "max" }

Meaning at the root node, we take the first 256-bits of the needed
key to get a prefix `01`, and look that up in the node's pointer table
to get a child pointer, which is `aabbccdd`.  This is a hash of an
iNode, which we can fetch from storage, verify it matches the hash,
and then recursively apply the same algorithm to find the next
step in the path. The leaf node has a sparse table of long-hashes
(which are the keys) that map to the values actually stored in the
tree.

Implementation:

All nodes are encoded with msgpack before being hashed or written to
store. See `types.go` for the exactly layout of the msgpack objects.

Usage:

To construct a new Tree from scratch, you need to specify three parameters:

	- A Config, which specifies the shape of the Tree. That is,
	  how many children per interior Node, and how big leaves
	  can get before a new level of the tree is introduced. Also,
	  the hash function to use for hashing nodes into pointers.

	- A StorageEngine, which determines how to load and store tree Nodes
	  from storage, and how to load and store the root hash of the Merkle tree.

	- An array of KeyValuePairs, the things actually stored in the Merkle tree.

*/
package merkleTree
