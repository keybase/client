package merkletree2

import (
	"math/big"
)

// Position represents the position of a node in the tree. When converted to
// bytes, a Position can be interpreted as a 1 followed (from left to right) by
// a sequence of log2(Config.ChildrenPerNode)-bit symbols, where each such
// symbol identifies which child to descend to in a path from the root to a
// node. The sequence is padded with 0s on the left to the nearest byte. For
// example, in a binary tree the root has position 0x01 (i.e. 0b00000001), and
// the second child of the first child of the root has position 0x05
// (0b00000101).
type Position big.Int

func (t *Config) GetRootPosition() *Position {
	return (*Position)(big.NewInt(1))
}

func (t *Config) GetChild(p *Position, c ChildIndex) *Position {
	var q big.Int
	q.Lsh((*big.Int)(p), uint(t.BitsPerIndex))
	q.Bits()[0] = q.Bits()[0] | big.Word(c)
	return (*Position)(&q)
}

func (p *Position) GetBytes() []byte {
	return (*big.Int)(p).Bytes()
}

func (p *Position) AsString() string {
	return string(p.GetBytes())
}

func (p *Position) SetBytes(b []byte) {
	(*big.Int)(p).SetBytes(b)
}

func NewPositionFromBytes(pos []byte) *Position {
	var p big.Int
	p.SetBytes(pos)
	return (*Position)(&p)
}

// Set updates p to the value of q
func (p *Position) Set(q *Position) {
	(*big.Int)(p).Set((*big.Int)(q))
}

