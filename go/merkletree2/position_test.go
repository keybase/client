package merkletree2

import (
	"fmt"
	"math/big"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncoding(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	encodingTests := []struct {
		c   Config
		bin string
		p   Position
	}{
		{config1bit, "1", *config1bit.GetRootPosition()},
		{config2bits, "1", *config2bits.GetRootPosition()},
		{config3bits, "1", *config3bits.GetRootPosition()},
		{config1bit, "10", *config1bit.GetChild(config1bit.GetRootPosition(), 0)},
		{config2bits, "100", *config2bits.GetChild(config2bits.GetRootPosition(), 0)},
		{config3bits, "1000", *config3bits.GetChild(config3bits.GetRootPosition(), 0)},
		{config1bit, "101", *config1bit.GetChild(config1bit.GetChild(config1bit.GetRootPosition(), 0), 1)},
		{config2bits, "10011", *config2bits.GetChild(config2bits.GetChild(config2bits.GetRootPosition(), 0), 3)},
		{config3bits, "1000101", *config3bits.GetChild(config3bits.GetChild(config3bits.GetRootPosition(), 0), 5)},
	}

	for _, et := range encodingTests {
		t.Run(fmt.Sprintf("%v bits: %s", et.c.BitsPerIndex, et.bin), func(t *testing.T) {
			exp, err := strconv.ParseInt(et.bin, 2, 64)
			require.NoError(t, err)
			require.Equal(t, exp, (*big.Int)(&et.p).Int64())
		})
	}
}

func TestGetAndUpdateParentAndGetChild(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	parentChildTests := []struct {
		c      Config
		parent string
		child  string
		i      ChildIndex
	}{
		{config1bit, "1", "10", 0},
		{config1bit, "1", "11", 1},
		{config1bit, "11", "111", 1},
		{config2bits, "1", "100", 0},
		{config2bits, "1", "101", 1},
		{config2bits, "1000100", "100010011", 3},
		{config3bits, "1", "1100", 4},
		{config3bits, "1111", "1111101", 5},
	}

	for _, test := range parentChildTests {
		t.Run(fmt.Sprintf("%v bits: %s -(%v)-> %s", test.c.BitsPerIndex, test.parent, test.i, test.child), func(t *testing.T) {
			child, err := makePositionFromStringForTesting(test.child)
			require.NoError(t, err)
			parent, err := makePositionFromStringForTesting(test.parent)
			require.NoError(t, err)
			require.True(t, test.c.getParent(&child).Equals(&parent))
			require.True(t, test.c.GetChild(&parent, test.i).Equals(&child))
			parentInPlace := child.Clone()
			test.c.updateToParent(parentInPlace)
			require.True(t, parentInPlace.Equals(&parent))
		})
	}
}

func TestUpdateToParentAtLevel(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c      Config
		parent string
		child  string
		level  uint
	}{
		{config1bit, "1", "1", 0},
		{config1bit, "1", "10", 0},
		{config1bit, "1", "1100100", 0},
		{config2bits, "1", "1100", 0},
		{config3bits, "1", "1111101", 0},
		{config1bit, "111", "111", 2},
		{config1bit, "110", "11010", 2},
		{config2bits, "110", "11001", 1},
		{config3bits, "1111", "1111101", 1},
		{config3bits, "1111001000", "1111001000001000", 3},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %s -(%v)-> %s", test.c.BitsPerIndex, test.child, test.level, test.parent), func(t *testing.T) {
			childToUpdate, err := makePositionFromStringForTesting(test.child)
			require.NoError(t, err)
			parent, err := makePositionFromStringForTesting(test.parent)
			require.NoError(t, err)
			test.c.updateToParentAtLevel(&childToUpdate, test.level)
			require.True(t, parent.Equals(&childToUpdate), "expected: %x actual: %x", parent, childToUpdate)
		})
	}

}

func TestUpdateToParentAndAllSiblings(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c            Config
		pStr         string
		expParentStr string
		expSiblings  []string
	}{
		{config1bit, "1001111", "100111", []string{"1001110"}},
		{config1bit, "1001", "100", []string{"1000"}},
		{config2bits, "1001111", "10011", []string{"1001100", "1001101", "1001110"}},
		{config3bits, "1001111", "1001", []string{"1001000", "1001001", "1001010", "1001011", "1001100", "1001101", "1001110"}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v", test.c.BitsPerIndex, test.pStr), func(t *testing.T) {
			p, err := makePositionFromStringForTesting(test.pStr)
			require.NoError(t, err)
			parent, err := makePositionFromStringForTesting(test.expParentStr)
			require.NoError(t, err)
			siblings := make([]Position, test.c.ChildrenPerNode-1)

			test.c.updateToParentAndAllSiblings(&p, siblings)
			require.True(t, p.Equals(&parent))
			for i, expPosStr := range test.expSiblings {
				expPos, err := makePositionFromStringForTesting(expPosStr)
				require.NoError(t, err)
				require.True(t, expPos.Equals(&siblings[i]), "Error at sibling %v, got %v", expPosStr, siblings[i])
			}
		})
	}
}

