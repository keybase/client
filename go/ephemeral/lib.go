package ephemeral

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/erasablekv"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

const SkipKeygenNilMerkleRoot = "Skipping key generation, unable to fetch merkle root"

const cacheEntryLifetime = time.Minute * 5
const lruSize = 200

type EKLib struct {
	libkb.Contextified
	teamEKGenCache *lru.Cache
	sync.Mutex

	// During testing we may want to stall background creation to assert cache
	// state.
	clock                    clockwork.Clock
	backgroundCreationTestCh chan bool
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
		clock:          clockwork.NewRealClock(),
	}
}

func (e *EKLib) metaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, e.G())
}

func (e *EKLib) setClock(clock clockwork.Clock) {
	e.clock = clock
}

func (e *EKLib) setBackgroundCreationTestCh(ch chan bool) {
	e.backgroundCreationTestCh = ch
}

func (e *EKLib) NewMetaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, e.G())
}

func (e *EKLib) checkLoginAndPUK(ctx context.Context) (loggedIn bool, err error) {
	m := e.NewMetaContext(ctx)
	if oneshot, err := e.G().IsOneshot(ctx); err != nil || oneshot {
		e.G().Log.CDebugf(ctx, "EKLib#checkLoginAndPUK error: %s, isOneshot: %v", err, oneshot)
		return false, err
	}

	if loggedIn, _, err = libkb.BootstrapActiveDeviceWithMetaContext(m); err != nil {
		return loggedIn, err
	} else if !loggedIn {
		return loggedIn, fmt.Errorf("Aborting ephemeral key generation, user is not logged in!")
	}

	pukring, err := e.G().GetPerUserKeyring()
	if err != nil {
		return loggedIn, err
	}
	if err := pukring.Sync(m); err != nil {
		return loggedIn, err
	}
	if !pukring.HasAnyKeys() {
		return loggedIn, fmt.Errorf("A PUK is needed to generate ephemeral keys. Aborting.")
	}
	return loggedIn, nil
}

func (e *EKLib) KeygenIfNeeded(ctx context.Context) (err error) {
	e.Lock()
	defer e.Unlock()
	var loggedIn bool
	var merkleRoot libkb.MerkleRoot
	// Always try to delete keys if we are logged in even if we get an error
	// when checking our PUK or fetching the merkleRoot. `keygenIfNeeded` this
	// also tries best effort to delete with errors, but try here in case we
	// error before reaching that call.
	defer func() {
		if err != nil && loggedIn {
			e.cleanupStaleUserAndDeviceEKs(ctx, merkleRoot)
		}
	}()

	if loggedIn, err = e.checkLoginAndPUK(ctx); err != nil {
		return err
	}

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		e.G().Log.CDebugf(ctx, "Unable to fetch merkle root: %v, attempting keygenIfNeeded with nil root", err)
		merkleRootPtr = &libkb.MerkleRoot{}
	}
	return e.keygenIfNeeded(ctx, *merkleRootPtr)
}

func (e *EKLib) keygenIfNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (err error) {
	defer e.G().CTraceTimed(ctx, "keygenIfNeeded", func() error { return err })()
	defer e.cleanupStaleUserAndDeviceEKs(ctx, merkleRoot) // always try to cleanup expired keys

	// Abort. We only care about calling `cleanupStaleUserAndDeviceEKs.
	if merkleRoot.IsNil() {
		return fmt.Errorf(SkipKeygenNilMerkleRoot)
	}

	if deviceEKNeeded, err := e.newDeviceEKNeeded(ctx, merkleRoot); err != nil {
		return err
	} else if deviceEKNeeded {
		_, err = publishNewDeviceEK(ctx, e.G(), merkleRoot)
		if err != nil {
			return err
		}
	}

	// newUserEKNeeded checks that the current userEKStatement is signed by our
	// latest PUK, is accessible to a deviceEK we have access to and that the
	// key is not expired. It's crucial that this verifies that the latest PUK
	// was used since we don't want to use a key signed by an old PUK for
	// encryption.
	if userEKNeeded, err := e.newUserEKNeeded(ctx, merkleRoot); err != nil {
		return err
	} else if userEKNeeded {
		_, err = publishNewUserEK(ctx, e.G(), merkleRoot)
		if err != nil {
			return err
		}
	}
	return nil
}

func (e *EKLib) CleanupStaleUserAndDeviceEKs(ctx context.Context) (err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		e.G().Log.CDebugf(ctx, "Unable to fetch merkle root: %v, attempting deviceEK deletion with nil root", err)
		merkleRootPtr = &libkb.MerkleRoot{}
	}
	return e.cleanupStaleUserAndDeviceEKs(ctx, *merkleRootPtr)
}

