package ephemeral

import (
	"fmt"
	"log"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

const SkipKeygenNilMerkleRoot = "Skipping key generation, unable to fetch merkle root"

// Maximum number of retries for key generation
const maxRetries = 5
const cacheEntryLifetime = time.Minute * 5
const lruSize = 200

type EKLib struct {
	teamEKGenCache *lru.Cache
	sync.Mutex

	// During testing we may want to stall background work to assert cache
	// state.
	clock                    clockwork.Clock
	backgroundCreationTestCh chan bool
	backgroundDeletionTestCh chan bool
	stopCh                   chan struct{}
}

func NewEKLib(mctx libkb.MetaContext) *EKLib {
	nlru, err := lru.New(lruSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	ekLib := &EKLib{
		teamEKGenCache: nlru,
		clock:          clockwork.NewRealClock(),
		stopCh:         make(chan struct{}),
	}
	go ekLib.backgroundKeygen(mctx)
	return ekLib
}

func (e *EKLib) Shutdown() {
	e.Lock()
	defer e.Unlock()
	if e.stopCh != nil {
		close(e.stopCh)
		e.stopCh = nil
	}
}

func (e *EKLib) backgroundKeygen(mctx libkb.MetaContext) {
	mctx = mctx.WithLogTag("EKBKG")
	mctx.Debug("backgroundKeygen: starting up")
	keygenInterval := time.Hour
	lastRun := time.Now()

	runIfNeeded := func(force bool) {
		now := libkb.ForceWallClock(time.Now())
		shouldRun := now.Sub(lastRun) >= keygenInterval
		mctx.Debug("backgroundKeygen: runIfNeeded: lastRun: %v, now: %v, shouldRun: %v, force: %v",
			lastRun, now, shouldRun, force)
		if force || shouldRun {
			if err := e.KeygenIfNeeded(mctx); err != nil {
				mctx.Debug("backgroundKeygen keygenIfNeeded error: %v", err)
			}
			lastRun = time.Now()
		}
	}

	// Fire off on startup
	runIfNeeded(true /* force */)

	ticker := libkb.NewBgTicker(keygenInterval)
	state := keybase1.MobileAppState_FOREGROUND
	// Run every hour but also check if enough wall clock time has elapsed when
	// we are in a BACKGROUNDACTIVE state.
	for {
		select {
		case <-ticker.C:
			runIfNeeded(false /* force */)
		case state = <-mctx.G().MobileAppState.NextUpdate(&state):
			if state == keybase1.MobileAppState_BACKGROUNDACTIVE {
				// Before running  we pause briefly so we don't stampede for
				// resources with other background tasks. libkb.BgTicker
				// handles this internally, so we only need to throttle on
				// MobileAppState change.
				time.Sleep(time.Second)
				runIfNeeded(false /* force */)
			}
		case <-e.stopCh:
			ticker.Stop()
			return
		}
	}
}

func (e *EKLib) setClock(clock clockwork.Clock) {
	e.clock = clock
}

func (e *EKLib) setBackgroundCreationTestCh(ch chan bool) {
	e.backgroundCreationTestCh = ch
}

func (e *EKLib) setBackgroundDeleteTestCh(ch chan bool) {
	e.backgroundDeletionTestCh = ch
}

func (e *EKLib) checkLogin(mctx libkb.MetaContext) error {
	if isOneshot, err := mctx.G().IsOneshot(mctx.Ctx()); err != nil {
		mctx.Debug("EKLib#checkLogin unable to check IsOneshot %v", err)
		return err
	} else if isOneshot {
		return fmt.Errorf("Aborting ephemeral key generation, using oneshot session!")
	}

	if loggedIn, _, err := libkb.BootstrapActiveDeviceWithMetaContext(mctx); err != nil {
		return err
	} else if !loggedIn {
		return fmt.Errorf("Aborting ephemeral key generation, user is not logged in!")
	}
	return nil
}

func (e *EKLib) KeygenIfNeeded(mctx libkb.MetaContext) (err error) {
	e.Lock()
	defer e.Unlock()
	var merkleRoot libkb.MerkleRoot
	// Always try to delete keys if we are logged in even if we get an error
	// when checking our PUK or fetching the merkleRoot. `keygenIfNeeded` this
	// also tries best effort to delete with errors, but try here in case we
	// error before reaching that call.
	defer func() {
		if err != nil {
			e.cleanupStaleUserAndDeviceEKsInBackground(mctx, merkleRoot)
		}
	}()

	if err = e.checkLogin(mctx); err != nil {
		return err
	}

	for tries := 0; tries < maxRetries; tries++ {
		mctx.Debug("keygenIfNeeded attempt #%d: %v", tries, err)
		merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
		if err != nil {
			mctx.Debug("Unable to fetch merkle root: %v, attempting keygenIfNeeded with nil root", err)
			merkleRootPtr = &libkb.MerkleRoot{}
		}
		if err = e.keygenIfNeeded(mctx, *merkleRootPtr, true /* shouldCleanup */); err == nil {
			return nil
		}
		select {
		case <-mctx.Ctx().Done():
			mctx.Debug("aborting KeygenIfNeeded, context cancelled")
			return err
		case <-time.After(20 * time.Millisecond):
		}
	}
	return err
}

func (e *EKLib) keygenIfNeeded(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot, shouldCleanup bool) (err error) {
	defer mctx.TraceTimed("keygenIfNeeded", func() error { return err })()
	defer func() {
		if shouldCleanup {
			e.cleanupStaleUserAndDeviceEKsInBackground(mctx, merkleRoot)
		}
	}()

	// Abort. We only care about calling `cleanupStaleUserAndDeviceEKs.
	if merkleRoot.IsNil() {
		return fmt.Errorf(SkipKeygenNilMerkleRoot)
	}

	if deviceEKNeeded, err := e.newDeviceEKNeeded(mctx, merkleRoot); err != nil {
		return err
	} else if deviceEKNeeded {
		_, err = publishNewDeviceEK(mctx, merkleRoot)
		if err != nil {
			return err
		}
	}

	// newUserEKNeeded checks that the current userEKStatement is signed by our
	// latest PUK, is accessible to a deviceEK we have access to and that the
	// key is not expired. It's crucial that this verifies that the latest PUK
	// was used since we don't want to use a key signed by an old PUK for
	// encryption.
	if userEKNeeded, err := e.newUserEKNeeded(mctx, merkleRoot); err != nil {
		return err
	} else if userEKNeeded {
		_, err = publishNewUserEK(mctx, merkleRoot)
		if err != nil {
			return err
		}
	}
	return nil
}

func (e *EKLib) CleanupStaleUserAndDeviceEKs(mctx libkb.MetaContext) (err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		mctx.Debug("Unable to fetch merkle root: %v, attempting deviceEK deletion with nil root", err)
		merkleRootPtr = &libkb.MerkleRoot{}
	}
	return e.cleanupStaleUserAndDeviceEKs(mctx, *merkleRootPtr)
}

func (e *EKLib) cleanupStaleUserAndDeviceEKs(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (err error) {
	defer mctx.TraceTimed("cleanupStaleUserAndDeviceEKs", func() error { return err })()

	epick := libkb.FirstErrorPicker{}

	deviceEKStorage := mctx.G().GetDeviceEKStorage()
	_, err = deviceEKStorage.DeleteExpired(mctx, merkleRoot)
	epick.Push(err)

	// Abort. We only cared about deleting expired deviceEKs.
	if merkleRoot.IsNil() {
		return fmt.Errorf("skipping userEK deletion, unable to fetch merkle root")
	}

	userEKBoxStorage := mctx.G().GetUserEKBoxStorage()
	_, err = userEKBoxStorage.DeleteExpired(mctx, merkleRoot)
	epick.Push(err)
	return epick.Error()
}

func (e *EKLib) cleanupStaleUserAndDeviceEKsInBackground(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) {
	go func() {
		if err := e.cleanupStaleUserAndDeviceEKs(mctx, merkleRoot); err != nil {
			mctx.Debug("Unable to cleanupStaleUserAndDeviceEKsInBackground: %v", err)
		}

		if e.backgroundDeletionTestCh != nil {
			e.backgroundDeletionTestCh <- true
		}
	}()
}

func (e *EKLib) NewDeviceEKNeeded(mctx libkb.MetaContext) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	return e.newDeviceEKNeeded(mctx, *merkleRootPtr)
}

func (e *EKLib) newDeviceEKNeeded(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	defer mctx.TraceTimed("newDeviceEKNeeded", func() error { return err })()
	defer func() {
		switch err.(type) {
		case libkb.UnboxError:
			mctx.Debug("newDeviceEKNeeded: unable to fetch latest: %v, creating new deviceEK", err)
			needed = true
			err = nil
		}
	}()

	s := mctx.G().GetDeviceEKStorage()
	maxGeneration, err := s.MaxGeneration(mctx, true)
	if err != nil {
		return false, err
	} else if maxGeneration < 0 {
		return true, nil
	}

	ek, err := s.Get(mctx, maxGeneration)
	if err != nil {
		return false, err
	}

	// Ok we can access the ek, check lifetime.
	mctx.Debug("nextDeviceEKNeeded at: %v", nextKeygenTime(ek.Metadata.Ctime.Time()))
	return keygenNeeded(ek.Metadata.Ctime.Time(), merkleRoot), nil
}

func (e *EKLib) NewUserEKNeeded(mctx libkb.MetaContext) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	return e.newUserEKNeeded(mctx, *merkleRootPtr)
}

