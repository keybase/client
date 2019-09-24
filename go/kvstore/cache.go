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
	TeamKeyGen keybase1.PerTeamKeyGeneration
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

// ensure initialized maps exist for intermediate data structures
func (k *KVRevisionCache) ensureIntermediateLocked(entryID keybase1.KVEntryID) {
	// call this function inside a previously acquired lock
	_, ok := k.data[entryID.TeamID]
	if !ok {
		// populate intermediate data structures to prevent panics
		k.data[entryID.TeamID] = make(map[string]map[string]kvCacheEntry)
	}
	_, ok = k.data[entryID.TeamID][entryID.Namespace]
	if !ok {
		// populate intermediate data structures to prevent panics
		k.data[entryID.TeamID][entryID.Namespace] = make(map[string]kvCacheEntry)
	}
}

func (k *KVRevisionCache) Check(mctx libkb.MetaContext, entryID keybase1.KVEntryID, entryHash string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	k.ensureIntermediateLocked(entryID)
	newEntry := kvCacheEntry{
		EntryHash:  entryHash,
		TeamKeyGen: teamKeyGen,
		Revision:   revision,
	}
	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if ok {
		// the cache knows about this
		err = checkNewAgainstCachedEntry(newEntry, entry)
		if err != nil {
			mctx.Debug("KVRevisionCache hit but with a mismatch from the server: %v", err)
			return err
		}
	}
	k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey] = newEntry
	return nil
}

func (k *KVRevisionCache) FetchRevision(mctx libkb.MetaContext, entryID keybase1.KVEntryID) (revision int) {
	k.Lock()
	defer k.Unlock()
	k.ensureIntermediateLocked(entryID)
	// fetch and default to 0
	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		mctx.Debug("KVRevisionCache cache miss for %+v, defaulting revision to 0", entryID)
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