func (e *EKLib) cleanupStaleUserAndDeviceEKs(ctx context.Context, merkleRoot libkb.MerkleRoot) (err error) {
	defer e.G().CTraceTimed(ctx, "cleanupStaleUserAndDeviceEKs", func() error { return err })()

	epick := libkb.FirstErrorPicker{}

	deviceEKStorage := e.G().GetDeviceEKStorage()
	_, err = deviceEKStorage.DeleteExpired(ctx, merkleRoot)
	epick.Push(err)

	// Abort. We only cared about deleting expired deviceEKs.
	if merkleRoot.IsNil() {
		return fmt.Errorf("skipping userEK deletion, unable to fetch merkle root")
	}

	userEKBoxStorage := e.G().GetUserEKBoxStorage()
	_, err = userEKBoxStorage.DeleteExpired(ctx, merkleRoot)
	epick.Push(err)
	return epick.Error()
}

func (e *EKLib) NewDeviceEKNeeded(ctx context.Context) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	return e.newDeviceEKNeeded(ctx, *merkleRootPtr)
}

func (e *EKLib) newDeviceEKNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	defer e.G().CTraceTimed(ctx, "newDeviceEKNeeded", func() error { return err })()

	s := e.G().GetDeviceEKStorage()
	maxGeneration, err := s.MaxGeneration(ctx)
	if err != nil {
		switch err.(type) {
		case erasablekv.UnboxError:
			e.G().Log.Debug("newDeviceEKNeeded: DeviceEKStorage.MaxGeneration failed %v", err)
			return true, nil
		default:
			return false, err
		}
	}
	if maxGeneration < 0 {
		return true, nil
	}

	ek, err := s.Get(ctx, maxGeneration)
	if err != nil {
		switch err.(type) {
		case erasablekv.UnboxError:
			e.G().Log.Debug("newDeviceEKNeeded: DeviceEKStorage.Get failed %v", err)
			return true, nil
		default:
			return false, err
		}
	}

	// Ok we can access the ek, check lifetime.
	e.G().Log.CDebugf(ctx, "nextDeviceEKNeeded at: %v", nextKeygenTime(ek.Metadata.Ctime.Time()))
	return keygenNeeded(ek.Metadata.Ctime.Time(), merkleRoot), nil
}

func (e *EKLib) NewUserEKNeeded(ctx context.Context) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	return e.newUserEKNeeded(ctx, *merkleRootPtr)
}

func (e *EKLib) newUserEKNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	defer e.G().CTraceTimed(ctx, "newUserEKNeeded", func() error { return err })()

	// Let's see what the latest server statement is. This verifies that the
	// latest statement was signed by the latest PUK and otherwise fails with
	// wrongKID set.
	statement, _, wrongKID, err := fetchUserEKStatement(ctx, e.G(), e.G().Env.GetUID())
	if wrongKID {
		return true, nil
	} else if err != nil {
		return false, err
	}
	if statement == nil {
		return true, nil
	}
	// Can we access this generation? If not, let's regenerate.
	s := e.G().GetUserEKBoxStorage()
	ek, err := s.Get(ctx, statement.CurrentUserEkMetadata.Generation)
	if err != nil {
		switch err.(type) {
		case EKUnboxErr, EKMissingBoxErr:
			e.G().Log.Debug(err.Error())
			return true, nil
		default:
			return false, err
		}
	}
	// Ok we can access the ek, check lifetime.
	e.G().Log.CDebugf(ctx, "nextUserEKNeeded at: %v", nextKeygenTime(ek.Metadata.Ctime.Time()))
	return keygenNeeded(ek.Metadata.Ctime.Time(), merkleRoot), nil
}

func (e *EKLib) NewTeamEKNeeded(ctx context.Context, teamID keybase1.TeamID) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	needed, _, _, err = e.newTeamEKNeeded(ctx, teamID, *merkleRootPtr)
	return needed, err
}

