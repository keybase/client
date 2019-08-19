package merkletreev2

import (
	"math/big"
)

// Position represents the position of a node in the tree. When converted to
// bytes, a Position can be interpreted as a 1 followed (from left to right) by
// a sequence of log2(Config.m)-bit symbols, where each such symbol identifies
// which child to descend to in a path from the root to a node. The sequence is
// padded with 0s on the left to the nearest byte. For example, in a binary tree
// the root has position 0x01 (i.e. 0b00000001), and the second child of the
// first child of the root has position 0x05 (0b00000101).
type Position big.Int

func (t *Tree) getRootPosition() Position {
	return Position(*big.NewInt(1))
}

func (t *Tree) getChildPosition(p Position, c ChildIndex) Position {
	return Position(*big.NewInt(0).Or(big.NewInt(0).Lsh((*big.Int)(&p), uint(t.cfg.bitsPerIndex)), big.NewInt(int64(c))))
}

func (p *Position) getBytes() []byte {
	return (*big.Int)(p).Bytes()
}

func (t *Tree) isPositionOnPathToKey(p *Position, k Key) bool {
	// If the Key is shorter than current prefix
	if len(k)*8 < (*big.Int)(p).BitLen()-1 {
		return false
	}
	q := new(big.Int)
	q.SetBytes([]byte(k))
	q.SetBit(q, len(k)*8, 1)
	q.Rsh(q, uint(q.BitLen()-(*big.Int)(p).BitLen()))
	return (*big.Int)(p).Cmp(q) == 0
}

func (p *Position) equals(q *Position) bool {
	return (*big.Int)(p).Cmp((*big.Int)(q)) == 0
}

func (t *Tree) getFather(p *Position) (f Position, err error) {
	if (*big.Int)(p).BitLen() < 2 {
		return Position{}, ErrRootHasNoFather
	}

	(*big.Int)(&f).Rsh((*big.Int)(p), uint(t.cfg.bitsPerIndex))

	return f, nil
}

func (t *Tree) getAllSiblings(p *Position) (siblings []Position, father Position, err error) {

	father, err = t.getFather(p)
	if err != nil {
		return nil, Position{}, err
	}

	for i := ChildIndex(0); i < ChildIndex(t.cfg.childrenPerNode); i++ {
		sibling := t.getChildPosition(father, i)
		if sibling.equals(p) {
			continue
		}
		siblings = append(siblings, sibling)
	}

	return siblings, father, nil
}

// getDeepestPositionForKey converts the key into the position the key would be
// stored at if the tree was full with only one key per leaf.
func (t *Tree) getDeepestPositionForKey(k Key) (p Position) {
	// Here we assume that len(k)*8 is a multiple of t.cfg.bitsPerIndex
	(*big.Int)(&p).SetBytes(k)
	(*big.Int)(&p).SetBit((*big.Int)(&p), len(k)*8+1, 1)
	return p
}

func (t *Tree) getSiblingPositionsOnPathToKey(k Key) ([][]Position, error) {
	var err error
	p := t.getDeepestPositionForKey(k)
	maxPathLength := (8 * ((*big.Int)(&p).BitLen() - 1)) / int(t.cfg.bitsPerIndex)
	positions := make([][]Position, maxPathLength)

	for i := maxPathLength; i > 0; i-- {
		positions[i], p, err = t.getAllSiblings(&p)
		if err != nil {
			return nil, err
		}
	}

	return positions, nil
}
