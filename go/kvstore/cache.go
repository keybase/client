package kvstore

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const DELETED_OR_NONEXISTENT = ""

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

// Hash is a sha256 on the input string. If the string is empty, then Hash will also be an
// empty string for tracking deleted entries in perpetuity.
func (k *KVRevisionCache) hash(ciphertext *string) string {
	if ciphertext == nil || len(*ciphertext) == 0 || *ciphertext == DELETED_OR_NONEXISTENT {
		return DELETED_OR_NONEXISTENT
	}
	b := sha256.Sum256([]byte(*ciphertext))
	return hex.EncodeToString(b[:])
}

func (k *KVRevisionCache) Check(mctx libkb.MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
	k.Lock()
	defer k.Unlock()
	k.ensureIntermediateLocked(entryID)

	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		// this entry didn't exist in the cache, so there's nothing to check
		return nil
	}
	entryHash := k.hash(ciphertext)
	if revision < entry.Revision {
		return KVRevisionCacheError{fmt.Sprintf("cache error: revision decreased from %d to %d", entry.Revision, revision)}
	}
	if teamKeyGen < entry.TeamKeyGen {
		return KVRevisionCacheError{fmt.Sprintf("cache error: team key generation decreased from %d to %d", entry.TeamKeyGen, teamKeyGen)}
	}
	if revision == entry.Revision {
		if teamKeyGen != entry.TeamKeyGen {
			return KVRevisionCacheError{fmt.Sprintf("cache error: at the same revision (%d) team key gen cannot be different: %d -> %d", revision, entry.TeamKeyGen, teamKeyGen)}
		}
		if entryHash != entry.EntryHash {
			return KVRevisionCacheError{fmt.Sprintf("cache error: at the same revision (%d) hash of entry cannot be different: %s -> %s", revision, entry.EntryHash, entryHash)}
		}
	}
	return nil
}

func (k *KVRevisionCache) Put(mctx libkb.MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	k.ensureIntermediateLocked(entryID)
	entryHash := k.hash(ciphertext)
	newEntry := kvCacheEntry{
		EntryHash:  entryHash,
		TeamKeyGen: teamKeyGen,
		Revision:   revision,
	}
	k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey] = newEntry
	return nil
}

func (k *KVRevisionCache) CheckDeletable(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int) (err error) {
	k.Lock()
	defer k.Unlock()
	k.ensureIntermediateLocked(entryID)

	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		return KVRevisionCacheError{fmt.Sprintf("cannot delete an unknown entry")}
	}
	entryHash := DELETED_OR_NONEXISTENT
	if revision < entry.Revision {
		return KVRevisionCacheError{fmt.Sprintf("cache error: revision decreased from %d to %d", entry.Revision, revision)}
	}
	if revision == entry.Revision {
		if entryHash != entry.EntryHash {
			return KVRevisionCacheError{fmt.Sprintf("cache error: at the same revision (%d) hash of entry cannot be different: %s -> %s", revision, entry.EntryHash, entryHash)}
		}
	}
	return nil
}

func (k *KVRevisionCache) MarkDeleted(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int) (err error) {
	k.Lock()
	defer k.Unlock()
	k.ensureIntermediateLocked(entryID)

	existingEntry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		return KVRevisionCacheError{fmt.Sprintf("cannot delete an unknown entry")}
	}

	newEntry := kvCacheEntry{
		EntryHash:  DELETED_OR_NONEXISTENT,
		TeamKeyGen: existingEntry.TeamKeyGen, // nothing gets encrypted here, so this should just roll forward
		Revision:   revision,
	}
	k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey] = newEntry

	return nil
}

// Inspect is only really useful for testing
func (k *KVRevisionCache) Inspect(entryID keybase1.KVEntryID) (entryHash string, generation keybase1.PerTeamKeyGeneration, revision int) {
	entry := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	return entry.EntryHash, entry.TeamKeyGen, entry.Revision
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

func (k *KVRevisionCache) OnLogout(m libkb.MetaContext) error {
	k.data = make(kvCacheData)
	return nil
}

func (k *KVRevisionCache) OnDbNuke(m libkb.MetaContext) error {
	k.data = make(kvCacheData)
	return nil
}