func (e *EKLib) newTeamEKNeeded(ctx context.Context, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (needed, backgroundGenPossible bool, latestGeneration keybase1.EkGeneration, err error) {
	defer e.G().CTraceTimed(ctx, "newTeamEKNeeded", func() error { return err })()

	// Let's see what the latest server statement is. This verifies that the
	// latest statement was signed by the latest PTK and otherwise fails with
	// wrongKID set.
	statement, latestGeneration, wrongKID, err := fetchTeamEKStatement(ctx, e.G(), teamID)
	if wrongKID {
		return true, false, latestGeneration, nil
	} else if err != nil {
		return false, false, latestGeneration, err
	}

	// Let's see what the latest server statement is.
	// No statement, so we need a teamEK
	if statement == nil {
		return true, false, latestGeneration, nil
	}
	// Can we access this generation? If not, let's regenerate.
	s := e.G().GetTeamEKBoxStorage()
	ek, err := s.Get(ctx, teamID, statement.CurrentTeamEkMetadata.Generation)
	if err != nil {
		switch err.(type) {
		case EKUnboxErr, EKMissingBoxErr:
			e.G().Log.Debug(err.Error())
			return true, false, latestGeneration, nil
		default:
			return false, false, latestGeneration, err
		}
	}
	// Ok we can access the ek, check lifetime.
	e.G().Log.CDebugf(ctx, "nextTeamEKNeeded at: %v", nextKeygenTime(ek.Metadata.Ctime.Time()))
	if backgroundKeygenPossible(ek.Metadata.Ctime.Time(), merkleRoot) {
		return false, true, latestGeneration, nil
	}
	return keygenNeeded(ek.Metadata.Ctime.Time(), merkleRoot), latestGeneration, nil
}

type teamEKGenCacheEntry struct {
	Generation         keybase1.EkGeneration
	Ctime              keybase1.Time
	CreationInProgress bool
}

func (e *EKLib) newCacheEntry(generation keybase1.EkGeneration, creationInProgress bool) *teamEKGenCacheEntry {
	return &teamEKGenCacheEntry{
		Generation:         generation,
		Ctime:              keybase1.ToTime(e.clock.Now()),
		CreationInProgress: creationInProgress,
	}
}

func (e *EKLib) cacheKey(teamID keybase1.TeamID) string {
	return teamID.String()
}

func (e *EKLib) isEntryExpired(val interface{}) (*teamEKGenCacheEntry, bool) {
	cacheEntry, ok := val.(*teamEKGenCacheEntry)
	if !ok || cacheEntry == nil {
		return nil, false
	}
	return cacheEntry, e.clock.Now().Sub(cacheEntry.Ctime.Time()) >= cacheEntryLifetime
}

func (e *EKLib) PurgeTeamEKGenCache(teamID keybase1.TeamID, generation keybase1.EkGeneration) {

	cacheKey := e.cacheKey(teamID)
	val, ok := e.teamEKGenCache.Get(cacheKey)
	if ok {
		if cacheEntry, _ := e.isEntryExpired(val); cacheEntry != nil && cacheEntry.Generation != generation {
			e.teamEKGenCache.Remove(cacheKey)
		}
	}
}

func (e *EKLib) GetOrCreateLatestTeamEK(ctx context.Context, teamID keybase1.TeamID) (teamEK keybase1.TeamEk, err error) {
	defer e.G().CTraceTimed(ctx, "GetOrCreateLatestTeamEK", func() error { return err })()
	err = teamEKRetryWrapper(ctx, e.G(), func() error {
		teamEK, err = e.getOrCreateLatestTeamEKInner(ctx, teamID)
		return err
	})
	return teamEK, err
}

func (e *EKLib) getOrCreateLatestTeamEKInner(ctx context.Context, teamID keybase1.TeamID) (teamEK keybase1.TeamEk, err error) {
	defer e.G().CTraceTimed(ctx, "getOrCreateLatestTeamEKInner", func() error { return err })()

	e.Lock()
	defer e.Unlock()

	if _, err = e.checkLoginAndPUK(ctx); err != nil {
		return teamEK, err
	}

	teamEKBoxStorage := e.G().GetTeamEKBoxStorage()
	// Check if we have a cached latest generation
	cacheKey := e.cacheKey(teamID)
	val, ok := e.teamEKGenCache.Get(cacheKey)
	if ok {
		if cacheEntry, expired := e.isEntryExpired(val); !expired || cacheEntry.CreationInProgress {
			teamEK, err = teamEKBoxStorage.Get(ctx, teamID, cacheEntry.Generation)
			if err == nil {
				return teamEK, nil
			}
			// kill our cached entry and re-generate below
			e.teamEKGenCache.Remove(cacheKey)
		}
	}

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return teamEK, err
	}
	merkleRoot := *merkleRootPtr
	defer teamEKBoxStorage.DeleteExpired(ctx, teamID, merkleRoot) // always try to deleteExpired

	// First publish new device or userEKs if we need to.
	if err = e.keygenIfNeeded(ctx, merkleRoot); err != nil {
		return teamEK, err
	}

	// newTeamEKNeeded checks that the current teamEKStatement is signed by the
	// latest PTK, is accessible to a userEK we have access to and that the key
	// is not expired. It's crucial that this verifies that the latest PTK was
	// used since we don't want to use a key signed by an old PTK for
	// encryption.
	teamEKNeeded, backgroundGenPossible, latestGeneration, err := e.newTeamEKNeeded(ctx, teamID, merkleRoot)
	if err != nil {
		return teamEK, err
	} else if backgroundGenPossible {
		// Our current teamEK is *almost* expired but otherwise valid, so let's
		// create the new teamEK in the background. For large teams and an
		// empty UPAK cache it can be expensive to do this calculation and it's
		// unfortunate to block message sending while we otherwise have access
		// to a working teamEK.
		go func() {
			if e.backgroundCreationTestCh != nil {
				select {
				case <-e.backgroundCreationTestCh:
				}
			}

			publishedMetadata, err := publishNewTeamEK(ctx, e.G(), teamID, merkleRoot)
			// Grab the lock once we finish publishing so we do don't block
			e.Lock()
			defer e.Unlock()
			if err != nil {
				// Let's just clear the cache and try again later
				e.G().Log.CDebugf(ctx, "Unable to GetOrCreateLatestTeamEK in the background: %v", err)
				e.teamEKGenCache.Remove(cacheKey)
			} else {
				e.teamEKGenCache.Add(cacheKey, e.newCacheEntry(publishedMetadata.Generation, false))
			}

			if e.backgroundCreationTestCh != nil {
				e.backgroundCreationTestCh <- true
			}
		}()
	} else if teamEKNeeded {
		publishedMetadata, err := publishNewTeamEK(ctx, e.G(), teamID, merkleRoot)
		if err != nil {
			return teamEK, err
		}
		latestGeneration = publishedMetadata.Generation
	}

	teamEK, err = teamEKBoxStorage.Get(ctx, teamID, latestGeneration)
	if err != nil {
		return teamEK, err
	}
	// Cache the latest generation and signal future callers if we are trying
	// to create the new key in the background.
	e.teamEKGenCache.Add(cacheKey, e.newCacheEntry(latestGeneration, backgroundGenPossible))
	return teamEK, nil
}

