package ephemeral

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const cacheEntryLifetimeSecs = 60 * 5 // 5 minutes
const lruSize = 200

type EKLib struct {
	libkb.Contextified
	teamEKGenCache *lru.Cache
	sync.Mutex
}

func NewEKLib(g *libkb.GlobalContext) *EKLib {
	nlru, err := lru.New(lruSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &EKLib{
		Contextified:   libkb.NewContextified(g),
		teamEKGenCache: nlru,
	}
}

func (e *EKLib) KeygenIfNeeded(ctx context.Context) (err error) {
	e.Lock()
	defer e.Unlock()

	if loggedIn, err := e.G().LoginState().LoggedInLoad(); err != nil {
		return err
	} else if !loggedIn {
		return fmt.Errorf("Aborting ephemeral key generation, user is not logged in!")
	}

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return err
	}
	return e.keygenIfNeeded(ctx, *merkleRootPtr)
}

func (e *EKLib) keygenIfNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (err error) {
	defer e.G().CTrace(ctx, "keygenIfNeeded", func() error { return err })()

	if deviceEKNeeded, err := e.newDeviceEKNeeded(ctx, merkleRoot); err != nil {
		return err
	} else if deviceEKNeeded {
		_, err = publishNewDeviceEK(ctx, e.G(), merkleRoot)
		if err != nil {
			return err
		}
	}

	if userEKNeeded, err := e.newUserEKNeeded(ctx, merkleRoot); err != nil {
		return err
	} else if userEKNeeded {
		_, err = publishNewUserEK(ctx, e.G(), merkleRoot)
		if err != nil {
			return err
		}
	}
	return e.cleanupStaleUserAndDeviceEKs(ctx, merkleRoot)
}

func (e *EKLib) CleanupStaleUserAndDeviceEKs(ctx context.Context) (err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return err
	}
	return e.cleanupStaleUserAndDeviceEKs(ctx, *merkleRootPtr)
}

func (e *EKLib) cleanupStaleUserAndDeviceEKs(ctx context.Context, merkleRoot libkb.MerkleRoot) (err error) {
	defer e.G().CTrace(ctx, "CleanupStaleUserAndDeviceEKs", func() error { return err })()

	epick := libkb.FirstErrorPicker{}

	deviceEKStorage := e.G().GetDeviceEKStorage()
	_, err = deviceEKStorage.DeleteExpired(ctx, merkleRoot)
	epick.Push(err)

	userEKBoxStorage := e.G().GetUserEKBoxStorage()
	_, err = userEKBoxStorage.DeleteExpired(ctx, merkleRoot)
	epick.Push(err)
	return epick.Error()
}

func (e *EKLib) NewDeviceEKNeeded(ctx context.Context) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	return e.newDeviceEKNeeded(ctx, *merkleRootPtr)
}

func (e *EKLib) newDeviceEKNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	defer e.G().CTrace(ctx, "newDeviceEKNeeded", func() error { return err })()

	s := e.G().GetDeviceEKStorage()
	maxGeneration, err := s.MaxGeneration(ctx)
	if err != nil {
		return needed, err
	}
	if maxGeneration < 0 {
		return true, nil
	}

	ek, err := s.Get(ctx, maxGeneration)
	if err != nil {
		return needed, err
	}

	return keygenNeeded(ek.Metadata.Ctime, merkleRoot), nil
}

func (e *EKLib) NewUserEKNeeded(ctx context.Context) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	return e.newUserEKNeeded(ctx, *merkleRootPtr)
}

func (e *EKLib) newUserEKNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	defer e.G().CTrace(ctx, "newUserEKNeeded", func() error { return err })()

	// Let's see what the latest server statement is.
	statement, err := fetchUserEKStatement(ctx, e.G())
	if err != nil {
		return false, err
	}
	// No statement, so we need a userEK
	if statement == nil {
		return true, nil
	}
	// Can we access this generation? If not, let's regenerate.
	s := e.G().GetUserEKBoxStorage()
	ek, err := s.Get(ctx, statement.CurrentUserEkMetadata.Generation)
	if err != nil {
		switch err.(type) {
		case *EKUnboxErr:
			e.G().Log.Debug(err.Error())
			return true, nil
		default:
			return false, err
		}
	}
	// Ok we can access the ek, check lifetime.
	return keygenNeeded(ek.Metadata.Ctime, merkleRoot), nil
}

func (e *EKLib) NewTeamEKNeeded(ctx context.Context, teamID keybase1.TeamID) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	statement, err := fetchTeamEKStatement(ctx, e.G(), teamID)
	if err != nil {
		return false, err
	}
	return e.newTeamEKNeeded(ctx, teamID, *merkleRootPtr, statement)
}

