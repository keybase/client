package merkleTree

import (
	"errors"
	"fmt"
)

// HashMismatchError is raised when a value fails to match its hash key.
type HashMismatchError struct {
	H Hash
}

func (h HashMismatchError) Error() string {
	return fmt.Sprintf("Hash mismatch at %x", h.H)
}

// NodeNotFoundError is raised when an interior node of the tree
// isn't found, though it was advertised by a parent node.
type NodeNotFoundError struct {
	H Hash
}

func (n NodeNotFoundError) Error() string {
	return fmt.Sprintf("Node with hash %x not found", n.H)
}

// BadChildPointerError is thrown when the types of an interior node
// are not pointers to children.
type BadChildPointerError struct {
	V interface{}
}

func (b BadChildPointerError) Error() string {
	return fmt.Sprintf("Wanted a Hash; got type %T instead", b.V)
}

// ErrBadINode is thrown when we find a corrupt/malformed iNode
var ErrBadINode = errors.New("Bad iNode found")