// Try to get the TeamEK for the given `generation`. If this fails and the
// `generation` is also the current maxGeneration, create a new teamEK.
func (e *EKLib) GetTeamEK(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	defer e.G().CTraceTimed(ctx, "GetTeamEK", func() error { return err })()

	teamEK, err = e.G().GetTeamEKBoxStorage().Get(ctx, teamID, generation)
	if err != nil {
		switch err.(type) {
		case EKUnboxErr, EKMissingBoxErr:
			e.G().Log.Debug(err.Error())
			if _, cerr := e.GetOrCreateLatestTeamEK(ctx, teamID); cerr != nil {
				e.G().Log.CDebugf(ctx, "Unable to GetOrCreateLatestTeamEK: %v", cerr)
			}
		}
	}
	return teamEK, err
}

func (e *EKLib) NewEphemeralSeed() (seed keybase1.Bytes32, err error) {
	return makeNewRandomSeed()
}

func (e *EKLib) DeriveDeviceDHKey(seed keybase1.Bytes32) *libkb.NaclDHKeyPair {
	deviceEKSeed := DeviceEKSeed(seed)
	return deviceEKSeed.DeriveDHKey()
}

func (e *EKLib) SignedDeviceEKStatementFromSeed(ctx context.Context, generation keybase1.EkGeneration, seed keybase1.Bytes32, signingKey libkb.GenericKey, existingMetadata []keybase1.DeviceEkMetadata) (statement keybase1.DeviceEkStatement, signedStatement string, err error) {
	defer e.G().CTraceTimed(ctx, "SignedDeviceEKStatementFromSeed", func() error { return err })()

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return statement, signedStatement, err
	}
	dhKeypair := e.DeriveDeviceDHKey(seed)
	return signDeviceEKStatement(generation, dhKeypair, signingKey, existingMetadata, *merkleRootPtr)
}