func (e *EKLib) newTeamEKNeeded(ctx context.Context, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot, statement *keybase1.TeamEkStatement) (needed bool, err error) {
	// Let's see what the latest server statement is.
	// No statement, so we need a teamEK
	if statement == nil {
		return true, nil
	}
	// Can we access this generation? If not, let's regenerate.
	s := e.G().GetTeamEKBoxStorage()
	ek, err := s.Get(ctx, teamID, statement.CurrentTeamEkMetadata.Generation)
	if err != nil {
		switch err.(type) {
		case *EKUnboxErr:
			e.G().Log.Debug(err.Error())
			return true, nil
		default:
			return false, err
		}
	}
	// Ok we can access the ek, check lifetime.
	return keygenNeeded(ek.Metadata.Ctime, merkleRoot), nil
}

type teamEKGenCacheEntry struct {
	Generation keybase1.EkGeneration
	Ctime      keybase1.Time
}

func (e *EKLib) newCacheEntry(generation keybase1.EkGeneration) *teamEKGenCacheEntry {
	return &teamEKGenCacheEntry{
		Generation: generation,
		Ctime:      keybase1.TimeFromSeconds(time.Now().Unix()),
	}
}

func (e *EKLib) cacheKey(teamID keybase1.TeamID) string {
	return string(teamID)
}

func (e *EKLib) isEntryValid(val interface{}) (*teamEKGenCacheEntry, bool) {
	cacheEntry, ok := val.(*teamEKGenCacheEntry)
	if !ok || cacheEntry == nil {
		return nil, false
	}
	return cacheEntry, (keybase1.TimeFromSeconds(time.Now().Unix()) - cacheEntry.Ctime) < keybase1.TimeFromSeconds(cacheEntryLifetimeSecs)
}

func (e *EKLib) PurgeTeamEKGenCache(context context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) {
	key := e.cacheKey(teamID)
	val, ok := e.teamEKGenCache.Get(teamID)
	if ok {
		if cacheEntry, valid := e.isEntryValid(val); valid && cacheEntry.Generation != generation {
			e.teamEKGenCache.Remove(key)
		}
	}
}

func (e *EKLib) GetOrCreateLatestTeamEK(ctx context.Context, teamID keybase1.TeamID) (teamEK keybase1.TeamEk, err error) {
	e.Lock()
	defer e.Unlock()

	if loggedIn, err := e.G().LoginState().LoggedInLoad(); err != nil {
		return teamEK, err
	} else if !loggedIn {
		return teamEK, fmt.Errorf("Aborting ephemeral key generation, user is not logged in!")
	}

	teamEKBoxStorage := e.G().GetTeamEKBoxStorage()
	// Check if we have a cached latest generation
	key := e.cacheKey(teamID)
	val, ok := e.teamEKGenCache.Get(teamID)
	if ok {
		if cacheEntry, valid := e.isEntryValid(val); valid {
			return teamEKBoxStorage.Get(ctx, teamID, cacheEntry.Generation)
		}
	}

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return teamEK, err
	}
	merkleRoot := *merkleRootPtr

	// First publish new device or userEKs if we need to.
	if err = e.keygenIfNeeded(ctx, merkleRoot); err != nil {
		return teamEK, err
	}

	statement, err := fetchTeamEKStatement(ctx, e.G(), teamID)
	if err != nil {
		return teamEK, err
	}

	var publishedMetadata keybase1.TeamEkMetadata
	if teamEKNeeded, err := e.newTeamEKNeeded(ctx, teamID, merkleRoot, statement); err != nil {
		return teamEK, err
	} else if teamEKNeeded {
		publishedMetadata, err = publishNewTeamEK(ctx, e.G(), teamID, merkleRoot)
		if err != nil {
			return teamEK, err
		}
	} else {
		publishedMetadata = statement.CurrentTeamEkMetadata
	}

	_, err = teamEKBoxStorage.DeleteExpired(ctx, teamID, merkleRoot)
	if err != nil {
		return teamEK, err
	}
	teamEK, err = teamEKBoxStorage.Get(ctx, teamID, publishedMetadata.Generation)
	if err != nil {
		return teamEK, err
	}
	// Cache the latest generation
	e.teamEKGenCache.Add(key, e.newCacheEntry(publishedMetadata.Generation))
	return teamEK, nil
}

func (e *EKLib) OnLogin() error {
	return e.KeygenIfNeeded(context.Background())
}

func (e *EKLib) OnLogout() error {
	deviceEKStorage := e.G().GetDeviceEKStorage()
	if deviceEKStorage != nil {
		deviceEKStorage.ClearCache()
	}
	userEKBoxStorage := e.G().GetUserEKBoxStorage()
	if userEKBoxStorage != nil {
		userEKBoxStorage.ClearCache()
	}
	teamEKBoxStorage := e.G().GetTeamEKBoxStorage()
	if teamEKBoxStorage != nil {
		teamEKBoxStorage.ClearCache()
	}
	return nil
}
