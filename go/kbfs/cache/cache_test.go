package cache

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type testItem struct {
	id   int
	size int
}

func (t testItem) Size() int { return t.size }

func TestRandomEvictedCacheNoDuplicateKeysOnUpdate(t *testing.T) {
	// Each entry is 3 bytes: entrySize = 2*key.Size() + value.Size() = 2*1 + 1.
	// Capacity of 9 holds exactly 3 entries.
	c := NewRandomEvictedCache(9).(*randomEvictedCache)

	k1 := testItem{id: 1, size: 1}
	k2 := testItem{id: 2, size: 1}
	k3 := testItem{id: 3, size: 1}
	v1 := testItem{id: 10, size: 1}

	c.Add(k1, v1)
	c.Add(k2, v1)
	c.Add(k3, v1)

	require.Equal(t, 3, len(c.keys), "expected 3 keys after 3 inserts")

	// Update k1 — before the fix this appended a duplicate to c.keys.
	c.Add(k1, v1)
	c.Add(k1, v1)

	require.Equal(t, len(c.data), len(c.keys), "c.keys length != c.data length after updates; duplicate key entries exist")

	// Verify the updated key is still retrievable.
	got, ok := c.Get(k1)
	require.True(t, ok, "k1 not found after update")
	require.Equal(t, v1.id, got.(testItem).id)
}

func TestRandomEvictedCacheBytesAccountingOnUpdate(t *testing.T) {
	// Each entry: 2*1 + 1 = 3 bytes. Capacity 9 → room for 3.
	c := NewRandomEvictedCache(9).(*randomEvictedCache)

	k1 := testItem{id: 1, size: 1}
	v1 := testItem{id: 10, size: 1}

	c.Add(k1, v1)
	afterInsert := c.cachedBytes

	// Updating with same-sized value should leave cachedBytes unchanged.
	c.Add(k1, v1)
	require.Equal(t, afterInsert, c.cachedBytes, "cachedBytes changed on same-size update")
	require.Equal(t, 1, len(c.keys), "expected 1 key slot after insert+update")
}

func TestRandomEvictedCacheEviction(t *testing.T) {
	// Capacity 6: room for 2 entries (3 bytes each).
	c := NewRandomEvictedCache(6).(*randomEvictedCache)

	k1 := testItem{id: 1, size: 1}
	k2 := testItem{id: 2, size: 1}
	k3 := testItem{id: 3, size: 1}
	v := testItem{id: 99, size: 1}

	c.Add(k1, v)
	c.Add(k2, v)
	// Adding k3 must evict one entry.
	c.Add(k3, v)

	require.Equal(t, len(c.data), len(c.keys), "c.keys length != c.data length after eviction")
	require.Equal(t, 2, len(c.data), "expected 2 entries after eviction")
	require.Equal(t, 6, c.cachedBytes, "expected cachedBytes=6 after eviction")
}
