package kvstore

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const DeletedOrNonExistent = ""

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

// Hash is a sha256 on the input string. If the string is empty, then Hash will also be an
// empty string for tracking deleted entries in perpetuity.
func (k *KVRevisionCache) hash(ciphertext *string) string {
	if ciphertext == nil || len(*ciphertext) == 0 || *ciphertext == DeletedOrNonExistent {
		return DeletedOrNonExistent
	}
	b := sha256.Sum256([]byte(*ciphertext))
	return hex.EncodeToString(b[:])
}

func (k *KVRevisionCache) checkLocked(mctx libkb.MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
	k.ensureIntermediateLocked(entryID)

	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		// this entry didn't exist in the cache, so there's nothing to check
		return nil
	}
	entryHash := k.hash(ciphertext)
	if revision < entry.Revision {
		return KVCacheError{fmt.Sprintf("cache error: revision decreased from %d to %d", entry.Revision, revision)}
	}
	if teamKeyGen < entry.TeamKeyGen {
		return KVCacheError{fmt.Sprintf("cache error: team key generation decreased from %d to %d", entry.TeamKeyGen, teamKeyGen)}
	}
	if revision == entry.Revision {
		if teamKeyGen != entry.TeamKeyGen {
			return KVCacheError{fmt.Sprintf("cache error: at the same revision (%d) team key gen cannot be different: %d -> %d", revision, entry.TeamKeyGen, teamKeyGen)}
		}
		if entryHash != entry.EntryHash {
			return KVCacheError{fmt.Sprintf("cache error: at the same revision (%d) hash of entry cannot be different: %s -> %s", revision, entry.EntryHash, entryHash)}
		}
	}
	return nil
}

func (k *KVRevisionCache) Check(mctx libkb.MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	return k.checkLocked(mctx, entryID, ciphertext, teamKeyGen, revision)
}

func (k *KVRevisionCache) Put(mctx libkb.MetaContext, entryID keybase1.KVEntryID, ciphertext *string, teamKeyGen keybase1.PerTeamKeyGeneration, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	err = k.checkLocked(mctx, entryID, ciphertext, teamKeyGen, revision)
	if err != nil {
		return err
	}

	entryHash := k.hash(ciphertext)
	newEntry := kvCacheEntry{
		EntryHash:  entryHash,
		TeamKeyGen: teamKeyGen,
		Revision:   revision,
	}
	k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey] = newEntry
	return nil
}

func (k *KVRevisionCache) checkForUpdateLocked(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int) (err error) {
	k.ensureIntermediateLocked(entryID)

	entry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		// this entry didn't exist in the cache, so there's nothing to check
		return nil
	}
	if revision <= entry.Revision {
		return NewKVRevisionError("" /* use the default out-of-date message */)
	}
	return nil
}

func (k *KVRevisionCache) CheckForUpdate(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	return k.checkForUpdateLocked(mctx, entryID, revision)
}

func (k *KVRevisionCache) MarkDeleted(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int) (err error) {
	k.Lock()
	defer k.Unlock()

	err = k.checkForUpdateLocked(mctx, entryID, revision)
	if err != nil {
		return err
	}
	existingEntry, ok := k.data[entryID.TeamID][entryID.Namespace][entryID.EntryKey]
	if !ok {
		// deleting an entry that's not been seen yet by the cache.
		// being explicit here that it's ok to use an empty entry
		existingEntry = kvCacheEntry{}
	}
	newEntry := kvCacheEntry{
		EntryHash:  DeletedOrNonExistent,
		TeamKeyGen: existingEntry.TeamKeyGen, // nothing gets encrypted here, so this should just roll forward or default to 0
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
