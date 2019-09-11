package ephemeral

import (
	"fmt"
	"log"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

const teamEKBoxStorageDBVersion = 5

type teamEKBoxCacheItem struct {
	TeamEKBoxed keybase1.TeamEphemeralKeyBoxed
	Err         *EphemeralKeyError
}

func newTeamEKBoxCacheItem(teamEKBoxed keybase1.TeamEphemeralKeyBoxed, err error) teamEKBoxCacheItem {
	var ekErr *EphemeralKeyError
	if e, ok := err.(EphemeralKeyError); ok {
		ekErr = &e
	}
	return teamEKBoxCacheItem{
		TeamEKBoxed: teamEKBoxed,
		Err:         ekErr,
	}
}

func (c teamEKBoxCacheItem) HasError() bool {
	return c.Err != nil
}

func (c teamEKBoxCacheItem) Error() error {
	if c.HasError() {
		return *c.Err
	}
	return nil
}

type teamEKBoxCache map[keybase1.EkGeneration]teamEKBoxCacheItem
type TeamEKBoxMap map[keybase1.EkGeneration]keybase1.TeamEphemeralKeyBoxed
type TeamEKMap map[keybase1.EkGeneration]keybase1.TeamEphemeralKey

func teamKey(mctx libkb.MetaContext, teamID keybase1.TeamID) string {
	return fmt.Sprintf("%s-%s", teamID, mctx.G().Env.GetUsername())
}

// We cache TeamEKBoxes from the server in a LRU and a persist to a local
// KVStore.
type TeamEKBoxStorage struct {
	sync.Mutex
	cache *teamEKCache
	keyer EphemeralKeyer
}

func NewTeamEKBoxStorage(keyer EphemeralKeyer) *TeamEKBoxStorage {
	return &TeamEKBoxStorage{
		cache: newTeamEKCache(),
		keyer: keyer,
	}
}

func (s *TeamEKBoxStorage) dbKey(mctx libkb.MetaContext, teamID keybase1.TeamID) (dbKey libkb.DbKey, err error) {
	uv, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return dbKey, err
	}
	key := fmt.Sprintf("teamEphemeralKeyBox-%s-%s-%s-%d", s.keyer.Type(),
		teamKey(mctx, teamID), uv.EldestSeqno, teamEKBoxStorageDBVersion)
	return libkb.DbKey{
		Typ: libkb.DBTeamEKBox,
		Key: key,
	}, nil
}

