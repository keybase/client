package merkletree2

import (
	"fmt"
	"math/big"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncoding(t *testing.T) {

	config1bit, _ := NewConfig(nil, 1, 1, 3, nil)
	tree1bit := &Tree{cfg: config1bit}
	config2bits, _ := NewConfig(nil, 2, 1, 3, nil)
	tree2bits := &Tree{cfg: config2bits}
	config3bits, _ := NewConfig(nil, 3, 1, 3, nil)
	tree3bits := &Tree{cfg: config3bits}

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

	config1bit, _ := NewConfig(nil, 1, 1, 3, nil)
	tree1bit := &Tree{cfg: config1bit}
	config2bits, _ := NewConfig(nil, 2, 1, 3, nil)
	tree2bits := &Tree{cfg: config2bits}
	config3bits, _ := NewConfig(nil, 3, 1, 3, nil)
	tree3bits := &Tree{cfg: config3bits}

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

	config1bit, _ := NewConfig(nil, 1, 1, 3, nil)
	tree1bit := &Tree{cfg: config1bit}
	config2bits, _ := NewConfig(nil, 2, 1, 3, nil)
	tree2bits := &Tree{cfg: config2bits}
	config3bits, _ := NewConfig(nil, 3, 1, 3, nil)
	tree3bits := &Tree{cfg: config3bits}

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

func TestGetAllSiblings(t *testing.T) {

	config1bit, _ := NewConfig(nil, 1, 1, 3, nil)
	tree1bit := &Tree{cfg: config1bit}
	config2bits, _ := NewConfig(nil, 2, 1, 3, nil)
	tree2bits := &Tree{cfg: config2bits}
	config3bits, _ := NewConfig(nil, 3, 1, 3, nil)
	tree3bits := &Tree{cfg: config3bits}

	tests := []struct {
		t        *Tree
		p        string
		siblings []string
		parent   string
	}{
		{tree1bit, "1", nil, ""},
		{tree1bit, "11", []string{"10"}, "1"},
		{tree1bit, "10", []string{"11"}, "1"},
		{tree1bit, "101", []string{"100"}, "10"},
		{tree2bits, "10010", []string{"10000", "10001", "10011"}, "100"},
		{tree3bits, "1001111", []string{"1001000", "1001001", "1001010", "1001011", "1001100", "1001101", "1001110"}, "1001"},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%v bits: %v", test.t.cfg.bitsPerIndex, test.p), func(t *testing.T) {
			pos, err := makePositionFromStringForTesting(test.p)
			require.NoError(t, err)
			sibs, par := test.t.getAllSiblings(&pos)
			if test.siblings == nil {
				require.Nil(t, sibs)
				require.Nil(t, par)
				return
			}
			parExp, err := makePositionFromStringForTesting(test.parent)
			require.NoError(t, err)
			require.True(t, parExp.equals(par))
			require.Equal(t, len(test.siblings), len(sibs))
			siblingsExpected := make([]Position, len(test.siblings))
			for i, sib := range test.siblings {
				siblingsExpected[i], err = makePositionFromStringForTesting(sib)
				require.NoError(t, err)
			}
			for _, sibExp := range siblingsExpected {
				res := false
				for _, sib := range sibs {
					if sib.equals(&sibExp) {
						res = true
						break
					}
				}
				require.True(t, res, "sibling %v not found", sibExp.getBytes())
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