func (e *EKLib) newUserEKNeeded(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	defer mctx.TraceTimed("newUserEKNeeded", func() error { return err })()

	// Let's see what the latest server statement is. This verifies that the
	// latest statement was signed by the latest PUK and otherwise fails with
	// wrongKID set.
	statement, _, wrongKID, err := fetchUserEKStatement(mctx, mctx.G().Env.GetUID())
	if wrongKID {
		return true, nil
	} else if err != nil {
		return false, err
	}
	if statement == nil {
		return true, nil
	}
	// Can we access this generation? If not, let's regenerate.
	s := mctx.G().GetUserEKBoxStorage()
	ek, err := s.Get(mctx, statement.CurrentUserEkMetadata.Generation, nil)
	if err != nil {
		switch err.(type) {
		case EphemeralKeyError:
			mctx.Debug(err.Error())
			return true, nil
		default:
			return false, err
		}
	}
	// Ok we can access the ek, check lifetime.
	mctx.Debug("nextUserEKNeeded at: %v", nextKeygenTime(ek.Metadata.Ctime.Time()))
	return keygenNeeded(ek.Metadata.Ctime.Time(), merkleRoot), nil
}

func (e *EKLib) NewTeamEKNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID) (needed bool, err error) {
	e.Lock()
	defer e.Unlock()

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return false, err
	}
	needed, _, _, err = e.newTeamEKNeeded(mctx, teamID, *merkleRootPtr)
	return needed, err
}

