package ephemeral

import (
	"context"
	"fmt"
	"log"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

const teamEKBoxStorageDBVersion = 3

type teamEKBoxCacheItem struct {
	TeamEKBoxed keybase1.TeamEkBoxed
	ErrMsg      string
	HumanMsg    string
}

func newTeamEKBoxCacheItem(teamEKBoxed keybase1.TeamEkBoxed, err error) teamEKBoxCacheItem {
	errMsg := ""
	humanMsg := ""
	if err != nil {
		errMsg = err.Error()
		if ekErr, ok := err.(EphemeralKeyError); ok {
			humanMsg = ekErr.HumanError()
		}
	}
	return teamEKBoxCacheItem{
		TeamEKBoxed: teamEKBoxed,
		ErrMsg:      errMsg,
		HumanMsg:    humanMsg,
	}
}

func (c teamEKBoxCacheItem) HasError() bool {
	return c.ErrMsg != ""
}

func (c teamEKBoxCacheItem) Error() error {
	if c.HasError() {
		return newEphemeralKeyError(c.ErrMsg, c.HumanMsg)
	}
	return nil
}

type teamEKBoxCache map[keybase1.EkGeneration]teamEKBoxCacheItem
type TeamEKBoxMap map[keybase1.EkGeneration]keybase1.TeamEkBoxed
type TeamEKMap map[keybase1.EkGeneration]keybase1.TeamEk

func teamKey(teamID keybase1.TeamID, g *libkb.GlobalContext) string {
	return fmt.Sprintf("teamEphemeralKeyBox-%s-%s", teamID, g.Env.GetUsername())
}

// We cache TeamEKBoxes from the server in a LRU and a persist to a local
// KVStore.
type TeamEKBoxStorage struct {
	libkb.Contextified
	sync.Mutex
	cache *teamEKCache
}

func NewTeamEKBoxStorage(g *libkb.GlobalContext) *TeamEKBoxStorage {
	return &TeamEKBoxStorage{
		Contextified: libkb.NewContextified(g),
		cache:        newTeamEKCache(g),
	}
}

func (s *TeamEKBoxStorage) dbKey(ctx context.Context, teamID keybase1.TeamID) (dbKey libkb.DbKey, err error) {
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return dbKey, err
	}
	key := fmt.Sprintf("%s-%s-%d", teamKey(teamID, s.G()), uv.EldestSeqno, teamEKBoxStorageDBVersion)
	return libkb.DbKey{
		Typ: libkb.DBTeamEKBox,
		Key: key,
	}, nil
}

func (s *TeamEKBoxStorage) Get(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#Get: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	s.Lock()

	cache, found, err := s.getCacheForTeamID(ctx, teamID)
	if err != nil {
		s.Unlock()
		return teamEK, err
	} else if !found {
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(ctx, teamID, generation, contentCtime)
	}

	cacheItem, ok := cache[generation]
	if !ok {
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(ctx, teamID, generation, contentCtime)
	}

	defer s.Unlock() // release the lock after we unbox
	if cacheItem.HasError() {
		return teamEK, cacheItem.Error()
	}
	return s.unbox(ctx, generation, cacheItem.TeamEKBoxed, contentCtime)
}

