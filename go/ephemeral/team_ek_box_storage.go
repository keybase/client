package ephemeral

import (
	"context"
	"fmt"
	"log"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TeamEKMap map[keybase1.EkGeneration]keybase1.TeamEk
type TeamEKBoxMap map[keybase1.EkGeneration]keybase1.TeamEkBoxed

func teamKey(teamID keybase1.TeamID, g *libkb.GlobalContext) string {
	return fmt.Sprintf("teamEphemeralKeyBox-%s-%s", teamID, g.Env.GetUsername())
}

// We cache TeamEKBoxes from the server in a LRU and a persist to a local
// KVStore.
type TeamEKBoxStorage struct {
	libkb.Contextified
	sync.Mutex
	cache *MemoryStorage
}

func NewTeamEKBoxStorage(g *libkb.GlobalContext) *TeamEKBoxStorage {
	return &TeamEKBoxStorage{
		Contextified: libkb.NewContextified(g),
		cache:        NewMemoryStorage(g),
	}
}

func (s *TeamEKBoxStorage) dbKey(ctx context.Context, teamID keybase1.TeamID) (dbKey libkb.DbKey, err error) {
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return dbKey, err
	}
	key := fmt.Sprintf("%s-%s", teamKey(teamID, s.G()), uv.EldestSeqno)
	return libkb.DbKey{
		Typ: libkb.DBTeamEKBox,
		Key: key,
	}, nil
}

func (s *TeamEKBoxStorage) Get(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#Get: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	s.Lock()

	teamEKBoxes, found, err := s.getMap(ctx, teamID)
	if err != nil {
		s.Unlock()
		return teamEK, err
	} else if !found {
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(ctx, teamID, generation)
	}

	teamEKBoxed, ok := teamEKBoxes[generation]
	if !ok {
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(ctx, teamID, generation)
	}
	defer s.Unlock() // release the lock after we unbox
	return s.unbox(ctx, generation, teamEKBoxed)
}

func (s *TeamEKBoxStorage) getMap(ctx context.Context, teamID keybase1.TeamID) (teamEKBoxes TeamEKBoxMap, found bool, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#getMap: teamID:%v", teamID), func() error { return err })()

	teamEKBoxes, found = s.cache.GetMap(teamID)
	if found {
		return teamEKBoxes, found, nil
	}

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return nil, false, err
	}
	teamEKBoxes = make(TeamEKBoxMap)
	found, err = s.G().GetKVStore().GetInto(&teamEKBoxes, key)
	if err != nil {
		return nil, found, err
	} else if found {
		s.cache.PutMap(teamID, teamEKBoxes)
	}
	return teamEKBoxes, found, err
}

type TeamEKBoxedResponse struct {
	Result *struct {
		Box              string                `json:"box"`
		UserEKGeneration keybase1.EkGeneration `json:"user_ek_generation"`
		Sig              string                `json:"sig"`
	} `json:"result"`
}

