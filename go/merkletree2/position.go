package merkletree2

import (
	"math/big"
)

// Position represents the position of a node in the tree. When converted to
// bytes, a Position can be interpreted as a 1 followed (from left to right) by
// a sequence of log2(Config.childrenPerNode)-bit symbols, where each such
// symbol identifies which child to descend to in a path from the root to a
// node. The sequence is padded with 0s on the left to the nearest byte. For
// example, in a binary tree the root has position 0x01 (i.e. 0b00000001), and
// the second child of the first child of the root has position 0x05
// (0b00000101).
type Position big.Int

func (t *Config) getRootPosition() *Position {
	return (*Position)(big.NewInt(1))
}

func (t *Config) getChild(p *Position, c ChildIndex) *Position {
	var q big.Int
	q.Lsh((*big.Int)(p), uint(t.bitsPerIndex))
	q.Or(&q, big.NewInt(int64(c)))
	return (*Position)(&q)
}

func (p *Position) getBytes() []byte {
	return (*big.Int)(p).Bytes()
}

func (p *Position) isOnPathToKey(k Key) bool {
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

// getParent return nil if the p is the root
func (t *Config) getParent(p *Position) *Position {
	if (*big.Int)(p).BitLen() < 2 {
		return nil
	}

	var f big.Int
	f.Rsh((*big.Int)(p), uint(t.bitsPerIndex))

	return (*Position)(&f)
}

// getAllSiblings returns nil,nil if p is the root
func (t *Config) getAllSiblings(p *Position) (siblings []Position, parent *Position) {

	parent = t.getParent(p)
	if parent == nil {
		return nil, nil
	}

	// Optimization for binary trees
	if t.childrenPerNode == 2 {
		var sib big.Int
		sib.Xor((*big.Int)(p), big.NewInt(1))
		return []Position{Position(sib)}, parent
	}

	siblings = make([]Position, t.childrenPerNode-1)

	var child0 big.Int
	child0.Lsh((*big.Int)(parent), uint(t.bitsPerIndex))

	var buff big.Int
	pChildIndex := buff.Xor(&child0, (*big.Int)(p)).Int64()

	for i, j := int64(0), int64(0); j < int64(t.childrenPerNode); j++ {
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
func (t *Config) getDeepestPositionForKey(k Key) (*Position, error) {
	if len(k) != t.keysByteLength {
		return nil, NewInvalidKeyError()
	}
	var p Position
	(*big.Int)(&p).SetBytes(k)
	(*big.Int)(&p).SetBit((*big.Int)(&p), len(k)*8, 1)
	return &p, nil
}

// getSiblingPositionsOnPathToKey returns a slice of positions, in descending
// order by level (siblings farther from the root come first) and in
// lexicographic order within each level.
func (t *Config) getSiblingPositionsOnPathToKey(k Key) ([]Position, error) {
	p, err := t.getDeepestPositionForKey(k)
	if err != nil {
		return nil, err
	}
	maxPathLength := t.keysByteLength * 8 / int(t.bitsPerIndex)
	positions := make([]Position, 0, maxPathLength*(t.childrenPerNode-1))
	root := t.getRootPosition()
	var sibs []Position
	for i := 0; !p.equals(root); {
		sibs, p = t.getAllSiblings(p)
		positions = append(positions, sibs...)
		i++
	}

	return positions, nil
}

// getLevel returns the level of p. The root is at level 0, and each node has
// level 1 higher than its parent.
func (t *Config) getLevel(p *Position) int {
	return ((*big.Int)(p).BitLen() - 1) / int(t.bitsPerIndex)
}

// getParentAtLevel returns nil if p is at a level lower than `level`. The root
// is at level 0, and each node has level 1 higher than its parent.
func (t *Config) getParentAtLevel(p *Position, level uint) *Position {
	shift := (*big.Int)(p).BitLen() - 1 - int(t.bitsPerIndex)*int(level)
	if (*big.Int)(p).BitLen() < 2 || shift < 0 {
		return nil
	}

	var f big.Int
	f.Rsh((*big.Int)(p), uint(shift))

	return (*Position)(&f)
}

// positionToChildIndexPath returns the list of childIndexes to navigate from the
// root to p (in reverse order).
func (t *Config) positionToChildIndexPath(p *Position) (path []ChildIndex) {
	path = make([]ChildIndex, t.getLevel(p))

	bitMask := big.NewInt(int64(t.childrenPerNode - 1))

	var buff, buff2 big.Int
	buff2.Set((*big.Int)(p))

	for i := range path {
		path[i] = ChildIndex(buff.And(bitMask, &buff2).Int64())
		buff2.Rsh(&buff2, uint(t.bitsPerIndex))
	}

	return path
}

// getDeepestChildIndex returns the only ChildIndex i such that p is the i-th children of
// its parent. It returns 0 on the root.
func (t *Config) getDeepestChildIndex(p *Position) ChildIndex {
	if (*big.Int)(p).BitLen() < 2 {
		return ChildIndex(0)
	}
	bitMask := big.NewInt(int64(t.childrenPerNode - 1))
	var buff big.Int
	return ChildIndex(buff.And(bitMask, (*big.Int)(p)).Int64())
}