func (e *EKLib) newTeamEKNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID,
	merkleRoot libkb.MerkleRoot) (needed, backgroundGenPossible bool, latestGeneration keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed("newTeamEKNeeded", func() error { return err })()

	// Let's see what the latest server statement is. This verifies that the
	// latest statement was signed by the latest PTK and otherwise fails with
	// wrongKID set.
	statement, latestGeneration, wrongKID, err := fetchTeamEKStatement(mctx, teamID)
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
	s := mctx.G().GetTeamEKBoxStorage()
	ek, err := s.Get(mctx, teamID, statement.CurrentTeamEkMetadata.Generation, nil)
	if err != nil {
		switch err.(type) {
		case EphemeralKeyError:
			mctx.Debug(err.Error())
			return true, false, latestGeneration, nil
		default:
			return false, false, latestGeneration, err
		}
	}
	// Ok we can access the ek, check lifetime.
	mctx.Debug("nextTeamEKNeeded at: %v", nextKeygenTime(ek.Metadata.Ctime.Time()))
	if backgroundKeygenPossible(ek.Metadata.Ctime.Time(), merkleRoot) {
		return false, true, latestGeneration, nil
	}
	return keygenNeeded(ek.Metadata.Ctime.Time(), merkleRoot), false, latestGeneration, nil
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

func (e *EKLib) PurgeCachesForTeamID(mctx libkb.MetaContext, teamID keybase1.TeamID) {
	mctx.Debug("PurgeCachesForTeamID: teamID: %v", teamID)
	e.teamEKGenCache.Remove(e.cacheKey(teamID))
	if err := mctx.G().GetTeamEKBoxStorage().PurgeCacheForTeamID(mctx, teamID); err != nil {
		mctx.Debug("unable to PurgeCacheForTeamID: %v", err)
	}
}

func (e *EKLib) PurgeCachesForTeamIDAndGeneration(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) {
	mctx.Debug("PurgeCachesForTeamIDAndGeneration: teamID: %v, generation: %v", teamID, generation)
	cacheKey := e.cacheKey(teamID)
	val, ok := e.teamEKGenCache.Get(cacheKey)
	if ok {
		if cacheEntry, _ := e.isEntryExpired(val); cacheEntry != nil && cacheEntry.Generation != generation {
			e.teamEKGenCache.Remove(cacheKey)
		}
	}
	if err := mctx.G().GetTeamEKBoxStorage().Delete(mctx, teamID, generation); err != nil {
		mctx.Debug("unable to PurgeCacheForTeamIDAndGeneration: %v", err)
	}
}

func (e *EKLib) GetOrCreateLatestTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID) (teamEK keybase1.TeamEk, created bool, err error) {
	if err = e.checkLogin(mctx); err != nil {
		return teamEK, false, err
	}

	err = teamEKRetryWrapper(mctx, func() error {
		teamEK, created, err = e.getOrCreateLatestTeamEKInner(mctx, teamID)
		return err
	})
	return teamEK, created, err
}

