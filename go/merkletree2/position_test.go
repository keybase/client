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
		{config1bit, "1", *config1bit.getRootPosition()},
		{config2bits, "1", *config2bits.getRootPosition()},
		{config3bits, "1", *config3bits.getRootPosition()},
		{config1bit, "10", *config1bit.getChild(config1bit.getRootPosition(), 0)},
		{config2bits, "100", *config2bits.getChild(config2bits.getRootPosition(), 0)},
		{config3bits, "1000", *config3bits.getChild(config3bits.getRootPosition(), 0)},
		{config1bit, "101", *config1bit.getChild(config1bit.getChild(config1bit.getRootPosition(), 0), 1)},
		{config2bits, "10011", *config2bits.getChild(config2bits.getChild(config2bits.getRootPosition(), 0), 3)},
		{config3bits, "1000101", *config3bits.getChild(config3bits.getChild(config3bits.getRootPosition(), 0), 5)},
	}

	for _, et := range encodingTests {
		t.Run(fmt.Sprintf("%v bits: %s", et.c.bitsPerIndex, et.bin), func(t *testing.T) {
			exp, err := strconv.ParseInt(et.bin, 2, 64)
			require.NoError(t, err)
			require.Equal(t, exp, (*big.Int)(&et.p).Int64())
		})
	}
}

func TestGetParentAndGetChild(t *testing.T) {

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
		t.Run(fmt.Sprintf("%v bits: %s -(%v)-> %s", test.c.bitsPerIndex, test.parent, test.i, test.child), func(t *testing.T) {
			child, err := makePositionFromStringForTesting(test.child)
			require.NoError(t, err)
			parent, err := makePositionFromStringForTesting(test.parent)
			require.NoError(t, err)
			require.True(t, test.c.getParent(&child).equals(&parent))
			require.True(t, test.c.getChild(&parent, test.i).equals(&child))
		})
	}
}

func TestNewConfigError(t *testing.T) {

	_, err := NewConfig(nil, false, 5, 8, 6)
	require.Error(t, err)
	require.IsType(t, InvalidConfigError{}, err)

	c, err := NewConfig(nil, false, 2, 4, 32)
	require.NoError(t, err)

	require.Equal(t, 1<<c.bitsPerIndex, c.childrenPerNode)
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
		t.Run(fmt.Sprintf("%v bits: %v %v", test.c.bitsPerIndex, test.p, test.k), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.p)
			require.NoError(t, err)
			require.Equal(t, test.expected, pos.isOnPathToKey(test.k))
		})
	}

}

func TestGetSiblingPositionsOnPathToKey(t *testing.T) {

	config1bit, config2bits, _ := getTreeCfgsWith1_2_3BitsPerIndexUnblinded(t)

	tests := []struct {
		c            Config
		k            Key
		expPosOnPath []string
	}{
		{config1bit, []byte{}, nil},
		{config1bit, []byte{0xf0}, []string{"111110001", "11111001", "1111101", "111111", "11110", "1110", "110", "10"}},
		{config2bits, []byte{0xf0}, []string{"111110001", "111110010", "111110011", "1111101", "1111110", "1111111", "11100", "11101", "11110", "100", "101", "110"}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v", test.c.bitsPerIndex, test.k), func(t *testing.T) {
			posOnPath, err := test.c.getSiblingPositionsOnPathToKey(test.k)
			if test.expPosOnPath == nil {
				require.Error(t, err)
				require.IsType(t, InvalidKeyError{}, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, len(test.expPosOnPath), len(posOnPath))
			for i, expPosStr := range test.expPosOnPath {
				expPos, err := makePositionFromStringForTesting(expPosStr)
				require.NoError(t, err)
				require.True(t, expPos.equals(&posOnPath[i]), "Error at position %v", expPosStr)
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
		t.Run(fmt.Sprintf("%v bits: pos %v lev %v", test.c.bitsPerIndex, test.pos, test.lev), func(t *testing.T) {
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
		t.Run(fmt.Sprintf("%v bits: pos %v lev %v", test.c.bitsPerIndex, test.pos, test.lev), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.pos)
			require.NoError(t, err)
			expParent, err := makePositionFromStringForTesting(test.par)
			require.NoError(t, err)

			require.True(t, expParent.equals(test.c.getParentAtLevel(&pos, test.lev)))
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
		t.Run(fmt.Sprintf("%v bits: pos %v", test.c.bitsPerIndex, test.pos), func(t *testing.T) {
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
		t.Run(fmt.Sprintf("%v bits: pos %v lev %v", test.c.bitsPerIndex, test.pos, test.lev), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.pos)
			require.NoError(t, err)

			require.Equal(t, test.lev, test.c.getDeepestChildIndex(&pos))
		})
	}

}