func (s *TeamEKBoxStorage) Get(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (teamEK keybase1.TeamEphemeralKey, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#Get: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	s.Lock()

	cache, found, err := s.getCacheForTeamID(mctx, teamID)
	if err != nil {
		s.Unlock()
		return teamEK, err
	} else if !found {
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(mctx, teamID, generation, contentCtime)
	}

	cacheItem, ok := cache[generation]
	if !ok {
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(mctx, teamID, generation, contentCtime)
	}

	defer s.Unlock() // release the lock after we unbox
	if cacheItem.HasError() {
		return teamEK, cacheItem.Error()
	}

	teamEK, err = s.keyer.Unbox(mctx, cacheItem.TeamEKBoxed, contentCtime)
	if err != nil { // if we can no longer unbox this, store the error
		if perr := s.putLocked(mctx, teamID, generation, keybase1.TeamEphemeralKeyBoxed{}, err); perr != nil {
			mctx.Debug("unable to store unboxing error %v", perr)
		}
	}
	return teamEK, err
}

func (s *TeamEKBoxStorage) getCacheForTeamID(mctx libkb.MetaContext, teamID keybase1.TeamID) (cache teamEKBoxCache, found bool, err error) {
	cache, found = s.cache.GetMap(mctx, teamID)
	if found {
		return cache, found, nil
	}

	key, err := s.dbKey(mctx, teamID)
	if err != nil {
		return nil, false, err
	}
	cache = make(teamEKBoxCache)
	found, err = mctx.G().GetKVStore().GetInto(&cache, key)
	if err != nil {
		return nil, found, err
	} else if found {
		s.cache.PutMap(mctx, teamID, cache)
	}
	return cache, found, err
}

type TeamEKBoxedResponse struct {
	Result *struct {
		Box              string                `json:"box"`
		UserEKGeneration keybase1.EkGeneration `json:"user_ek_generation"`
		Sig              string                `json:"sig"`
	} `json:"result"`
}

func (s *TeamEKBoxStorage) fetchAndStore(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (teamEK keybase1.TeamEphemeralKey, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#fetchAndStore: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	// cache unboxing/missing box errors so we don't continually try to fetch
	// something nonexistent.
	defer func() {
		if _, ok := err.(EphemeralKeyError); ok {
			s.Lock()
			defer s.Unlock()
			if perr := s.putLocked(mctx, teamID, generation, keybase1.TeamEphemeralKeyBoxed{}, err); perr != nil {
				mctx.Debug("unable to store error %v", perr)
			}
		}
	}()

	teamEKBoxed, err := s.keyer.Fetch(mctx, teamID, generation, contentCtime)
	if err != nil {
		return teamEK, err
	}
	teamEK, err = s.keyer.Unbox(mctx, teamEKBoxed, contentCtime)
	if err != nil {
		return teamEK, err
	}

	// Store the boxed version, return the unboxed
	err = s.Put(mctx, teamID, generation, teamEKBoxed)
	return teamEK, err
}

func (s *TeamEKBoxStorage) Put(mctx libkb.MetaContext, teamID keybase1.TeamID,
	generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEphemeralKeyBoxed) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.putLocked(mctx, teamID, generation, teamEKBoxed, nil /* ekErr */)
}

func (s *TeamEKBoxStorage) putLocked(mctx libkb.MetaContext, teamID keybase1.TeamID,
	generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEphemeralKeyBoxed, ekErr error) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#putLocked: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	// sanity check that we got the right generation
	if teamEKBoxed.Generation() != generation && ekErr == nil {
		return newEKCorruptedErr(mctx, TeamEKKind, generation, teamEKBoxed.Generation())
	}

	key, err := s.dbKey(mctx, teamID)
	if err != nil {
		return err
	}
	cache, _, err := s.getCacheForTeamID(mctx, teamID)
	if err != nil {
		return err
	}
	cache[generation] = newTeamEKBoxCacheItem(teamEKBoxed, ekErr)
	if err = mctx.G().GetKVStore().PutObj(key, nil, cache); err != nil {
		return err
	}
	s.cache.PutMap(mctx, teamID, cache)
	return nil
}

func (s *TeamEKBoxStorage) Delete(mctx libkb.MetaContext, teamID keybase1.TeamID,
	generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.deleteMany(mctx, teamID, []keybase1.EkGeneration{generation})
}

func (s *TeamEKBoxStorage) deleteMany(mctx libkb.MetaContext, teamID keybase1.TeamID,
	generations []keybase1.EkGeneration) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#delete: teamID:%v, generations:%v", teamID, generations), func() error { return err })()

	cache, found, err := s.getCacheForTeamID(mctx, teamID)
	if err != nil {
		return err
	} else if !found {
		return nil
	}

	for _, generation := range generations {
		delete(cache, generation)
	}

	key, err := s.dbKey(mctx, teamID)
	if err != nil {
		return err
	}
	if err = mctx.G().GetKVStore().PutObj(key, nil, cache); err != nil {
		return err
	}
	s.cache.PutMap(mctx, teamID, cache)
	return nil
}

func (s *TeamEKBoxStorage) PurgeCacheForTeamID(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#PurgeCacheForTeamID: teamID:%v", teamID), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	key, err := s.dbKey(mctx, teamID)
	if err != nil {
		return err
	}
	cache := make(teamEKBoxCache)
	if err = mctx.G().GetKVStore().PutObj(key, nil, cache); err != nil {
		return err
	}
	s.cache.PutMap(mctx, teamID, cache)
	return nil
}