func (e *EKLib) getOrCreateLatestTeamEKInner(mctx libkb.MetaContext, teamID keybase1.TeamID) (teamEK keybase1.TeamEk, created bool, err error) {
	defer mctx.TraceTimed("getOrCreateLatestTeamEKInner", func() error { return err })()
	e.Lock()
	defer e.Unlock()

	teamEKBoxStorage := mctx.G().GetTeamEKBoxStorage()
	// Check if we have a cached latest generation
	cacheKey := e.cacheKey(teamID)
	val, ok := e.teamEKGenCache.Get(cacheKey)
	if ok {
		if cacheEntry, expired := e.isEntryExpired(val); !expired || cacheEntry.CreationInProgress {
			teamEK, err = teamEKBoxStorage.Get(mctx, teamID, cacheEntry.Generation, nil)
			if err == nil {
				return teamEK, false, nil
			}
			// kill our cached entry and re-generate below
			e.teamEKGenCache.Remove(cacheKey)
		}
	}

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return teamEK, false, err
	}
	merkleRoot := *merkleRootPtr
	defer func() { e.cleanupStaleUserAndDeviceEKsInBackground(mctx, merkleRoot) }()
	defer teamEKBoxStorage.DeleteExpired(mctx, teamID, merkleRoot)

	// First publish new device or userEKs if we need to. We pass shouldCleanup
	// = false so we can run deletion in the background ourselves and not block
	// this call.
	if err = e.keygenIfNeeded(mctx, merkleRoot, false /* shouldCleanup */); err != nil {
		return teamEK, false, err
	}

	// newTeamEKNeeded checks that the current teamEKStatement is signed by the
	// latest PTK, is accessible to a userEK we have access to and that the key
	// is not expired. It's crucial that this verifies that the latest PTK was
	// used since we don't want to use a key signed by an old PTK for
	// encryption.
	teamEKNeeded, backgroundGenPossible, latestGeneration, err := e.newTeamEKNeeded(mctx, teamID, merkleRoot)
	if err != nil {
		return teamEK, false, err
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

			publishedMetadata, err := publishNewTeamEK(mctx, teamID, merkleRoot)
			// Grab the lock once we finish publishing so we do don't block
			e.Lock()
			defer e.Unlock()
			created := false
			if err != nil {
				// Let's just clear the cache and try again later
				mctx.Debug("Unable to GetOrCreateLatestTeamEK in the background: %v", err)
				e.teamEKGenCache.Remove(cacheKey)
			} else {
				e.teamEKGenCache.Add(cacheKey, e.newCacheEntry(publishedMetadata.Generation, false))
				created = true
			}

			if e.backgroundCreationTestCh != nil {
				e.backgroundCreationTestCh <- created
			}
		}()
	} else if teamEKNeeded {
		publishedMetadata, err := publishNewTeamEK(mctx, teamID, merkleRoot)
		if err != nil {
			return teamEK, false, err
		}
		latestGeneration = publishedMetadata.Generation
	}

	teamEK, err = teamEKBoxStorage.Get(mctx, teamID, latestGeneration, nil)
	if err != nil {
		return teamEK, false, err
	}
	// Cache the latest generation and signal future callers if we are trying
	// to create the new key in the background.
	e.teamEKGenCache.Add(cacheKey, e.newCacheEntry(latestGeneration, backgroundGenPossible))
	return teamEK, teamEKNeeded, nil
}

