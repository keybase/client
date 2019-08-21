package merkletree2

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

func (t *Tree) getRootPosition() *Position {
	return (*Position)(big.NewInt(1))
}

func (t *Tree) getChild(p *Position, c ChildIndex) *Position {
	var q big.Int
	q.Lsh((*big.Int)(p), uint(t.cfg.bitsPerIndex))
	q.Or(&q, big.NewInt(int64(c)))
	return (*Position)(&q)
}

func (p *Position) getBytes() []byte {
	return (*big.Int)(p).Bytes()
}

func (t *Tree) isPositionOnPathToKey(p *Position, k Key) bool {
	// If the Key is shorter than current prefix
	if len(k)*8 < (*big.Int)(p).BitLen()-1 {
		return false
	}
	var q big.Int
	q.SetBytes([]byte(k))
	q.SetBit(&q, len(k)*8, 1)
	q.Rsh(&q, uint(q.BitLen()-(*big.Int)(p).BitLen()))
	return (*big.Int)(p).Cmp(&q) == 0
}

func (p *Position) equals(q *Position) bool {
	return (*big.Int)(p).Cmp((*big.Int)(q)) == 0
}

func (t *Tree) getParent(p *Position) *Position {
	if (*big.Int)(p).BitLen() < 2 {
		return nil
	}

	var f big.Int
	f.Rsh((*big.Int)(p), uint(t.cfg.bitsPerIndex))

	return (*Position)(&f)
}

func (t *Tree) getAllSiblings(p *Position) (siblings []Position, parent *Position) {

	parent = t.getParent(p)
	if parent == nil {
		return nil, nil
	}

	siblings = make([]Position, t.cfg.childrenPerNode-1)

	var child0 big.Int
	child0.Lsh((*big.Int)(parent), uint(t.cfg.bitsPerIndex))

	var buff big.Int
	pChildIndex := buff.Xor(&child0, (*big.Int)(p)).Int64()

	for i, j := int64(0), int64(0); j < int64(t.cfg.childrenPerNode); j = j + 1 {
		if j == pChildIndex {
			continue
		}
		(*big.Int)(&siblings[i]).Or(&child0, big.NewInt(j))
		i++
	}

	return siblings, parent
}

// getDeepestPositionForKey converts the key into the position the key would be
// stored at if the tree was full with only one key per leaf.
func (t *Tree) getDeepestPositionForKey(k Key) *Position {
	var p Position
	(*big.Int)(&p).SetBytes(k)
	(*big.Int)(&p).SetBit((*big.Int)(&p), len(k)*8+1, 1)
	return &p
}

func (t *Tree) getSiblingPositionsOnPathToKey(k Key) [][]Position {
	p := t.getDeepestPositionForKey(k)
	maxPathLength := (8 * ((*big.Int)(p).BitLen() - 1)) / int(t.cfg.bitsPerIndex)
	positions := make([][]Position, maxPathLength)

	root := t.getRootPosition()
	for i := 0; p.equals(root); {
		positions[i], p = t.getAllSiblings(p)
		i++
	}

	return positions
}
