package teambot

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type MemberKeyer struct {
	locktab *libkb.LockTable
	sync.RWMutex
	lru *lru.Cache
}

var _ libkb.TeambotMemberKeyer = (*MemberKeyer)(nil)

func NewMemberKeyer(mctx libkb.MetaContext) *MemberKeyer {
	nlru, err := lru.New(lruSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &MemberKeyer{
		lru:     nlru,
		locktab: libkb.NewLockTable(),
	}
}

// There are plenty of race conditions where the PTK membership list can change
// out from under us while we're in the middle of posting a new key, causing
// the post to fail. Detect these conditions and retry.
func (k *MemberKeyer) retryWrapper(mctx libkb.MetaContext, retryFn func() error) (err error) {
	knownRaceConditions := []keybase1.StatusCode{
		keybase1.StatusCode_SCSigWrongKey,
		keybase1.StatusCode_SCSigOldSeqno,
		keybase1.StatusCode_SCTeambotKeyBadGeneration,
		keybase1.StatusCode_SCTeambotKeyOldBoxedGeneration,
	}
	for tries := 0; tries < maxRetries; tries++ {
		if err = retryFn(); err == nil {
			return nil
		}
		retryableError := false
		for _, code := range knownRaceConditions {
			if libkb.IsAppStatusCode(err, code) {
				mctx.Debug("retryWrapper found a retryable error on try %d: %s", tries, err)
				retryableError = true
				break
			}
		}
		if !retryableError {
			return err
		}
	}
	return err
}

func (k *MemberKeyer) lockForTeamIDAndApp(mctx libkb.MetaContext, teamID keybase1.TeamID, app keybase1.TeamApplication) func() {
	k.RLock()
	lock := k.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), k.lockKey(teamID, app))
	return func() {
		k.RUnlock()
		lock.Release(mctx.Ctx())
	}
}

func (k *MemberKeyer) lockKey(teamID keybase1.TeamID, app keybase1.TeamApplication) string {
	return fmt.Sprintf("%s-%d", teamID.String(), app)
}

func (k *MemberKeyer) cacheKey(teamID keybase1.TeamID, botUID keybase1.UID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) string {
	return fmt.Sprintf("%s-%s-%d-%d", teamID, botUID, app, generation)
}

// GetOrCreateTeambotKey derives a TeambotKey from the given `appKey`, and
// posts the result to the server if necessary. An in memory cache is kept of
// keys that have already been posted so we don't hit the server each time.
func (k *MemberKeyer) GetOrCreateTeambotKey(mctx libkb.MetaContext, teamID keybase1.TeamID,
	gBotUID gregor1.UID, appKey keybase1.TeamApplicationKey) (
	key keybase1.TeambotKey, created bool, err error) {
	mctx = mctx.WithLogTag("GOCTBK")

	botUID, err := keybase1.UIDFromSlice(gBotUID.Bytes())
	if err != nil {
		return key, false, err
	}

	err = k.retryWrapper(mctx, func() error {
		unlock := k.lockForTeamIDAndApp(mctx, teamID, appKey.Application)
		defer unlock()
		key, created, err = k.getOrCreateTeambotKeyLocked(mctx, teamID, botUID, appKey)
		return err
	})
	return key, created, err
}

func (k *MemberKeyer) getOrCreateTeambotKeyLocked(mctx libkb.MetaContext, teamID keybase1.TeamID,
	botUID keybase1.UID, appKey keybase1.TeamApplicationKey) (
	key keybase1.TeambotKey, created bool, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("getOrCreateTeambotKeyLocked: teamID: %v, botUID: %v", teamID, botUID), func() error { return err })()

	seed := k.deriveTeambotKeyFromAppKey(mctx, appKey, botUID)

	// Check our cache and see if we should attempt to publish the our derived
	// key or not.
	cacheKey := k.cacheKey(teamID, botUID, appKey.Application, keybase1.TeambotKeyGeneration(appKey.KeyGeneration))
	entry, ok := k.lru.Get(cacheKey)
	if ok {
		metadata, ok := entry.(keybase1.TeambotKeyMetadata)
		if !ok {
			return key, false, fmt.Errorf("unable to load teambotkey metadata from cache found %T, expected %T",
				entry, keybase1.TeambotKeyMetadata{})
		}
		key = keybase1.TeambotKey{
			Seed:     seed,
			Metadata: metadata,
		}
		return key, false, nil
	}

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return key, false, err
	}

	sig, box, isRestrictedBotMember, err := k.prepareNewTeambotKey(mctx, team, botUID, appKey)
	if err != nil {
		return key, false, err
	}

	// If the bot is not a restricted bot member don't try to publish the key
	// for them. This can happen when decrypting past content after the bot is
	// removed from the team.
	metadata := box.Metadata
	if isRestrictedBotMember {
		if err = k.postNewTeambotKey(mctx, team.ID, sig, box.Box); err != nil {
			return key, false, err
		}
	}

	k.lru.Add(cacheKey, metadata)
	key = keybase1.TeambotKey{
		Seed:     seed,
		Metadata: metadata,
	}

	return key, isRestrictedBotMember, nil
}

