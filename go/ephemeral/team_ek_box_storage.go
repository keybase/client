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

type TeamEKBoxMap map[keybase1.EkGeneration]keybase1.TeamEkBoxed
type TeamEKUnboxedMap map[keybase1.EkGeneration]keybase1.TeamEk

func teamKey(teamID keybase1.TeamID, g *libkb.GlobalContext) string {
	// TODO should we put EldestSeqno and a type seqno here?
	return fmt.Sprintf("team-ephemeral-key-boxes-%s-%s", teamID, g.Env.GetUsername())
}

// We cache TeamEKBoxes from the server in memory and a persist to a local
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

func (s *TeamEKBoxStorage) dbKey(teamID keybase1.TeamID) libkb.DbKey {
	key := teamKey(teamID, s.G())
	return libkb.DbKey{
		Typ: libkb.DBTeamEKBox,
		Key: key,
	}
}

func (s *TeamEKBoxStorage) Get(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#Get", func() error { return err })()
	s.Lock()

	// Try cache first
	teamEKBoxed, found := s.cache.Get(teamID, generation)
	if found {
		s.Unlock()
		return s.unbox(ctx, teamEKBoxed)
	}

	s.Unlock() // fetchAndPut will lock during Put
	// We don't have anything in our cache, fetch from the server
	return s.fetchAndPut(ctx, teamID, generation)
}

type TeamEKBoxedResponse struct {
	Result struct {
		Box              string                `json:"box"`
		UserEKGeneration keybase1.EkGeneration `json:"user_ek_generation"`
		Sig              string                `json:"sig"`
	} `json:"result"`
}

func (s *TeamEKBoxStorage) fetchAndPut(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#fetchAndPut", func() error { return err })()
	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id":             libkb.S{Val: string(teamID)},
			"generation":          libkb.U{Val: uint64(generation)},
			"recipient_device_id": libkb.S{Val: string(s.G().Env.GetDeviceID())},
		},
	}

	var result TeamEKBoxedResponse
	res, err := s.G().GetAPI().Get(apiArg)
	if err != nil {
		return teamEK, err
	}

	err = res.Body.UnmarshalAgain(&result)
	if err != nil {
		return teamEK, err
	}

	// Before we store anything, let's verify that the server returned
	// signature is valid and the KID it has signed matches the boxed seed.
	// Otherwise something's fishy..
	teamEKMetadata, wrongKID, err := VerifySigWithLatestPTK(ctx, s.G(), result.Result.Sig)

	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		s.G().Log.CWarningf(ctx, "It looks like you revoked a team key without generating new ephemeral keys. Are you running an old version?")
		return teamEK, nil
	}
	if err != nil {
		return teamEK, err
	}

	if teamEKMetadata == nil { // shouldn't happen
		s.G().Log.CWarningf(ctx, "No error but got nil teamEKMetadata")
		return teamEK, err
	}

	teamEKBoxed := keybase1.TeamEkBoxed{
		Box:              result.Result.Box,
		UserEkGeneration: result.Result.UserEKGeneration,
		Metadata:         *teamEKMetadata,
	}

	teamEK, err = s.unbox(ctx, teamEKBoxed)
	if err != nil {
		return teamEK, err
	}

	seed := TeamEKSeed(teamEK.Seed)
	keypair, err := seed.DeriveDHKey()
	if err != nil {
		return teamEK, err

	}

	if !keypair.GetKID().Equal(teamEKMetadata.Kid) {
		return teamEK, fmt.Errorf("Failed to verify server given seed against signed KID %s", teamEKMetadata.Kid)
	}

	// Store the boxed version, return the unboxed
	err = s.Put(ctx, teamID, generation, teamEKBoxed)
	return teamEK, err
}

func (s *TeamEKBoxStorage) Put(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEkBoxed) (err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#Put", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	key := s.dbKey(teamID)
	teamEKBoxes := s.cache.Put(teamID, generation, teamEKBoxed)
	return s.G().GetKVStore().PutObj(key, nil, teamEKBoxes)
}