func (s *TeamEKBoxStorage) getCacheForTeamID(ctx context.Context, teamID keybase1.TeamID) (cache teamEKBoxCache, found bool, err error) {
	cache, found = s.cache.GetMap(teamID)
	if found {
		return cache, found, nil
	}

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return nil, false, err
	}
	cache = make(teamEKBoxCache)
	found, err = s.G().GetKVStore().GetInto(&cache, key)
	if err != nil {
		return nil, found, err
	} else if found {
		s.cache.PutMap(teamID, cache)
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

func (s *TeamEKBoxStorage) fetchAndStore(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#fetchAndStore: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id":    libkb.S{Val: string(teamID)},
			"generation": libkb.U{Val: uint64(generation)},
		},
	}

	var result TeamEKBoxedResponse
	res, err := s.G().GetAPI().Get(apiArg)
	if err != nil {
		err = errFromAppStatus(err)
		return teamEK, err
	}

	err = res.Body.UnmarshalAgain(&result)
	if err != nil {
		return teamEK, err
	}

	if result.Result == nil {
		err = newEKMissingBoxErr(ctx, s.G(), TeamEKStr, generation)
		if perr := s.put(ctx, teamID, generation, keybase1.TeamEkBoxed{}, err); perr != nil {
			s.G().Log.CDebugf(ctx, "unable to store unboxing error %v", perr)
		}
		return teamEK, err
	}

	// Although we verify the signature is valid, it's possible that this key
	// was signed with a PTK that is not our latest and greatest. We allow this
	// when we are using this ek for *decryption*. When getting a key for
	// *encryption* callers are responsible for verifying the signature is
	// signed by the latest PTK or generating a new EK. This logic currently
	// lives in ephemeral/lib.go#GetOrCreateLatestTeamEK (#newTeamEKNeeded)
	_, teamEKStatement, err := extractTeamEKStatementFromSig(result.Result.Sig)
	if err != nil {
		return teamEK, err
	} else if teamEKStatement == nil { // shouldn't happen
		return teamEK, fmt.Errorf("unable to fetch valid teamEKStatement")
	}

	teamEKMetadata := teamEKStatement.CurrentTeamEkMetadata
	if generation != teamEKMetadata.Generation {
		// sanity check that we go the right generation
		return teamEK, newEKCorruptedErr(ctx, s.G(), TeamEKStr, generation, teamEKMetadata.Generation)
	}
	teamEKBoxed := keybase1.TeamEkBoxed{
		Box:              result.Result.Box,
		UserEkGeneration: result.Result.UserEKGeneration,
		Metadata:         teamEKMetadata,
	}

	teamEK, err = s.unbox(ctx, generation, teamEKBoxed, contentCtime)
	if err != nil {
		switch err.(type) {
		// cache unboxing/missing box errors so we don't continually try to
		// fetch something nonexistent.
		case EphemeralKeyError:
			if perr := s.put(ctx, teamID, generation, teamEKBoxed, err); perr != nil {
				s.G().Log.CDebugf(ctx, "unable to store unboxing error %v", perr)
			}
		}
		return teamEK, err
	}

	seed := TeamEKSeed(teamEK.Seed)
	keypair := seed.DeriveDHKey()

	if !keypair.GetKID().Equal(teamEKMetadata.Kid) {
		return teamEK, fmt.Errorf("Failed to verify server given seed against signed KID %s", teamEKMetadata.Kid)
	}

	// Store the boxed version, return the unboxed
	err = s.Put(ctx, teamID, generation, teamEKBoxed)
	return teamEK, err
}

func (s *TeamEKBoxStorage) unbox(ctx context.Context, teamEKGeneration keybase1.EkGeneration,
	teamEKBoxed keybase1.TeamEkBoxed, contentCtime *gregor1.Time) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#unbox: teamEKGeneration: %v", teamEKGeneration), func() error { return err })()

	userEKBoxStorage := s.G().GetUserEKBoxStorage()
	userEK, err := userEKBoxStorage.Get(ctx, teamEKBoxed.UserEkGeneration, contentCtime)
	if err != nil {
		s.G().Log.CDebugf(ctx, "unable to get from userEKStorage %v", err)
		switch err.(type) {
		case EphemeralKeyError:
			return teamEK, newEKUnboxErr(ctx, s.G(), TeamEKStr, teamEKGeneration, UserEKStr,
				teamEKBoxed.UserEkGeneration, contentCtime)
		}
		return teamEK, err
	}

	userSeed := UserEKSeed(userEK.Seed)
	userKeypair := userSeed.DeriveDHKey()

	msg, _, err := userKeypair.DecryptFromString(teamEKBoxed.Box)
	if err != nil {
		s.G().Log.CDebugf(ctx, "unable to decrypt teamEKBoxed %v", err)
		return teamEK, newEKUnboxErr(ctx, s.G(), TeamEKStr, teamEKGeneration, UserEKStr,
			teamEKBoxed.UserEkGeneration, contentCtime)
	}

	seed, err := newTeamEKSeedFromBytes(msg)
	if err != nil {
		return teamEK, err
	}

	return keybase1.TeamEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: teamEKBoxed.Metadata,
	}, nil
}

func (s *TeamEKBoxStorage) Put(ctx context.Context, teamID keybase1.TeamID,
	generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEkBoxed) (err error) {
	return s.put(ctx, teamID, generation, teamEKBoxed, nil /* ekErr */)
}