// Clone returns a pointer to a deep copy of a position
func (p *Position) Clone() *Position {
	var q Position
	q.Set(p)
	return &q
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

func (p *Position) Equals(q *Position) bool {
	return (*big.Int)(p).CmpAbs((*big.Int)(q)) == 0
}

// getParent return nil if the p is the root
func (t *Config) getParent(p *Position) *Position {
	if (*big.Int)(p).BitLen() < 2 {
		return nil
	}

	f := p.Clone()
	t.updateToParent(f)

	return f
}

func (t *Config) updateToParent(p *Position) {
	((*big.Int)(p)).Rsh((*big.Int)(p), uint(t.BitsPerIndex))
}

// Behavior if p has no parent at the requested level is undefined.
func (t *Config) updateToParentAtLevel(p *Position, level uint) {
	shift := (*big.Int)(p).BitLen() - 1 - int(t.BitsPerIndex)*int(level)
	((*big.Int)(p)).Rsh((*big.Int)(p), uint(shift))
}

// updateToParentAndAllSiblings takes as input p and a slice of size
// t.cfg.ChildrenPerNode - 1. It populates the slice with the siblings of p, and
// updates p to be its parent.
func (t *Config) updateToParentAndAllSiblings(p *Position, sibs []Position) {
	if (*big.Int)(p).BitLen() < 2 {
		return
	}

	// Optimization for binary trees
	if t.ChildrenPerNode == 2 {
		sibs[0].Set(p)
		lsBits := &(((*big.Int)(&sibs[0]).Bits())[0])
		*lsBits = (*lsBits ^ 1)

	} else {

		pChildIndex := big.Word(t.getDeepestChildIndex(p))

		mask := ^((big.Word)((1 << t.BitsPerIndex) - 1))

		for i, j := uint(0), big.Word(0); j < big.Word(t.ChildrenPerNode); j++ {
			if j == pChildIndex {
				continue
			}

			sibs[i].Set(p)
			// Set least significant bits to the j-th children
			lsBits := &(((*big.Int)(&sibs[i]).Bits())[0])
			*lsBits = (*lsBits & mask) | j
			i++
		}
	}

	t.updateToParent(p)
}

// getDeepestPositionForKey converts the key into the position the key would be
// stored at if the tree was full with only one key per leaf.
func (t *Config) getDeepestPositionForKey(k Key) (*Position, error) {
	if len(k) != t.KeysByteLength {
		return nil, NewInvalidKeyError()
	}
	var p Position
	(*big.Int)(&p).SetBytes(k)
	(*big.Int)(&p).SetBit((*big.Int)(&p), len(k)*8, 1)
	return &p, nil
}

// Returns the lexicographically first key which could be found at any children
// of position p in the tree
func (t *Config) getMinKey(p *Position) Key {
	var min big.Int
	min.Set((*big.Int)(p))
	n := uint(t.KeysByteLength*8 + 1 - min.BitLen())
	min.Lsh(&min, n)
	return min.Bytes()[1:]
}

func (t *Config) GetKeyIntervalUnderPosition(p *Position) (minKey, maxKey Key) {
	var min, max big.Int

	min.Set((*big.Int)(p))
	n := uint(t.KeysByteLength*8 + 1 - min.BitLen())
	min.Lsh(&min, n)
	minKey = min.Bytes()[1:]

	one := big.NewInt(1)
	max.Lsh(one, n)
	max.Sub(&max, one)
	max.Or(&max, &min)
	maxKey = max.Bytes()[1:]

	return minKey, maxKey
}

// getDeepestPositionAtLevelAndSiblingsOnPathToKey returns a slice of positions,
// in descending order by level (siblings farther from the root come first) and
// in lexicographic order within each level. The first position in the slice is
// the position at level lastLevel on a path from the root to k (or the deepest
// possible position for such key if latLevel is greater than that). The
// following positions are all the siblings of the nodes on the longest possible
// path from the root to the key k with are at levels from lastLevel (excluded)
// to firstLevel (included).
// See TestGetDeepestPositionAtLevelAndSiblingsOnPathToKey for sample outputs.
func (t *Config) getDeepestPositionAtLevelAndSiblingsOnPathToKey(k Key, lastLevel int, firstLevel int) (sibs []Position) {

	maxLevel := t.KeysByteLength * 8 / int(t.BitsPerIndex)
	if lastLevel > maxLevel {
		lastLevel = maxLevel
	}

	// first, shrink the key for efficiency
	bytesNecessary := lastLevel * int(t.BitsPerIndex) / 8
	if lastLevel*int(t.BitsPerIndex)%8 != 0 {
		bytesNecessary++
	}
	k = k[:bytesNecessary]

	var buf Position
	p := &buf
	(*big.Int)(p).SetBytes(k)
	(*big.Int)(p).SetBit((*big.Int)(p), len(k)*8, 1)

	t.updateToParentAtLevel(p, uint(lastLevel))

	sibs = make([]Position, (lastLevel-firstLevel+1)*(t.ChildrenPerNode-1)+1)
	sibs[0].Set(p)
	for i, j := lastLevel, 0; i >= firstLevel; i-- {
		sibsToFill := sibs[1+(t.ChildrenPerNode-1)*j : 1+(t.ChildrenPerNode-1)*(j+1)]
		t.updateToParentAndAllSiblings(p, sibsToFill)
		j++
	}

	return sibs
}

// getLevel returns the level of p. The root is at level 0, and each node has
// level 1 higher than its parent.
func (t *Config) getLevel(p *Position) int {
	return ((*big.Int)(p).BitLen() - 1) / int(t.BitsPerIndex)
}

// getParentAtLevel returns nil if p is at a level lower than `level`. The root
// is at level 0, and each node has level 1 higher than its parent.
func (t *Config) getParentAtLevel(p *Position, level uint) *Position {
	shift := (*big.Int)(p).BitLen() - 1 - int(t.BitsPerIndex)*int(level)
	if (*big.Int)(p).BitLen() < 2 || shift < 0 {
		return nil
	}

	f := p.Clone()
	t.updateToParentAtLevel(f, level)
	return f
}

// positionToChildIndexPath returns the list of childIndexes to navigate from the
// root to p (in reverse order).
func (t *Config) positionToChildIndexPath(p *Position) (path []ChildIndex) {
	path = make([]ChildIndex, t.getLevel(p))

	bitMask := big.Word(t.ChildrenPerNode - 1)

	buff := p.Clone()

	for i := range path {
		path[i] = ChildIndex(((*big.Int)(buff)).Bits()[0] & bitMask)
		((*big.Int)(buff)).Rsh((*big.Int)(buff), uint(t.BitsPerIndex))
	}

	return path
}

// getDeepestChildIndex returns the only ChildIndex i such that p is the i-th children of
// its parent. It returns 0 on the root.
func (t *Config) getDeepestChildIndex(p *Position) ChildIndex {
	if (*big.Int)(p).BitLen() < 2 {
		return ChildIndex(0)
	}
	return ChildIndex(((*big.Int)(p).Bits())[0] & ((1 << t.BitsPerIndex) - 1))
}

func (p *Position) CmpInMerkleProofOrder(p2 *Position) int {
	lp := (*big.Int)(p).BitLen()
	lp2 := (*big.Int)(p2).BitLen()
	if lp > lp2 {
		return -1
	} else if lp < lp2 {
		return 1
	}
	return (*big.Int)(p).CmpAbs((*big.Int)(p2))
}
