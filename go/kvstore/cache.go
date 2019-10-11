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

func NewKVRevisionCache(g *libkb.GlobalContext) *KVRevisionCache {
	kvr := &KVRevisionCache{
		data: make(kvCacheData),
	}
	g.AddLogoutHook(kvr, "kvstore revision cache")
	g.AddDbNukeHook(kvr, "kvstore revision cache")
	return kvr
}

type KVRevisionCacheError struct {
	Message string
}

func (e KVRevisionCacheError) Error() string {
	return e.Message
}

func (k *KVRevisionCache) PutCheck(mctx libkb.MetaContext, entryID keybase1.KVEntryID, entryHash string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
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

func (k *KVRevisionCache) Fetch(mctx libkb.MetaContext, entryID keybase1.KVEntryID) (entryHash string,
	teamKeyGen keybase1.PerTeamKeyGeneration, revision int) {
	k.Lock()
	defer k.Unlock()
	k.ensureIntermediateLocked(entryID)
	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		mctx.Debug("KVRevisionCache cache miss for %+v, defaulting revision to 0", entryID)
		return "", keybase1.PerTeamKeyGeneration(0), 0
	}
	return entry.EntryHash, entry.TeamKeyGen, entry.Revision
}

// Hash is a sha256 on the input string. If the string is empty, then Hash will also be an
// empty string for tracking "deleted" entries in perpetuity.
func Hash(ciphertext string) string {
	if len(ciphertext) == 0 {
		return ""
	}
	b := sha256.Sum256([]byte(ciphertext))
	return hex.EncodeToString(b[:])
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

func checkNewAgainstCachedEntry(newEntry, cachedEntry kvCacheEntry) error {
	if newEntry.Revision < cachedEntry.Revision {
		return KVRevisionCacheError{fmt.Sprintf("cache error: revision decreased from %d to %d", cachedEntry.Revision, newEntry.Revision)}
	}
	if newEntry.TeamKeyGen < cachedEntry.TeamKeyGen {
		return KVRevisionCacheError{fmt.Sprintf("cache error: team key generation decreased from %d to %d", cachedEntry.TeamKeyGen, newEntry.TeamKeyGen)}
	}
	if newEntry.Revision == cachedEntry.Revision {
		if newEntry.TeamKeyGen != cachedEntry.TeamKeyGen {
			return KVRevisionCacheError{fmt.Sprintf("cache error: at the same revision (%d) team key gen cannot be different: %d -> %d", newEntry.Revision, cachedEntry.TeamKeyGen, newEntry.TeamKeyGen)}
		}
		if newEntry.EntryHash != cachedEntry.EntryHash {
			return KVRevisionCacheError{fmt.Sprintf("cache error: at the same revision (%d) hash of entry cannot be different: %s -> %s", newEntry.Revision, cachedEntry.EntryHash, newEntry.EntryHash)}
		}
	}
	return nil
}

func (k *KVRevisionCache) OnLogout(m libkb.MetaContext) error {
	k.data = make(kvCacheData)
	return nil
}

func (k *KVRevisionCache) OnDbNuke(m libkb.MetaContext) error {
	k.data = make(kvCacheData)
	return nil
}
