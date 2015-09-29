package favcache

import (
	"sort"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol"
)

// Cache is a simple cache of kbfs folder favorites.  It doesn't
// try to do anything fancy.
type Cache struct {
	set map[keybase1.Folder]bool
	sync.RWMutex
}

// New creates a Cache.
func New() *Cache {
	return &Cache{set: make(map[keybase1.Folder]bool)}
}

// Add inserts a folder into the cache.
func (c *Cache) Add(f keybase1.Folder) {
	c.Lock()
	c.set[f] = true
	c.Unlock()
}

// Delete removes a folder from the cache.
func (c *Cache) Delete(f keybase1.Folder) {
	c.Lock()
	delete(c.set, f)
	c.Unlock()
}

// List returns all the folders in the cache.
func (c *Cache) List() []keybase1.Folder {
	c.RLock()
	defer c.RUnlock()
	var keys []keybase1.Folder
	for k := range c.set {
		keys = append(keys, k)
	}
	sort.Sort(byName(keys))
	return keys
}

// sort helper to sort []keybase1.Folder by Name field.
type byName []keybase1.Folder

func (b byName) Len() int           { return len(b) }
func (b byName) Less(i, j int) bool { return b[i].Name < b[j].Name }
func (b byName) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
