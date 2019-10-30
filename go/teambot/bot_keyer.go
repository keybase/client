package teambot

import (
	"context"
	"fmt"
	"log"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
)

const botKeyStorageVersion = 1

type BotKeyer struct {
	locktab *libkb.LockTable
	lru     *lru.Cache
	edb     *encrypteddb.EncryptedDB
	clock   clockwork.Clock
}

var _ libkb.TeambotBotKeyer = (*BotKeyer)(nil)

func NewBotKeyer(mctx libkb.MetaContext) *BotKeyer {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return encrypteddb.GetSecretBoxKey(ctx, mctx.G(), encrypteddb.DefaultSecretUI,
			libkb.EncryptionReasonTeambotKeyLocalStorage, "encrypting teambot keys cache")
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	nlru, err := lru.New(lruSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &BotKeyer{
		edb:     encrypteddb.New(mctx.G(), dbFn, keyFn),
		lru:     nlru,
		locktab: libkb.NewLockTable(),
		clock:   clockwork.NewRealClock(),
	}
}

func (k *BotKeyer) SetClock(clock clockwork.Clock) {
	k.clock = clock
}

func (k *BotKeyer) lockKey(teamID keybase1.TeamID) string {
	return teamID.String()
}

func (k *BotKeyer) cacheKey(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (string, error) {
	uv, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return "", err
	}
	key := fmt.Sprintf("teambotKey-%d-%s-%s-%d-%d-%d", botKeyStorageVersion, teamID, uv.Uid,
		uv.EldestSeqno, app, generation)
	return key, nil
}

func (k *BotKeyer) dbKey(cacheKey string) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBTeambotKey,
		Key: cacheKey,
	}
}

func (k *BotKeyer) DeleteTeambotKeyForTest(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("botKeyer#DeleteTeambotKeyForTest: teamID:%v, app:%v, generation:%v",
		teamID, app, generation), func() error { return err })()

	lock := k.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), k.lockKey(teamID))
	defer lock.Release(mctx.Ctx())

	boxKey, err := k.cacheKey(mctx, teamID, app, generation)
	if err != nil {
		return err
	}
	k.lru.Remove(boxKey)

	dbKey := k.dbKey(boxKey)
	err = k.edb.Delete(mctx.Ctx(), dbKey)
	return err
}

func (k *BotKeyer) get(mctx libkb.MetaContext, teamID keybase1.TeamID, app keybase1.TeamApplication,
	generation keybase1.TeambotKeyGeneration) (key keybase1.TeambotKey, wrongKID bool, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("botKeyer#get: teamID:%v, app:%v, generation:%v, ", teamID, app, generation),
		func() error { return err })()

	key, found, err := k.getFromStorage(mctx, teamID, app, generation)
	if err != nil {
		return key, false, err
	} else if found {
		return key, false, nil
	}

	return k.fetchAndStore(mctx, teamID, app, generation)
}

