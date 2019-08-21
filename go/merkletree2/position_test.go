package merkletree2

import (
	"fmt"
	"math/big"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncoding(t *testing.T) {

	tree1bit, tree2bits, tree3bits := getTreesWith1_2_3BitsPerIndex(t)

	encodingTests := []struct {
		t   *Tree
		bin string
		p   Position
	}{
		{tree1bit, "1", *tree1bit.getRootPosition()},
		{tree2bits, "1", *tree2bits.getRootPosition()},
		{tree3bits, "1", *tree3bits.getRootPosition()},
		{tree1bit, "10", *tree1bit.getChild(tree1bit.getRootPosition(), 0)},
		{tree2bits, "100", *tree2bits.getChild(tree2bits.getRootPosition(), 0)},
		{tree3bits, "1000", *tree3bits.getChild(tree3bits.getRootPosition(), 0)},
		{tree1bit, "101", *tree1bit.getChild(tree1bit.getChild(tree1bit.getRootPosition(), 0), 1)},
		{tree2bits, "10011", *tree2bits.getChild(tree2bits.getChild(tree2bits.getRootPosition(), 0), 3)},
		{tree3bits, "1000101", *tree3bits.getChild(tree3bits.getChild(tree3bits.getRootPosition(), 0), 5)},
	}

	for _, et := range encodingTests {
		t.Run(fmt.Sprintf("%v bits: %s", et.t.cfg.bitsPerIndex, et.bin), func(t *testing.T) {
			exp, err := strconv.ParseInt(et.bin, 2, 64)
			require.NoError(t, err)
			require.Equal(t, exp, (*big.Int)(&et.p).Int64())
		})
	}
}

func TestGetParentAndGetChild(t *testing.T) {

	tree1bit, tree2bits, tree3bits := getTreesWith1_2_3BitsPerIndex(t)

	parentChildTests := []struct {
		t      *Tree
		parent string
		child  string
		i      ChildIndex
	}{
		{tree1bit, "1", "10", 0},
		{tree1bit, "1", "11", 1},
		{tree1bit, "11", "111", 1},
		{tree2bits, "1", "100", 0},
		{tree2bits, "1", "101", 1},
		{tree2bits, "1000100", "100010011", 3},
		{tree3bits, "1", "1100", 4},
		{tree3bits, "1111", "1111101", 5},
	}

	for _, test := range parentChildTests {
		t.Run(fmt.Sprintf("%v bits: %s -(%v)-> %s", test.t.cfg.bitsPerIndex, test.parent, test.i, test.child), func(t *testing.T) {
			child, err := makePositionFromStringForTesting(test.child)
			require.NoError(t, err)
			parent, err := makePositionFromStringForTesting(test.parent)
			require.NoError(t, err)
			require.True(t, test.t.getParent(&child).equals(&parent))
			require.True(t, test.t.getChild(&parent, test.i).equals(&child))
		})
	}
}

func TestNewConfigError(t *testing.T) {

	_, err := NewConfig(nil, 5, 8, 6, nil)
	require.Error(t, err)
	require.IsType(t, InvalidConfigError{}, err)

	c, err := NewConfig(nil, 2, 4, 32, nil)
	require.NoError(t, err)

	require.Equal(t, 1<<c.bitsPerIndex, c.childrenPerNode)
}

func TestIsPositionOnPathToKey(t *testing.T) {

	tree1bit, tree2bits, tree3bits := getTreesWith1_2_3BitsPerIndex(t)

	tests := []struct {
		t        *Tree
		p        string
		k        Key
		expected bool
	}{
		{tree1bit, "1", []byte{0x00, 0x01, 0x02}, true},
		{tree2bits, "1", []byte{0x00, 0x01, 0x02}, true},
		{tree3bits, "1", []byte{0x00, 0x01, 0x02}, true},
		{tree1bit, "10", []byte{0x00, 0x01, 0x02}, true},
		{tree2bits, "100", []byte{0x00, 0x01, 0x02}, true},
		{tree3bits, "1000", []byte{0x00, 0x01, 0x02}, true},
		{tree1bit, "11", []byte{0x00, 0x01, 0x02}, false},
		{tree2bits, "110", []byte{0x00, 0x01, 0x02}, false},
		{tree3bits, "1100", []byte{0x00, 0x01, 0x02}, false},
		{tree1bit, "101", []byte{0x00, 0x01, 0x02}, false},
		{tree2bits, "1000000000000000100", []byte{0x00, 0x01, 0x02}, true},
		{tree2bits, "1000000000000000000", []byte{0x00, 0x01, 0x02}, false},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v %v", test.t.cfg.bitsPerIndex, test.p, test.k), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.p)
			require.NoError(t, err)
			require.Equal(t, test.expected, test.t.isPositionOnPathToKey(&pos, test.k))
		})
	}

}

func TestGetSiblingPositionsOnPathToKey(t *testing.T) {

	tree1bit, tree2bits, _ := getTreesWith1_2_3BitsPerIndex(t)

	tests := []struct {
		t            *Tree
		k            Key
		expPosOnPath [][]string
	}{
		{tree1bit, []byte{}, nil},
		{tree1bit, []byte{0xf0}, [][]string{{"111110001"}, {"11111001"}, {"1111101"}, {"111111"}, {"11110"}, {"1110"}, {"110"}, {"10"}}},
		{tree2bits, []byte{0xf0}, [][]string{{"111110001", "111110010", "111110011"}, {"1111101", "1111110", "1111111"}, {"11100", "11101", "11110"}, {"100", "101", "110"}}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v", test.t.cfg.bitsPerIndex, test.k), func(t *testing.T) {
			posOnPath, err := test.t.getSiblingPositionsOnPathToKey(test.k)
			if test.expPosOnPath == nil {
				require.Error(t, err)
				require.IsType(t, InvalidKeyError{}, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, len(test.expPosOnPath), len(posOnPath))
			for i, expPosAtLevel := range test.expPosOnPath {
				require.Equal(t, len(test.expPosOnPath[i]), len(posOnPath[i]))
				for _, expPosStr := range expPosAtLevel {
					expPos, err := makePositionFromStringForTesting(expPosStr)
					require.NoError(t, err)
					res := false
					for _, sib := range posOnPath[i] {
						if sib.equals(&expPos) {
							res = true
							break
						}
					}
					require.True(t, res, "sibling %v not found", expPos.getBytes())
				}
			}

		})
	}
}

func makePositionFromStringForTesting(s string) (Position, error) {
	posInt, err := strconv.ParseInt(s, 2, 64)
	if err != nil {
		return Position{}, err
	}
	return (Position)(*big.NewInt(posInt)), nil
}

func getTreesWith1_2_3BitsPerIndex(t *testing.T) (tree1bit, tree2bits, tree3bits *Tree) {
	config1bit, err := NewConfig(nil, 1, 1, 1, nil)
	require.NoError(t, err)
	tree1bit = &Tree{cfg: config1bit}

	config2bits, err := NewConfig(nil, 2, 1, 1, nil)
	require.NoError(t, err)
	tree2bits = &Tree{cfg: config2bits}

	config3bits, err := NewConfig(nil, 3, 1, 3, nil)
	require.NoError(t, err)
	tree3bits = &Tree{cfg: config3bits}

	return tree1bit, tree2bits, tree3bits
}