func (s *TeamEKBoxStorage) fetchAndStore(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	m := libkb.NewMetaContext(ctx, s.G())
	defer m.CTraceTimed(fmt.Sprintf("TeamEKBoxStorage#fetchAndStore: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":    libkb.S{Val: string(teamID)},
			"generation": libkb.U{Val: uint64(generation)},
		},
	}

	var result TeamEKBoxedResponse
	res, err := s.G().GetAPI().Get(m, apiArg)
	if err != nil {
		return teamEK, err
	}

	err = res.Body.UnmarshalAgain(&result)
	if err != nil {
		return teamEK, err
	}

	if result.Result == nil {
		return teamEK, newEKMissingBoxErr(TeamEKStr, generation)
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
	teamEKBoxed := keybase1.TeamEkBoxed{
		Box:              result.Result.Box,
		UserEkGeneration: result.Result.UserEKGeneration,
		Metadata:         teamEKMetadata,
	}

	teamEK, err = s.unbox(ctx, generation, teamEKBoxed)
	if err != nil {
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

func (s *TeamEKBoxStorage) unbox(ctx context.Context, teamEKGeneration keybase1.EkGeneration, teamEKBoxed keybase1.TeamEkBoxed) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#unbox: teamEKGeneration: %v", teamEKGeneration), func() error { return err })()

	userEKBoxStorage := s.G().GetUserEKBoxStorage()
	userEK, err := userEKBoxStorage.Get(ctx, teamEKBoxed.UserEkGeneration)
	if err != nil {
		s.G().Log.CDebugf(ctx, "%v", err)
		return teamEK, newEKUnboxErr(TeamEKStr, teamEKGeneration, UserEKStr, teamEKBoxed.UserEkGeneration)
	}

	userSeed := UserEKSeed(userEK.Seed)
	userKeypair := userSeed.DeriveDHKey()

	msg, _, err := userKeypair.DecryptFromString(teamEKBoxed.Box)
	if err != nil {
		s.G().Log.CDebugf(ctx, "%v", err)
		return teamEK, newEKUnboxErr(TeamEKStr, teamEKGeneration, UserEKStr, teamEKBoxed.UserEkGeneration)
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

func (s *TeamEKBoxStorage) Put(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEkBoxed) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#Put: teamID:%v, generation:%v", teamID, generation), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return err
	}
	teamEKBoxes, _, err := s.getMap(ctx, teamID)
	if err != nil {
		return err
	}
	teamEKBoxes[generation] = teamEKBoxed
	err = s.G().GetKVStore().PutObj(key, nil, teamEKBoxes)
	if err != nil {
		return err
	}
	s.cache.PutMap(teamID, teamEKBoxes)
	return nil
}

func (s *TeamEKBoxStorage) Delete(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.deleteMany(ctx, teamID, []keybase1.EkGeneration{generation})
}

func (s *TeamEKBoxStorage) deleteMany(ctx context.Context, teamID keybase1.TeamID, generations []keybase1.EkGeneration) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#delete: teamID:%v, generations:%v", teamID, generations), func() error { return err })()

	teamEKBoxes, found, err := s.getMap(ctx, teamID)
	if err != nil {
		return err
	} else if !found {
		return nil
	}

	for _, generation := range generations {
		delete(teamEKBoxes, generation)
	}

	key, err := s.dbKey(ctx, teamID)
	if err != nil {
		return err
	}
	err = s.G().GetKVStore().PutObj(key, nil, teamEKBoxes)
	if err != nil {
		return err
	}
	s.cache.PutMap(teamID, teamEKBoxes)
	return nil
}

func (s *TeamEKBoxStorage) DeleteExpired(ctx context.Context, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#DeleteExpired: teamID:%v", teamID), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	teamEKBoxes, found, err := s.getMap(ctx, teamID)
	if err != nil {
		return nil, err
	} else if !found {
		return nil, nil
	}

	merkleCtime := keybase1.TimeFromSeconds(merkleRoot.Ctime()).Time()
	for gen, teamEKBox := range teamEKBoxes {
		keyAge := merkleCtime.Sub(teamEKBox.Metadata.Ctime.Time())
		// TeamEKs will never encrypt new data if the current key is older than
		// libkb.EphemeralKeyGenInterval, thus the maximum lifetime of
		// ephemeral content will not exceed libkb.MinEphemeralKeyLifetime =
		// libkb.MaxEphemeralContentLifetime + libkb.EphemeralKeyGenInterval
		if keyAge >= libkb.MinEphemeralKeyLifetime {
			expired = append(expired, gen)
		}
	}
	return expired, s.deleteMany(ctx, teamID, expired)
}

func (s *TeamEKBoxStorage) GetAll(ctx context.Context, teamID keybase1.TeamID) (teamEKs TeamEKMap, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("TeamEKBoxStorage#GetAll: teamID:%v", teamID), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	teamEKs = make(TeamEKMap)
	teamEKBoxes, found, err := s.getMap(ctx, teamID)
	if err != nil {
		return nil, err
	} else if !found {
		return nil, nil
	}

	for generation, teamEKBoxed := range teamEKBoxes {
		teamEK, err := s.unbox(ctx, generation, teamEKBoxed)
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
	teamEKBoxes, _, err := s.getMap(ctx, teamID)
	if err != nil {
		return maxGeneration, err
	}

	for generation := range teamEKBoxes {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

// --------------------------------------------------

const MemCacheLRUSize = 200

// Store some TeamEKBoxes's in memory. Threadsafe.
type MemoryStorage struct {
	libkb.Contextified
	lru *lru.Cache
	sync.Mutex
}

func NewMemoryStorage(g *libkb.GlobalContext) *MemoryStorage {
	nlru, err := lru.New(MemCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &MemoryStorage{
		Contextified: libkb.NewContextified(g),
		lru:          nlru,
	}
}

func (s *MemoryStorage) GetMap(teamID keybase1.TeamID) (teamEKBoxes TeamEKBoxMap, found bool) {
	s.Lock()
	defer s.Unlock()

	untyped, found := s.lru.Get(s.key(teamID))
	if !found {
		return nil, found
	}
	teamEKBoxes, ok := untyped.(TeamEKBoxMap)
	if !ok {
		s.G().Log.CDebugf(context.TODO(), "TeamEK MemoryStorage got bad type from lru: %T", untyped)
		return teamEKBoxes, found
	}
	return teamEKBoxes, found
}

func (s *MemoryStorage) PutMap(teamID keybase1.TeamID, teamEKBoxes TeamEKBoxMap) {
	s.lru.Add(s.key(teamID), teamEKBoxes)
}

func (s *MemoryStorage) Clear() {
	s.lru.Purge()
}

func (s *MemoryStorage) key(teamID keybase1.TeamID) (key string) {
	return teamKey(teamID, s.G())
}
