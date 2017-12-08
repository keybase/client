package lru

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"testing"
)

type obj struct {
	I int
	S string
}

func (o obj) DbKey() libkb.DbKey {
	return libkb.DbKey{Typ: 20, Key: o.S}
}

func (o obj) MemKey() string {
	return o.S
}

func TestLRU(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	var objs []obj

	N := 10
	for i := 0; i < N; i++ {
		objs = append(objs, obj{i, fmt.Sprintf("%d", i)})
	}

	lru := NewLRU(tc.G, 2, 1, obj{})
	ctx := context.TODO()

	testPut := func(i int) {
		err := lru.Put(ctx, tc.G, objs[i], &objs[i])
		require.NoError(t, err)
	}

	testPut(0)
	testPut(1)

	var stats stats

	testGet := func(i int, memHit bool) {
		ret, err := lru.Get(ctx, tc.G, objs[i])
		require.NoError(t, err)
		require.Equal(t, ret, &objs[i])
		if memHit {
			stats.memHit++
		} else {
			stats.diskHit++
		}
	}

	testMiss := func(i int, isStale bool) {
		ret, err := lru.Get(ctx, tc.G, objs[i])
		require.NoError(t, err)
		require.Nil(t, ret)
		if isStale {
			stats.diskStale++
		} else {
			stats.miss++
		}
	}

	testStats := func() {
		require.Equal(t, stats, lru.stats)
	}

	testGet(0, true)
	testGet(1, true)
	testMiss(2, false)
	testStats()
	lru.ClearMemory()
	testGet(0, false)
	testGet(1, false)
	testStats()

	// All of the following should be disk hits
	for i := 0; i < N; i++ {
		testPut(i)
	}
	for i := 0; i < N; i++ {
		testGet(i, false)
	}
	testStats()

	// test that a put of the old version fails to get when we
	// want the new version
	testPut(0)
	lru.ClearMemory()
	lru.version = 2
	testMiss(0, true)
	testStats()
}
