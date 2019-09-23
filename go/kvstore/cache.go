package kvstore

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

var _ libkb.KVRevisionCacher = (*KVRevisionCache)(nil)

type kvCacheEntry struct {
	Revision   int
	EntryHash  string
	TeamKeyGen int
}

type kvCacheData map[keybase1.TeamID]map[string] /*namespace*/ map[string] /*entry*/ kvCacheEntry

type KVRevisionCache struct {
	sync.Mutex
	data kvCacheData
}

func NewKVRevisionCache() *KVRevisionCache {
	return &KVRevisionCache{
		data: make(kvCacheData),
	}
}

func (k *KVRevisionCache) Check(teamID keybase1.TeamID, namespace, entryKey, entryHash string, teamKeyGen, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	// populate intermediate data structures
	_, ok := k.data[teamID]
	if !ok {
		k.data[teamID] = make(map[string]map[string]kvCacheEntry)
	}
	_, ok = k.data[teamID][namespace]
	if !ok {
		k.data[teamID][namespace] = make(map[string]kvCacheEntry)
	}

	newEntry := kvCacheEntry{
		EntryHash:  entryHash,
		TeamKeyGen: teamKeyGen,
		Revision:   revision,
	}
	entry, ok := k.data[teamID][namespace][entryKey]
	if ok {
		// the cache knows about this
		err = checkNewAgainstCachedEntry(newEntry, entry)
		if err != nil {
			return err
		}
	}
	k.data[teamID][namespace][entryKey] = newEntry
	return nil
}

func (k *KVRevisionCache) FetchRevision(teamID keybase1.TeamID, namespace, entryKey string) (revision int) {
	entry, ok := k.data[teamID][namespace][entryKey]
	if !ok {
		return 0
	}
	return entry.Revision
}

func Hash(ciphertext string) string {
	b := sha256.Sum256([]byte(ciphertext))
	return hex.EncodeToString(b[:])
}

func checkNewAgainstCachedEntry(newEntry, cachedEntry kvCacheEntry) error {
	if newEntry.Revision < cachedEntry.Revision {
		return fmt.Errorf("cache error: revision decreased from %d to %d", cachedEntry.Revision, newEntry.Revision)
	}
	if newEntry.TeamKeyGen < cachedEntry.TeamKeyGen {
		return fmt.Errorf("cache error: team key generation decreased from %d to %d", cachedEntry.TeamKeyGen, newEntry.TeamKeyGen)
	}
	if newEntry.Revision == cachedEntry.Revision {
		if newEntry.TeamKeyGen != cachedEntry.TeamKeyGen {
			return fmt.Errorf("cache error: at the same revision (%d) team key gen cannot be different: %d -> %d", newEntry.Revision, cachedEntry.TeamKeyGen, newEntry.TeamKeyGen)
		}
		if newEntry.EntryHash != cachedEntry.EntryHash {
			return fmt.Errorf("cache error: at the same revision (%d) hash of entry cannot be different: %s -> %s", newEntry.Revision, cachedEntry.EntryHash, newEntry.EntryHash)
		}
	}
	return nil
}