// For device provisioning
func (e *EKLib) BoxLatestUserEK(ctx context.Context, receiverKey libkb.NaclDHKeyPair, deviceEKGeneration keybase1.EkGeneration) (userEKBox *keybase1.UserEkBoxed, err error) {
	defer e.G().CTraceTimed(ctx, "BoxLatestUserEK", func() error { return err })()

	// Let's make sure we are up to date with keys first and we have the latest userEK cached.
	if err = e.KeygenIfNeeded(ctx); err != nil {
		return nil, err
	}

	userEKBoxStorage := e.G().GetUserEKBoxStorage()
	maxGeneration, err := userEKBoxStorage.MaxGeneration(ctx)
	if err != nil {
		return nil, err
	}
	if maxGeneration < 0 {
		e.G().Log.CDebugf(ctx, "No userEK found")
		return nil, nil
	}
	userEK, err := userEKBoxStorage.Get(ctx, maxGeneration)
	if err != nil {
		return nil, err
	}
	box, err := receiverKey.EncryptToString(userEK.Seed[:], nil)
	if err != nil {
		return nil, err
	}
	return &keybase1.UserEkBoxed{
		Box:                box,
		DeviceEkGeneration: deviceEKGeneration,
		Metadata:           userEK.Metadata,
	}, nil
}

func (e *EKLib) PrepareNewUserEK(ctx context.Context, merkleRoot libkb.MerkleRoot, pukSeed libkb.PerUserKeySeed) (sig string, boxes []keybase1.UserEkBoxMetadata, newMetadata keybase1.UserEkMetadata, myBox *keybase1.UserEkBoxed, err error) {
	signingKey, err := pukSeed.DeriveSigningKey()
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	return prepareNewUserEK(ctx, e.G(), merkleRoot, signingKey)
}

func (e *EKLib) BoxLatestTeamEK(ctx context.Context, teamID keybase1.TeamID, recipients []keybase1.UID) (teamEKBoxes *[]keybase1.TeamEkBoxMetadata, err error) {
	defer e.G().CTraceTimed(ctx, "BoxLatestTeamEK", func() error { return err })()

	// If we need a new teamEK let's just create it when needed, the new
	// members will be part of the team and will have access to it via the
	// normal mechanisms.
	if teamEKNeeded, err := e.NewTeamEKNeeded(ctx, teamID); err != nil {
		return nil, err
	} else if teamEKNeeded {
		return nil, nil
	}
	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.metaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return nil, err
	}
	statementMap, err := fetchUserEKStatements(ctx, e.G(), recipients)
	if err != nil {
		return nil, err
	}
	usersMetadata, err := activeUserEKMetadata(ctx, e.G(), statementMap, *merkleRootPtr)
	if err != nil {
		return nil, err
	}

	teamEKBoxStorage := e.G().GetTeamEKBoxStorage()
	maxGeneration, err := teamEKBoxStorage.MaxGeneration(ctx, teamID)
	if err != nil {
		return nil, err
	}
	teamEK, err := teamEKBoxStorage.Get(ctx, teamID, maxGeneration)
	if err != nil {
		return nil, err
	}
	boxes, _, err := boxTeamEKForUsers(ctx, e.G(), usersMetadata, teamEK)
	return boxes, err
}

func (e *EKLib) PrepareNewTeamEK(ctx context.Context, teamID keybase1.TeamID, signingKey libkb.NaclSigningKeyPair, recipients []keybase1.UID) (sig string, boxes *[]keybase1.TeamEkBoxMetadata, newMetadata keybase1.TeamEkMetadata, myBox *keybase1.TeamEkBoxed, err error) {

	// If we need a new teamEK let's just create it when needed, the new
	// members will be part of the team and will have access to it via the
	// normal mechanisms.
	if teamEKNeeded, err := e.NewTeamEKNeeded(ctx, teamID); err != nil {
		return "", nil, newMetadata, nil, err
	} else if teamEKNeeded {
		return "", nil, newMetadata, nil, nil
	}

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(e.MetaContext(ctx), libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	merkleRoot := *merkleRootPtr

	statementMap, err := fetchUserEKStatements(ctx, e.G(), recipients)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	usersMetadata, err := activeUserEKMetadata(ctx, e.G(), statementMap, merkleRoot)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	return prepareNewTeamEK(ctx, e.G(), teamID, signingKey, usersMetadata, merkleRoot)
}

func (e *EKLib) OnLogin() error {
	if err := e.KeygenIfNeeded(context.Background()); err != nil {
		e.G().Log.CDebugf(context.Background(), "OnLogin error: %v", err)
	}
	return nil
}

func (e *EKLib) OnLogout() error {
	e.teamEKGenCache.Purge()
	if deviceEKStorage := e.G().GetDeviceEKStorage(); deviceEKStorage != nil {
		deviceEKStorage.ClearCache()
	}
	if userEKBoxStorage := e.G().GetUserEKBoxStorage(); userEKBoxStorage != nil {
		userEKBoxStorage.ClearCache()
	}
	if teamEKBoxStorage := e.G().GetTeamEKBoxStorage(); teamEKBoxStorage != nil {
		teamEKBoxStorage.ClearCache()
	}
	return nil
}