func TestNewConfigError(t *testing.T) {

	_, err := NewConfig(nil, false, 5, 8, 6, ConstructStringValueContainer)
	require.Error(t, err)
	require.IsType(t, InvalidConfigError{}, err)

	c, err := NewConfig(nil, false, 2, 4, 32, ConstructStringValueContainer)
	require.NoError(t, err)

	require.Equal(t, 1<<c.BitsPerIndex, c.ChildrenPerNode)
}

func TestPositionIsOnPathToKey(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c        Config
		p        string
		k        Key
		expected bool
	}{
		{config1bit, "1", []byte{0x00, 0x01, 0x02}, true},
		{config2bits, "1", []byte{0x00, 0x01, 0x02}, true},
		{config3bits, "1", []byte{0x00, 0x01, 0x02}, true},
		{config1bit, "10", []byte{0x00, 0x01, 0x02}, true},
		{config2bits, "100", []byte{0x00, 0x01, 0x02}, true},
		{config3bits, "1000", []byte{0x00, 0x01, 0x02}, true},
		{config1bit, "11", []byte{0x00, 0x01, 0x02}, false},
		{config2bits, "110", []byte{0x00, 0x01, 0x02}, false},
		{config3bits, "1100", []byte{0x00, 0x01, 0x02}, false},
		{config1bit, "101", []byte{0x00, 0x01, 0x02}, false},
		{config2bits, "1000000000000000100", []byte{0x00, 0x01, 0x02}, true},
		{config2bits, "1000000000000000000", []byte{0x00, 0x01, 0x02}, false},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v %v", test.c.BitsPerIndex, test.p, test.k), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.p)
			require.NoError(t, err)
			require.Equal(t, test.expected, pos.isOnPathToKey(test.k))
		})
	}

}

func TestGetDeepestPositionAtLevelAndSiblingsOnPathToKey(t *testing.T) {

	config1bit, config2bits, _ := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c            Config
		lastLevel    int
		firstLevel   int
		k            Key
		expPosOnPath []string
	}{
		{config1bit, 8, 1, []byte{0xf0}, []string{"111110000", "111110001", "11111001", "1111101", "111111", "11110", "1110", "110", "10"}},
		{config1bit, 2, 1, []byte{0xf0}, []string{"111", "110", "10"}},
		{config1bit, 3, 1, []byte{0xf0}, []string{"1111", "1110", "110", "10"}},
		{config1bit, 3, 2, []byte{0xf0}, []string{"1111", "1110", "110"}},
		{config1bit, 4, 2, []byte{0xf0}, []string{"11111", "11110", "1110", "110"}},
		{config1bit, 8, 1, []byte{0x00}, []string{"100000000", "100000001", "10000001", "1000001", "100001", "10001", "1001", "101", "11"}},
		{config1bit, 2, 1, []byte{0x00}, []string{"100", "101", "11"}},
		{config1bit, 3, 1, []byte{0x00}, []string{"1000", "1001", "101", "11"}},
		{config1bit, 3, 2, []byte{0x00}, []string{"1000", "1001", "101"}},
		{config1bit, 4, 2, []byte{0x00}, []string{"10000", "10001", "1001", "101"}},
		{config1bit, 1, 1, []byte{0x00}, []string{"10", "11"}},
		{config2bits, 4, 1, []byte{0xf1}, []string{"111110001", "111110000", "111110010", "111110011", "1111101", "1111110", "1111111", "11100", "11101", "11110", "100", "101", "110"}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v", test.c.BitsPerIndex, test.k), func(t *testing.T) {
			posOnPath := test.c.getDeepestPositionAtLevelAndSiblingsOnPathToKey(test.k, test.lastLevel, test.firstLevel)
			require.Equal(t, len(test.expPosOnPath), len(posOnPath))
			for i, expPosStr := range test.expPosOnPath {
				expPos, err := makePositionFromStringForTesting(expPosStr)
				require.NoError(t, err)
				require.True(t, expPos.Equals(&posOnPath[i]), "Error at position %v, got %v", expPosStr, posOnPath[i])
			}
		})
	}
}

