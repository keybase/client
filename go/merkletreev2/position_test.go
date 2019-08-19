package merkletreev2

import (
	"math/big"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPositionEncoding(t *testing.T) {

	_, err := NewConfig(nil, 5, 8, nil)
	require.Error(t, err)

	var c Config
	c, err = NewConfig(nil, 4, 4, nil)
	require.NoError(t, err)

	tree := NewTree(c)

	r := tree.getRootPosition()
	require.Equal(t, (*big.Int)(&r).Int64(), int64(1))

	_, err = tree.getFather(&r)
	require.Error(t, err)
	require.Equal(t, ErrRootHasNoFather, err)

	var exp int64

	c3 := tree.getChildPosition(r, ChildIndex(3))
	// 111 in binary = 7
	exp, _ = strconv.ParseInt("111", 2, 64)
	require.Equal(t, exp, (*big.Int)(&c3).Int64())

	c32 := tree.getChildPosition(c3, ChildIndex(2))
	exp, _ = strconv.ParseInt("11110", 2, 64)
	require.Equal(t, exp, (*big.Int)(&c32).Int64())

	var c32f Position
	c32f, err = tree.getFather(&c32)
	require.NoError(t, err)
	require.True(t, c32f.equals(&c3))

}

func TestKeysAndPaths(t *testing.T) {

	c, err := NewConfig(nil, 16, 4, nil)
	require.NoError(t, err)

	tree := NewTree(c)

	k := Key([]byte{0x01, 0x02, 0x03, 0x04, 0x28})

	r := tree.getRootPosition()
	require.Equal(t, (*big.Int)(&r).Int64(), int64(1))

	require.True(t, tree.isPositionOnPathToKey(&r, k))

	p := tree.getChildPosition(r, 0)
	require.True(t, tree.isPositionOnPathToKey(&p, k), "Error on position p: %v", (*big.Int)(&p).Int64())

	q := tree.getChildPosition(p, 1)
	require.True(t, tree.isPositionOnPathToKey(&q, k))

	q = tree.getChildPosition(p, 2)
	require.False(t, tree.isPositionOnPathToKey(&q, k))

	// root has no siblings and no father
	_, _, err = tree.getAllSiblings(&r)
	require.Error(t, err)

	sibs, father, err2 := tree.getAllSiblings(&q)
	require.NoError(t, err2)
	require.True(t, father.equals(&p))
	s0father, err3 := tree.getFather(&sibs[0])
	require.NoError(t, err3)
	require.True(t, s0father.equals(&father))
	require.True(t, uint(len(sibs)) == tree.cfg.childrenPerNode-1)

}
