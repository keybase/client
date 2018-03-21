package lru

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestDiskLRUBasic(t *testing.T) {
	tc := libkb.SetupTest(t, "TestDiskLRU", 1)
	defer tc.Cleanup()

	ctx := context.TODO()
	l := NewDiskLRU("mike", 1, 10)

	k := "mikem:square_360"
	v := "Library/Caches/473847384738.jpg"
	_, err := l.Put(ctx, tc.G, k, v)
	require.NoError(t, err)
	found, getRes, err := l.Get(ctx, tc.G, k)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, v, getRes.Value.(string))
	l.ClearMemory(ctx, tc.G)
	found, getRes, err = l.Get(ctx, tc.G, k)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, v, getRes.Value.(string))
	found, getRes, err = l.Get(ctx, tc.G, "missing")
	require.NoError(t, err)
	require.False(t, found)
}

func TestDiskLRUVersion(t *testing.T) {
	tc := libkb.SetupTest(t, "TestDiskLRU", 1)
	defer tc.Cleanup()

	ctx := context.TODO()
	l := NewDiskLRU("mike", 1, 10)
	l2 := NewDiskLRU("mike", 2, 10)

	k := "mikem:square_360"
	v := "Library/Caches/473847384738.jpg"
	_, err := l.Put(ctx, tc.G, k, v)
	require.NoError(t, err)
	found, getRes, err := l.Get(ctx, tc.G, k)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, v, getRes.Value.(string))
	found, getRes, err = l2.Get(ctx, tc.G, k)
	require.NoError(t, err)
	require.False(t, found)
}

func TestDiskLRUEvict(t *testing.T) {
	tc := libkb.SetupTest(t, "TestDiskLRU", 1)
	defer tc.Cleanup()

	ctx := context.TODO()
	l := NewDiskLRU("mike", 1, 2)
	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)
	initialTime := clock.Now()
	kold := "oldest"
	vold := "Library/Caches/473847384738.jpg"
	evict, err := l.Put(ctx, tc.G, kold, vold)
	require.NoError(t, err)
	require.Nil(t, evict)
	kmiddle := "middle"
	vmiddle := "middleV"
	evict, err = l.Put(ctx, tc.G, kmiddle, vmiddle)
	require.NoError(t, err)
	require.Nil(t, evict)
	knew := "new"
	vnew := "newv"
	evict, err = l.Put(ctx, tc.G, knew, vnew)
	require.NoError(t, err)
	require.NotNil(t, evict)
	require.Equal(t, kold, evict.Key)
	require.Equal(t, initialTime, evict.Ctime)

	// Promote kmiddle
	clock.Advance(time.Hour)
	found, getRes, err := l.Get(ctx, tc.G, kmiddle)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, kmiddle, getRes.Key)
	require.Equal(t, getRes.LastAccessed, clock.Now())

	evict, err = l.Put(ctx, tc.G, kold, vold)
	require.NoError(t, err)
	require.NotNil(t, evict)
	require.Equal(t, knew, evict.Key)
}

func TestDiskLRUFlush(t *testing.T) {
	tc := libkb.SetupTest(t, "TestDiskLRU", 1)
	defer tc.Cleanup()

	ctx := context.TODO()
	l := NewDiskLRU("mike", 1, 2)
	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	l.lastFlush = clock.Now()
	l.flushCh = make(chan struct{}, 5)
	k := "mikem:square_360"
	v := "Library/Caches/473847384738.jpg"
	_, err := l.Put(ctx, tc.G, k, v)
	require.NoError(t, err)
	select {
	case <-l.flushCh:
		require.Fail(t, "no flush")
	default:
	}
	clock.Advance(time.Hour)
	found, getRes, err := l.Get(ctx, tc.G, k)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, v, getRes.Value.(string))
	select {
	case <-l.flushCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no flush")
	}
}