func (k *BotKeyer) getFromStorage(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (key keybase1.TeambotKey, found bool, err error) {
	boxKey, err := k.cacheKey(mctx, teamID, app, generation)
	if err != nil {
		return key, false, err
	}

	res, found := k.lru.Get(boxKey)
	if found {
		key, ok := res.(keybase1.TeambotKey)
		if !ok {
			return key, false, fmt.Errorf("unable to load teambotkey from cache found %T, expected %T", res, keybase1.TeambotKey{})
		}
		return key, true, nil
	}

	dbKey := k.dbKey(boxKey)
	found, err = k.edb.Get(mctx.Ctx(), dbKey, &key)
	if err != nil {
		mctx.Debug("Unable to fetch from disk err: %v", err)
		return keybase1.TeambotKey{}, false, nil
	}
	if !found {
		return keybase1.TeambotKey{}, false, nil
	}

	// add to in-mem cache
	k.lru.Add(boxKey, key)
	return key, true, nil
}

func (k *BotKeyer) put(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration, key keybase1.TeambotKey) error {

	boxKey, err := k.cacheKey(mctx, teamID, app, generation)
	if err != nil {
		return err
	}
	dbKey := k.dbKey(boxKey)
	if err = k.edb.Put(mctx.Ctx(), dbKey, key); err != nil {
		return err
	}
	k.lru.Add(boxKey, key)
	return nil
}

func (k *BotKeyer) fetchAndStore(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (key keybase1.TeambotKey, wrongKID bool, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("BotKeyer#fetchAndStore: teamID:%v, app: %v, generation:%v", teamID, app, generation), func() error { return err })()

	boxed, wrongKID, err := k.fetch(mctx, teamID, app, generation)
	if err != nil {
		return key, false, err
	}
	key, err = k.unbox(mctx, boxed)
	if err != nil {
		return key, false, err
	}

	err = k.put(mctx, teamID, app, generation, key)
	return key, wrongKID, err
}

// unbox decrypts the TeambotKey for the given PUK rengeration
func (k *BotKeyer) unbox(mctx libkb.MetaContext, boxed keybase1.TeambotKeyBoxed) (
	key keybase1.TeambotKey, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("BotKeyer#unbox: generation: %v",
		boxed.Metadata.Generation), func() error { return err })()

	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return key, err
	}
	encKey, err := pukring.GetEncryptionKeyByGenerationOrSync(mctx, boxed.Metadata.PukGeneration)
	if err != nil {
		return key, err
	}

	msg, _, err := encKey.DecryptFromString(boxed.Box)
	if err != nil {
		return key, err
	}

	seed, err := newTeambotSeedFromBytes(msg)
	if err != nil {
		return key, err
	}

	keypair := deriveTeambotDHKey(seed)
	if !keypair.GetKID().Equal(boxed.Metadata.Kid) {
		return key, fmt.Errorf("Failed to verify server given seed against signed KID %s",
			boxed.Metadata.Kid)
	}

	return keybase1.TeambotKey{
		Seed:     seed,
		Metadata: boxed.Metadata,
	}, nil
}

type TeambotKeyBoxedResponse struct {
	Result *struct {
		Box string `json:"box"`
		Sig string `json:"sig"`
	} `json:"result"`
}

func (k *BotKeyer) fetch(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (boxed keybase1.TeambotKeyBoxed, wrongKID bool, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "teambot/box",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"application":  libkb.I{Val: int(app)},
			"generation":   libkb.U{Val: uint64(generation)},
			"is_ephemeral": libkb.B{Val: false},
		},
	}

	var resp TeambotKeyBoxedResponse
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		return boxed, false, err
	}

	if err = res.Body.UnmarshalAgain(&resp); err != nil {
		return boxed, false, err
	}

	if resp.Result == nil {
		err = newTeambotTransientKeyError(fmt.Errorf("missing box"), generation)
		return boxed, false, err
	}

	// It's possible that this key was signed with a PTK that is not our latest
	// and greatest. We allow this when we are using this key for *decryption*.
	// When getting a key for *encryption* callers are responsible for
	// verifying the signature is signed by the latest PTK or requesting a new
	// key. This logic currently lives in
	// teambot/bot_keyer.go#getTeambotKeyLocked
	metadata, wrongKID, err := verifyTeambotKeySigWithLatestPTK(mctx, teamID, resp.Result.Sig)
	switch {
	case wrongKID:
		// charge forward, caller handles wrongKID
		mctx.Debug("signed with wrongKID, bubbling up to caller")
	case err != nil:
		return boxed, false, err
	case metadata == nil: // shouldn't happen
		return boxed, false, fmt.Errorf("unable to fetch valid teambotKeyMetadata")
	}

	if generation != metadata.Generation {
		// sanity check that we got the right generation
		return boxed, false, fmt.Errorf("generation mismatch, expected:%d vs actual:%d",
			generation, metadata.Generation)
	}
	return keybase1.TeambotKeyBoxed{
		Box:      resp.Result.Box,
		Metadata: *metadata,
	}, wrongKID, nil
}

type TeambotKeyResponse struct {
	Result *struct {
		Sig string `json:"sig"`
	} `json:"result"`
}