func (k *MemberKeyer) deriveTeambotKeyFromAppKey(mctx libkb.MetaContext, applicationKey keybase1.TeamApplicationKey, botUID keybase1.UID) keybase1.Bytes32 {
	hasher := hmac.New(sha256.New, applicationKey.Key[:])
	_, _ = hasher.Write(botUID.ToBytes())
	_, _ = hasher.Write([]byte{byte(applicationKey.Application)})
	_, _ = hasher.Write([]byte(libkb.EncryptionReasonTeambotKey))
	return libkb.MakeByte32(hasher.Sum(nil))
}

func (k *MemberKeyer) postNewTeambotKey(mctx libkb.MetaContext, teamID keybase1.TeamID,
	sig, box string) (err error) {
	defer mctx.TraceTimed("MemberKeyer#postNewTeambotKey", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "teambot/key",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"sig":          libkb.S{Val: sig},
			"box":          libkb.S{Val: box},
			"is_ephemeral": libkb.B{Val: false},
		},
		AppStatusCodes: []int{libkb.SCOk, libkb.SCTeambotKeyGenerationExists},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}

func (k *MemberKeyer) prepareNewTeambotKey(mctx libkb.MetaContext, team *teams.Team,
	botUID keybase1.UID, appKey keybase1.TeamApplicationKey) (
	sig string, box *keybase1.TeambotKeyBoxed, isRestrictedBotMember bool, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("MemberKeyer#prepareNewTeambotKey: teamID: %v, botUID: %v", team.ID, botUID),
		func() error { return err })()

	upak, _, err := mctx.G().GetUPAKLoader().LoadV2(
		libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(botUID))
	if err != nil {
		return "", nil, false, err
	}

	latestPUK := upak.Current.GetLatestPerUserKey()
	if latestPUK == nil {
		// The latest PUK might be stale. Force a reload, then check this over again.
		upak, _, err = mctx.G().GetUPAKLoader().LoadV2(
			libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(botUID).WithForceReload())
		if err != nil {
			return "", nil, false, err
		}
		latestPUK = upak.Current.GetLatestPerUserKey()
		if latestPUK == nil {
			return "", nil, false, fmt.Errorf("No PUK")
		}
	}

	seed := k.deriveTeambotKeyFromAppKey(mctx, appKey, botUID)

	recipientKey, err := libkb.ImportKeypairFromKID(latestPUK.EncKID)
	if err != nil {
		return "", nil, false, err
	}

	metadata := keybase1.TeambotKeyMetadata{
		Kid:           deriveTeambotDHKey(seed).GetKID(),
		Generation:    keybase1.TeambotKeyGeneration(appKey.KeyGeneration),
		Uid:           botUID,
		PukGeneration: keybase1.PerUserKeyGeneration(latestPUK.Gen),
		Application:   appKey.Application,
	}

	// Encrypting with a nil sender means we'll generate a random sender
	// private key.
	boxedSeed, err := recipientKey.EncryptToString(seed[:], nil)
	if err != nil {
		return "", nil, false, err
	}

	boxed := keybase1.TeambotKeyBoxed{
		Box:      boxedSeed,
		Metadata: metadata,
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return "", nil, false, err
	}

	signingKey, err := team.SigningKey(mctx.Ctx())
	if err != nil {
		return "", nil, false, err
	}
	sig, _, err = signingKey.SignToString(metadataJSON)
	if err != nil {
		return "", nil, false, err
	}

	role, err := team.MemberRole(mctx.Ctx(), upak.ToUserVersion())
	if err != nil {
		return "", nil, false, err
	}
	return sig, &boxed, role.IsRestrictedBot(), nil
}

func (k *MemberKeyer) PurgeCacheAtGeneration(mctx libkb.MetaContext, teamID keybase1.TeamID,
	botUID keybase1.UID, app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) {
	unlock := k.lockForTeamIDAndApp(mctx, teamID, app)
	defer unlock()
	cacheKey := k.cacheKey(teamID, botUID, app, generation)
	k.lru.Remove(cacheKey)
}

func (k *MemberKeyer) PurgeCache(mctx libkb.MetaContext) {
	k.Lock()
	defer k.Unlock()
	k.lru.Purge()
}

func (k *MemberKeyer) OnLogout(mctx libkb.MetaContext) error {
	k.PurgeCache(mctx)
	return nil
}

func (k *MemberKeyer) OnDbNuke(mctx libkb.MetaContext) error {
	k.PurgeCache(mctx)
	return nil
}
