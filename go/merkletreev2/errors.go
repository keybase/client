package merkletreev2

import (
	"errors"
)

// ErrRootHasNoFather is raised when calling getFather on the root of a tree.
var ErrRootHasNoFather = errors.New("Root does not have a father")