// Try to get the TeamEK for the given `generation`. If this fails and the
// `generation` is also the current maxGeneration, create a new teamEK.
func (e *EKLib) GetTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (teamEK keybase1.TeamEk, err error) {
	defer mctx.TraceTimed("GetTeamEK", func() error { return err })()

	teamEKBoxStorage := mctx.G().GetTeamEKBoxStorage()
	teamEK, err = teamEKBoxStorage.Get(mctx, teamID, generation, contentCtime)
	if err != nil {
		switch err.(type) {
		case EphemeralKeyError:
			mctx.Debug(err.Error())
			// If we are unable to get the current max generation, try to kick
			// off creation of a new key.
			go func(mctx libkb.MetaContext) {
				maxGeneration, err := teamEKBoxStorage.MaxGeneration(mctx, teamID, true)
				if err != nil {
					mctx.Debug("Unable to get MaxGeneration: %v", err)
					return
				}
				if generation == maxGeneration {
					_, created, cerr := e.GetOrCreateLatestTeamEK(mctx, teamID)
					if cerr != nil {
						mctx.Debug("Unable to GetOrCreateLatestTeamEK: %v", cerr)
					}
					if e.backgroundCreationTestCh != nil {
						e.backgroundCreationTestCh <- created
					}
				}
			}(libkb.NewMetaContextBackground(mctx.G()))
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

func (e *EKLib) SignedDeviceEKStatementFromSeed(mctx libkb.MetaContext, generation keybase1.EkGeneration,
	seed keybase1.Bytes32, signingKey libkb.GenericKey) (statement keybase1.DeviceEkStatement, signedStatement string, err error) {
	defer mctx.TraceTimed("SignedDeviceEKStatementFromSeed", func() error { return err })()

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return statement, signedStatement, err
	}
	dhKeypair := e.DeriveDeviceDHKey(seed)
	return signDeviceEKStatement(generation, dhKeypair, signingKey, *merkleRootPtr)
}

// For device provisioning
func (e *EKLib) BoxLatestUserEK(mctx libkb.MetaContext, receiverKey libkb.NaclDHKeyPair,
	deviceEKGeneration keybase1.EkGeneration) (userEKBox *keybase1.UserEkBoxed, err error) {
	defer mctx.TraceTimed("BoxLatestUserEK", func() error { return err })()

	// Let's make sure we are up to date with keys first and we have the latest userEK cached.
	if err = e.KeygenIfNeeded(mctx); err != nil {
		return nil, err
	}

	userEKBoxStorage := mctx.G().GetUserEKBoxStorage()
	maxGeneration, err := userEKBoxStorage.MaxGeneration(mctx, false)
	if err != nil {
		return nil, err
	}
	if maxGeneration < 0 {
		mctx.Debug("No userEK found")
		return nil, nil
	}
	userEK, err := userEKBoxStorage.Get(mctx, maxGeneration, nil)
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

func (e *EKLib) PrepareNewUserEK(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot,
	pukSeed libkb.PerUserKeySeed) (sig string, boxes []keybase1.UserEkBoxMetadata,
	newMetadata keybase1.UserEkMetadata, myBox *keybase1.UserEkBoxed, err error) {
	signingKey, err := pukSeed.DeriveSigningKey()
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	return prepareNewUserEK(mctx, merkleRoot, signingKey)
}

func (e *EKLib) BoxLatestTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, recipients []keybase1.UID) (teamEKBoxes *[]keybase1.TeamEkBoxMetadata, err error) {
	defer mctx.TraceTimed("BoxLatestTeamEK", func() error { return err })()

	// If we need a new teamEK let's just create it when needed, the new
	// members will be part of the team and will have access to it via the
	// normal mechanisms.
	if teamEKNeeded, err := e.NewTeamEKNeeded(mctx, teamID); err != nil {
		return nil, err
	} else if teamEKNeeded {
		return nil, nil
	}
	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return nil, err
	}
	statementMap, err := fetchUserEKStatements(mctx, recipients)
	if err != nil {
		return nil, err
	}
	usersMetadata, err := activeUserEKMetadata(mctx, statementMap, *merkleRootPtr)
	if err != nil {
		return nil, err
	}

	teamEKBoxStorage := mctx.G().GetTeamEKBoxStorage()
	maxGeneration, err := teamEKBoxStorage.MaxGeneration(mctx, teamID, false)
	if err != nil {
		return nil, err
	}
	teamEK, err := teamEKBoxStorage.Get(mctx, teamID, maxGeneration, nil)
	if err != nil {
		return nil, err
	}
	boxes, _, err := boxTeamEKForUsers(mctx, usersMetadata, teamEK)
	return boxes, err
}

func (e *EKLib) PrepareNewTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, signingKey libkb.NaclSigningKeyPair, recipients []keybase1.UID) (sig string, boxes *[]keybase1.TeamEkBoxMetadata, newMetadata keybase1.TeamEkMetadata, myBox *keybase1.TeamEkBoxed, err error) {

	// If we need a new teamEK let's just create it when needed, the new
	// members will be part of the team and will have access to it via the
	// normal mechanisms.
	if teamEKNeeded, err := e.NewTeamEKNeeded(mctx, teamID); err != nil {
		return "", nil, newMetadata, nil, err
	} else if teamEKNeeded {
		return "", nil, newMetadata, nil, nil
	}

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	merkleRoot := *merkleRootPtr

	statementMap, err := fetchUserEKStatements(mctx, recipients)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	usersMetadata, err := activeUserEKMetadata(mctx, statementMap, merkleRoot)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	return prepareNewTeamEK(mctx, teamID, signingKey, usersMetadata, merkleRoot)
}