func (s *TeamEKBoxStorage) DeleteExpired(mctx libkb.MetaContext, teamID keybase1.TeamID,
	merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#DeleteExpired: teamID:%v", teamID), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, found, err := s.getCacheForTeamID(mctx, teamID)
	if err != nil {
		return nil, err
	} else if !found {
		return nil, nil
	}

	merkleCtime := keybase1.TimeFromSeconds(merkleRoot.Ctime()).Time()
	// We delete expired and invalid cache entries but only return the expired.
	toDelete := []keybase1.EkGeneration{}
	for generation, cacheItem := range cache {
		// purge any cached errors here so they don't stick around forever.
		if cacheItem.HasError() {
			toDelete = append(toDelete, generation)
		} else {
			keyAge := merkleCtime.Sub(cacheItem.TeamEKBoxed.Ctime().Time())
			// TeamEKs will never encrypt new data if the current key is older than
			// libkb.EphemeralKeyGenInterval, thus the maximum lifetime of
			// ephemeral content will not exceed libkb.MinEphemeralKeyLifetime =
			// libkb.MaxEphemeralContentLifetime + libkb.EphemeralKeyGenInterval
			if keyAge >= libkb.MinEphemeralKeyLifetime {
				expired = append(expired, generation)
			}
		}
	}
	toDelete = append(toDelete, expired...)
	return expired, s.deleteMany(mctx, teamID, toDelete)
}

func (s *TeamEKBoxStorage) GetAll(mctx libkb.MetaContext, teamID keybase1.TeamID) (teamEKs TeamEKMap, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#GetAll: teamID:%v", teamID), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	teamEKs = make(TeamEKMap)
	cache, found, err := s.getCacheForTeamID(mctx, teamID)
	if err != nil {
		return nil, err
	} else if !found {
		return nil, nil
	}

	for generation, cacheItem := range cache {
		if cacheItem.HasError() {
			continue
		}
		teamEK, err := s.keyer.Unbox(mctx, cacheItem.TeamEKBoxed, nil)
		if err != nil {
			return nil, err
		}
		teamEKs[generation] = teamEK
	}
	return teamEKs, err
}

func (s *TeamEKBoxStorage) ClearCache() {
	s.Lock()
	defer s.Unlock()
	s.cache.Clear()
}

func (s *TeamEKBoxStorage) MaxGeneration(mctx libkb.MetaContext, teamID keybase1.TeamID, includeErrs bool) (maxGeneration keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#MaxGeneration: teamID:%v", teamID), func() error { return nil })()

	s.Lock()
	defer s.Unlock()

	maxGeneration = -1
	cache, _, err := s.getCacheForTeamID(mctx, teamID)
	if err != nil {
		return maxGeneration, err
	}

	for generation, cacheItem := range cache {
		if cacheItem.HasError() && !includeErrs {
			continue
		}
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

// --------------------------------------------------

const MemCacheLRUSize = 1000

// Store some TeamEKBoxes's in memory. Threadsafe.
type teamEKCache struct {
	lru *lru.Cache
	sync.Mutex
}

func newTeamEKCache() *teamEKCache {
	nlru, err := lru.New(MemCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &teamEKCache{
		lru: nlru,
	}
}

func (s *teamEKCache) GetMap(mctx libkb.MetaContext, teamID keybase1.TeamID) (cache teamEKBoxCache, found bool) {
	s.Lock()
	defer s.Unlock()

	untyped, found := s.lru.Get(s.key(mctx, teamID))
	if !found {
		return nil, found
	}
	cache, ok := untyped.(teamEKBoxCache)
	if !ok {
		mctx.Debug("TeamEK teamEKCache got bad type from lru: %T", untyped)
		return nil, found
	}
	return cache, found
}

func (s *teamEKCache) PutMap(mctx libkb.MetaContext, teamID keybase1.TeamID, cache teamEKBoxCache) {
	s.lru.Add(s.key(mctx, teamID), cache)
}

func (s *teamEKCache) Clear() {
	s.lru.Purge()
}

func (s *teamEKCache) key(mctx libkb.MetaContext, teamID keybase1.TeamID) (key string) {
	return teamKey(mctx, teamID)
}