func TestGetLevel(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c   Config
		pos string
		lev uint
	}{
		{config1bit, "1", 0},
		{config2bits, "1", 0},
		{config3bits, "1", 0},
		{config1bit, "10", 1},
		{config2bits, "100", 1},
		{config3bits, "1001", 1},
		{config1bit, "1001000", 6},
		{config2bits, "1001000", 3},
		{config3bits, "1001000", 2},
		{config3bits, "1001000001000", 4},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: pos %v lev %v", test.c.BitsPerIndex, test.pos, test.lev), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.pos)
			require.NoError(t, err)

			require.Equal(t, int(test.lev), test.c.getLevel(&pos))
		})
	}

}

func TestGetParentAtLevel(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c   Config
		pos string
		par string
		lev uint
	}{
		{config1bit, "1001000", "1", 0},
		{config2bits, "1001000", "1", 0},
		{config3bits, "1001000", "1", 0},
		{config1bit, "1001000", "10", 1},
		{config2bits, "1001000", "100", 1},
		{config3bits, "1001000", "1001", 1},
		{config1bit, "1001000", "100", 2},
		{config2bits, "1001000", "10010", 2},
		{config3bits, "1001000", "1001000", 2},
		{config3bits, "1001000001000", "1001000", 2},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: pos %v lev %v", test.c.BitsPerIndex, test.pos, test.lev), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.pos)
			require.NoError(t, err)
			expParent, err := makePositionFromStringForTesting(test.par)
			require.NoError(t, err)

			require.True(t, expParent.Equals(test.c.getParentAtLevel(&pos, test.lev)))
		})
	}

}

func TestPositionToChildIndexPath(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c   Config
		pos string
		p   []ChildIndex
	}{
		{config1bit, "1", []ChildIndex{}},
		{config2bits, "1", []ChildIndex{}},
		{config3bits, "1", []ChildIndex{}},
		{config1bit, "10", []ChildIndex{0}},
		{config1bit, "11", []ChildIndex{1}},
		{config2bits, "100", []ChildIndex{0}},
		{config2bits, "111", []ChildIndex{3}},
		{config3bits, "1001", []ChildIndex{1}},
		{config1bit, "1001000", []ChildIndex{0, 0, 0, 1, 0, 0}},
		{config2bits, "1001001", []ChildIndex{1, 2, 0}},
		{config2bits, "1001010", []ChildIndex{2, 2, 0}},
		{config3bits, "1001000", []ChildIndex{0, 1}},
		{config3bits, "1001000001000", []ChildIndex{0, 1, 0, 1}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: pos %v", test.c.BitsPerIndex, test.pos), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.pos)
			require.NoError(t, err)

			require.Equal(t, test.p, test.c.positionToChildIndexPath(&pos))
		})
	}

}

func TestGetDeepestChildIndex(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c   Config
		pos string
		lev ChildIndex
	}{
		{config1bit, "1", 0},
		{config2bits, "1", 0},
		{config3bits, "1", 0},
		{config1bit, "10", 0},
		{config1bit, "11", 1},
		{config2bits, "100", 0},
		{config2bits, "111", 3},
		{config3bits, "1001", 1},
		{config1bit, "1001000", 0},
		{config2bits, "1001001", 1},
		{config2bits, "1001010", 2},
		{config3bits, "1001000", 0},
		{config3bits, "1001000001110", 6},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: pos %v lev %v", test.c.BitsPerIndex, test.pos, test.lev), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.pos)
			require.NoError(t, err)

			require.Equal(t, test.lev, test.c.getDeepestChildIndex(&pos))
		})
	}

}

func TestGetKeyIntervalUnderPosition(t *testing.T) {

	config1bit, config2bits, config3bits := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c        Config
		position string
		minKey   Key
		maxKey   Key
	}{
		{config1bit, "1", Key([]byte{0x00}), Key([]byte{0xff})},
		{config1bit, "11", Key([]byte{0x80}), Key([]byte{0xff})},
		{config1bit, "101", Key([]byte{0x40}), Key([]byte{0x7f})},
		{config1bit, "10100", Key([]byte{0x40}), Key([]byte{0x4f})},
		{config2bits, "1", Key([]byte{0x00}), Key([]byte{0xff})},
		{config2bits, "101", Key([]byte{0x40}), Key([]byte{0x7f})},
		{config2bits, "10100", Key([]byte{0x40}), Key([]byte{0x4f})},
		{config3bits, "1", Key([]byte{0x00, 0x00, 0x00}), Key([]byte{0xff, 0xff, 0xff})},
		{config3bits, "1010", Key([]byte{0x40, 0x00, 0x00}), Key([]byte{0x5f, 0xff, 0xff})},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %s", test.c.BitsPerIndex, test.position), func(t *testing.T) {
			p, err := makePositionFromStringForTesting(test.position)
			require.NoError(t, err)
			min, max := test.c.GetKeyIntervalUnderPosition(&p)
			require.Equal(t, test.minKey, min)
			require.Equal(t, test.maxKey, max)
		})
	}

}