func (e *EKLib) ClearCaches(mctx libkb.MetaContext) {
	defer mctx.TraceTimed("EKLib.ClearCaches", func() error { return nil })()
	e.Lock()
	defer e.Unlock()
	mctx.Debug("| EKLib.ClearCaches teamEKGenCache")
	e.teamEKGenCache.Purge()
	mctx.Debug("| EKLib.ClearCaches deviceEKStorage")
	if deviceEKStorage := mctx.G().GetDeviceEKStorage(); deviceEKStorage != nil {
		deviceEKStorage.ClearCache()
	}
	mctx.Debug("| EKLib.ClearCaches userEKBoxStorage")
	if userEKBoxStorage := mctx.G().GetUserEKBoxStorage(); userEKBoxStorage != nil {
		userEKBoxStorage.ClearCache()
	}
	mctx.Debug("| EKLib.ClearCaches teamEKBoxStorage")
	if teamEKBoxStorage := mctx.G().GetTeamEKBoxStorage(); teamEKBoxStorage != nil {
		teamEKBoxStorage.ClearCache()
	}
}

func (e *EKLib) OnLogin(mctx libkb.MetaContext) error {
	if err := e.KeygenIfNeeded(mctx); err != nil {
		mctx.Debug("OnLogin error: %v", err)
	}
	if deviceEKStorage := mctx.G().GetDeviceEKStorage(); deviceEKStorage != nil {
		deviceEKStorage.SetLogPrefix(mctx)
	}
	return nil
}

func (e *EKLib) OnLogout(mctx libkb.MetaContext) error {
	e.ClearCaches(mctx)
	if deviceEKStorage := mctx.G().GetDeviceEKStorage(); deviceEKStorage != nil {
		deviceEKStorage.SetLogPrefix(mctx)
	}
	return nil
}

func (e *EKLib) OnDbNuke(mctx libkb.MetaContext) error {
	e.ClearCaches(mctx)
	return nil
}