// GetLatestTeambotKey finds the latest TeambotKey for *encryption*. Since bots
// depend on team members to derive a key for them, if the key is signed by an
// old PTK we allow it to be used for a short window before permanently
// failing, while we ask politely for a new key. If we don't have access to the
// latest generation we fall back to the first key we do as long as it's within
// the signing window.
func (k *BotKeyer) GetLatestTeambotKey(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication) (key keybase1.TeambotKey, err error) {
	mctx = mctx.WithLogTag("GLTBK")
	defer mctx.TraceTimed(fmt.Sprintf("BotKeyer#GetLatestTeambotKey teamID: %v, app %v",
		teamID, app), func() error { return err })()

	lock := k.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), k.lockKey(teamID))
	defer lock.Release(mctx.Ctx())

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return key, err
	}
	gen := keybase1.TeambotKeyGeneration(team.Generation())
	// If we need to use an older generation, force the wrongKID checks to
	// happen so we don't use it for too long
	forceWrongKID := false
	for i := gen; i > 0; i-- {
		if i < gen {
			forceWrongKID = true
		}
		key, err = k.getTeambotKeyLocked(mctx, teamID, i, app, forceWrongKID)
		switch err.(type) {
		case nil:
			return key, nil
		case TeambotTransientKeyError:
			// Ping team members to generate the key for us
			if err2 := NotifyTeambotKeyNeeded(mctx, teamID, app, i); err2 != nil {
				mctx.Debug("BotKeyer#GetLatestTeambotKey: Unable to NotifyTeambotKeyNeeded %v", err2)
			}
			mctx.Debug("BotKeyer#GetLatestTeambotKey Unable get team key at generation %d, retrying with previous generation. %v",
				i, err)
		default:
			return key, err
		}
	}
	return key, err
}

func (k *BotKeyer) getTeambotKeyLocked(mctx libkb.MetaContext, teamID keybase1.TeamID,
	generation keybase1.TeambotKeyGeneration, app keybase1.TeamApplication, forceWrongKID bool) (key keybase1.TeambotKey, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("BotKeyer#getTeambotKeyLocked teamID: %v, app %v, generation %d",
		teamID, app, generation), func() error { return err })()

	key, wrongKID, err := k.get(mctx, teamID, app, generation)
	if wrongKID || forceWrongKID {
		now := keybase1.ToTime(k.clock.Now())
		permitted, ctime, err := TeambotKeyWrongKIDPermitted(mctx, teamID,
			mctx.G().Env.GetUID(), key.Metadata.Application, key.Metadata.Generation, now)
		if err != nil {
			return key, err
		}
		mctx.Debug("getTeambotKey: wrongKID set, permitted: %v, ctime: %v",
			permitted, ctime)
		if !permitted {
			err = fmt.Errorf("Wrong KID, first seen at %v, now %v", ctime.Time(), now.Time())
			return key, newTeambotPermanentKeyError(err, key.Metadata.Generation)
		}
	}
	return key, err
}

// GetTeambotKeyAtGeneration finds the TeambotKey at the specified generation.
// This is used for *decryption* since we allow a key to be signed by an old
// PTK. For *encryption* keys, see GetLatestTeambotKey.
func (k *BotKeyer) GetTeambotKeyAtGeneration(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (key keybase1.TeambotKey, err error) {
	mctx = mctx.WithLogTag("GTBK")
	defer mctx.TraceTimed(fmt.Sprintf("BotKeyer#GetTeambotKeyAtGeneration teamID: %v, app: %v, generation: %d",
		teamID, app, generation), func() error { return err })()

	lock := k.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), k.lockKey(teamID))
	defer lock.Release(mctx.Ctx())

	key, _, err = k.get(mctx, teamID, app, generation)
	if err != nil {
		if _, ok := err.(TeambotTransientKeyError); ok {
			// Ping team members to generate the key for us
			if err2 := NotifyTeambotKeyNeeded(mctx, teamID, app, generation); err2 != nil {
				mctx.Debug("Unable to NotifyTeambotKeyNeeded %v", err2)
			}
		}
		return key, err
	}
	return key, nil
}

func (k *BotKeyer) OnLogout(mctx libkb.MetaContext) error {
	k.lru.Purge()
	return nil
}

func (k *BotKeyer) OnDbNuke(mctx libkb.MetaContext) error {
	k.lru.Purge()
	return nil
}