func (s *TeamEKBoxStorage) put(ctx context.Context, teamID keybase1.TeamID,
	generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEkBoxed, ekErr error) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#put: teamID:%v, generation:%v", teamID, generation), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	// sanity check that we got the right generation
	if teamEKBoxed.Metadata.Generation != generation && ekErr == nil {
		return newEKCorruptedErr(ctx, s.G(), TeamEKStr, generation, teamEKBoxed.Metadata.Generation)
	}

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return err
	}
	cache, _, err := s.getCacheForTeamID(ctx, teamID)
	if err != nil {
		return err
	}
	cache[generation] = newTeamEKBoxCacheItem(teamEKBoxed, ekErr)
	if err = s.G().GetKVStore().PutObj(key, nil, cache); err != nil {
		return err
	}
	s.cache.PutMap(teamID, cache)
	return nil
}

func (s *TeamEKBoxStorage) Delete(ctx context.Context, teamID keybase1.TeamID,
	generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.deleteMany(ctx, teamID, []keybase1.EkGeneration{generation})
}

func (s *TeamEKBoxStorage) deleteMany(ctx context.Context, teamID keybase1.TeamID,
	generations []keybase1.EkGeneration) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#delete: teamID:%v, generations:%v", teamID, generations), func() error { return err })()

	cache, found, err := s.getCacheForTeamID(ctx, teamID)
	if err != nil {
		return err
	} else if !found {
		return nil
	}

	for _, generation := range generations {
		delete(cache, generation)
	}

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return err
	}
	if err = s.G().GetKVStore().PutObj(key, nil, cache); err != nil {
		return err
	}
	s.cache.PutMap(teamID, cache)
	return nil
}

func (s *TeamEKBoxStorage) PurgeCacheForTeamID(ctx context.Context, teamID keybase1.TeamID) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#PurgeCacheForTeamID: teamID:%v", teamID), func() error { return err })()
	s.Lock()
	defer s.Unlock()

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return err
	}
	cache := make(teamEKBoxCache)
	if err = s.G().GetKVStore().PutObj(key, nil, cache); err != nil {
		return err
	}
	s.cache.PutMap(teamID, cache)
	return nil
}

func (s *TeamEKBoxStorage) DeleteExpired(ctx context.Context, teamID keybase1.TeamID,
	merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#DeleteExpired: teamID:%v", teamID), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, found, err := s.getCacheForTeamID(ctx, teamID)
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
			keyAge := merkleCtime.Sub(cacheItem.TeamEKBoxed.Metadata.Ctime.Time())
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
	return expired, s.deleteMany(ctx, teamID, toDelete)
}

func (s *TeamEKBoxStorage) GetAll(ctx context.Context, teamID keybase1.TeamID) (teamEKs TeamEKMap, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#GetAll: teamID:%v", teamID), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	teamEKs = make(TeamEKMap)
	cache, found, err := s.getCacheForTeamID(ctx, teamID)
	if err != nil {
		return nil, err
	} else if !found {
		return nil, nil
	}

	for generation, cacheItem := range cache {
		if cacheItem.HasError() {
			continue
		}
		teamEK, err := s.unbox(ctx, generation, cacheItem.TeamEKBoxed, nil)
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

func (s *TeamEKBoxStorage) MaxGeneration(ctx context.Context, teamID keybase1.TeamID) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#MaxGeneration: teamID:%v", teamID), func() error { return nil })()

	s.Lock()
	defer s.Unlock()

	maxGeneration = -1
	cache, _, err := s.getCacheForTeamID(ctx, teamID)
	if err != nil {
		return maxGeneration, err
	}

	for generation, cacheItem := range cache {
		if cacheItem.HasError() {
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
	libkb.Contextified
	lru *lru.Cache
	sync.Mutex
}

func newTeamEKCache(g *libkb.GlobalContext) *teamEKCache {
	nlru, err := lru.New(MemCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &teamEKCache{
		Contextified: libkb.NewContextified(g),
		lru:          nlru,
	}
}

func (s *teamEKCache) GetMap(teamID keybase1.TeamID) (cache teamEKBoxCache, found bool) {
	s.Lock()
	defer s.Unlock()

	untyped, found := s.lru.Get(s.key(teamID))
	if !found {
		return nil, found
	}
	cache, ok := untyped.(teamEKBoxCache)
	if !ok {
		s.G().Log.CDebugf(context.TODO(), "TeamEK teamEKCache got bad type from lru: %T", untyped)
		return nil, found
	}
	return cache, found
}

func (s *teamEKCache) PutMap(teamID keybase1.TeamID, cache teamEKBoxCache) {
	s.lru.Add(s.key(teamID), cache)
}

func (s *teamEKCache) Clear() {
	s.lru.Purge()
}

func (s *teamEKCache) key(teamID keybase1.TeamID) (key string) {
	return teamKey(teamID, s.G())
}