func (s *TeamEKBoxStorage) unbox(ctx context.Context, teamEKBoxed keybase1.TeamEkBoxed) (teamEK keybase1.TeamEk, err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#unbox", func() error { return err })()
	userEKBoxStorage := s.G().GetUserEKBoxStorage()
	userEK, err := userEKBoxStorage.Get(ctx, teamEKBoxed.UserEkGeneration)
	if err != nil {
		return teamEK, err
	}

	userSeed := UserEKSeed(userEK.Seed)
	userKeypair, err := userSeed.DeriveDHKey()
	if err != nil {
		return teamEK, err
	}

	msg, _, err := userKeypair.DecryptFromString(teamEKBoxed.Box)
	if err != nil {
		return teamEK, err
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

func (s *TeamEKBoxStorage) Delete(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.delete(ctx, teamID, generation)
}

func (s *TeamEKBoxStorage) delete(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#delete", func() error { return err })()
	teamEKBoxes := s.cache.Delete(teamID, generation)
	key := s.dbKey(teamID)
	return s.G().GetKVStore().PutObj(key, nil, teamEKBoxes)
}

func (s *TeamEKBoxStorage) GetAll(ctx context.Context, teamID keybase1.TeamID) (teamEKs TeamEKUnboxedMap, err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#GetAll", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	teamEKs = make(TeamEKUnboxedMap)
	teamEKBoxes := s.cache.GetMap(teamID)
	for generation, teamEKBoxed := range teamEKBoxes {
		teamEK, err := s.unbox(ctx, teamEKBoxed)
		if err != nil {
			return teamEKs, err
		}
		teamEKs[generation] = teamEK
	}
	return teamEKs, err
}

// Used for testing
func (s *TeamEKBoxStorage) ClearCache() {
	s.Lock()
	defer s.Unlock()
	s.cache.Clear()
}

func (s *TeamEKBoxStorage) MaxGeneration(ctx context.Context, teamID keybase1.TeamID) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#MaxGeneration", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	teamEKBoxes := s.cache.GetMap(teamID)

	for generation := range teamEKBoxes {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

func (s *TeamEKBoxStorage) DeleteExpired(ctx context.Context, teamID keybase1.TeamID) (expired []keybase1.EkGeneration, err error) {
	defer s.G().CTrace(ctx, "TeamEKBoxStorage#DeleteExpired", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	latestMerkleRoot, err := s.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return expired, err
	}

	teamEKBoxes := s.cache.GetMap(teamID)

	epick := libkb.FirstErrorPicker{}
	for _, teamEKBox := range teamEKBoxes {
		lifetime := keybase1.Time(latestMerkleRoot.Ctime()) - teamEKBox.Metadata.Ctime
		if lifetime >= KeyLifetimeSecs {
			expired = append(expired, teamEKBox.Metadata.Generation)
			epick.Push(s.delete(ctx, teamID, teamEKBox.Metadata.Generation))
		}
	}

	return expired, epick.Error()
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

func (s *MemoryStorage) Put(teamID keybase1.TeamID, generation keybase1.EkGeneration, teamEKBoxed keybase1.TeamEkBoxed) TeamEKBoxMap {
	s.Lock()
	defer s.Unlock()
	teamEKBoxes := s.GetMap(teamID)
	teamEKBoxes[generation] = teamEKBoxed
	s.lru.Add(s.key(teamID), teamEKBoxes)
	return teamEKBoxes
}

func (s *MemoryStorage) Get(teamID keybase1.TeamID, generation keybase1.EkGeneration) (keybase1.TeamEkBoxed, bool) {
	s.Lock()
	defer s.Unlock()
	teamEKBoxes := s.GetMap(teamID)
	teamEKBoxed, ok := teamEKBoxes[generation]
	return teamEKBoxed, ok
}

func (s *MemoryStorage) GetMap(teamID keybase1.TeamID) (teamEKBoxes TeamEKBoxMap) {
	untyped, ok := s.lru.Get(s.key(teamID))
	if !ok {
		return teamEKBoxes
	}
	teamEKBoxes, ok = untyped.(TeamEKBoxMap)
	if !ok {
		s.G().Log.Warning("Team MemoryStorage got bad type from lru: %T", untyped)
		return teamEKBoxes
	}
	return teamEKBoxes
}

func (s *MemoryStorage) Delete(teamID keybase1.TeamID, generation keybase1.EkGeneration) TeamEKBoxMap {
	s.Lock()
	defer s.Unlock()
	teamEKBoxes := s.GetMap(teamID)
	delete(teamEKBoxes, generation)
	s.lru.Add(s.key(teamID), teamEKBoxes)
	return teamEKBoxes
}

func (s *MemoryStorage) Clear() {
	s.lru.Purge()
}

func (s *MemoryStorage) key(teamID keybase1.TeamID) (key string) {
	return teamKey(teamID, s.G())
}
