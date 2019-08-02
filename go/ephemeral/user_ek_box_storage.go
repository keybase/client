package ephemeral

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

const userEKBoxStorageDBVersion = 4

type userEKBoxCacheItem struct {
	UserEKBoxed keybase1.UserEkBoxed
	Err         *EphemeralKeyError
}

func newUserEKBoxCacheItem(userEKBoxed keybase1.UserEkBoxed, err error) userEKBoxCacheItem {
	var ekErr *EphemeralKeyError
	if e, ok := err.(EphemeralKeyError); ok {
		ekErr = &e
	}
	return userEKBoxCacheItem{
		UserEKBoxed: userEKBoxed,
		Err:         ekErr,
	}
}

func (c userEKBoxCacheItem) HasError() bool {
	return c.Err != nil
}

func (c userEKBoxCacheItem) Error() error {
	if c.HasError() {
		return *c.Err
	}
	return nil
}

type userEKBoxCache map[keybase1.EkGeneration]userEKBoxCacheItem
type UserEKBoxMap map[keybase1.EkGeneration]keybase1.UserEkBoxed
type UserEKUnboxedMap map[keybase1.EkGeneration]keybase1.UserEk

// We cache UserEKBoxes from the server in memory and a persist to a local
// KVStore.
type UserEKBoxStorage struct {
	sync.Mutex
	indexed bool
	cache   userEKBoxCache
}

func NewUserEKBoxStorage() *UserEKBoxStorage {
	return &UserEKBoxStorage{
		cache: make(userEKBoxCache),
	}
}

func (s *UserEKBoxStorage) dbKey(mctx libkb.MetaContext) (dbKey libkb.DbKey, err error) {
	uv, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return dbKey, err
	}
	key := fmt.Sprintf("userEphemeralKeyBox-%s-%s-%d", mctx.G().Env.GetUsername(), uv.EldestSeqno, userEKBoxStorageDBVersion)
	return libkb.DbKey{
		Typ: libkb.DBUserEKBox,
		Key: key,
	}, nil
}

func (s *UserEKBoxStorage) getCache(mctx libkb.MetaContext) (cache userEKBoxCache, err error) {
	if !s.indexed {
		key, err := s.dbKey(mctx)
		if err != nil {
			return s.cache, err
		}
		if _, err = mctx.G().GetKVStore().GetInto(&s.cache, key); err != nil {
			return s.cache, err
		}
		s.indexed = true
	}
	return s.cache, nil
}

func (s *UserEKBoxStorage) Get(mctx libkb.MetaContext, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (userEK keybase1.UserEk, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("UserEKBoxStorage#Get: generation:%v", generation), func() error { return err })()

	s.Lock()

	cache, err := s.getCache(mctx)
	if err != nil {
		s.Unlock()
		return userEK, err
	}

	// Try cache first
	cacheItem, ok := cache[generation]
	if !ok {
		// We don't have anything in our cache, fetch from the server
		s.Unlock() // release the lock while we fetch
		return s.fetchAndStore(mctx, generation)
	}

	defer s.Unlock() // release the lock after we unbox
	if cacheItem.HasError() {
		return userEK, cacheItem.Error()
	}
	userEK, err = s.unbox(mctx, generation, cacheItem.UserEKBoxed, contentCtime)
	if err != nil { // if we can no longer unbox this, store the error
		if perr := s.putLocked(mctx, generation, keybase1.UserEkBoxed{}, err); perr != nil {
			mctx.Debug("unable to store unboxing error %v", perr)
		}
	}
	return userEK, err
}

type UserEKBoxedResponse struct {
	Result *struct {
		Box                string                `json:"box"`
		DeviceEKGeneration keybase1.EkGeneration `json:"device_ek_generation"`
		Sig                string                `json:"sig"`
	} `json:"result"`
}

func (s *UserEKBoxStorage) fetchAndStore(mctx libkb.MetaContext, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("UserEKBoxStorage#fetchAndStore: generation: %v", generation), func() error { return err })()

	// cache unboxing/missing box errors so we don't continually try to fetch
	// something nonexistent.
	defer func() {
		if _, ok := err.(EphemeralKeyError); ok {
			s.Lock()
			defer s.Unlock()
			if perr := s.putLocked(mctx, generation, keybase1.UserEkBoxed{}, err); perr != nil {
				mctx.Debug("unable to store error %v", perr)
			}
		}
	}()

	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"generation":          libkb.U{Val: uint64(generation)},
			"recipient_device_id": libkb.S{Val: string(mctx.ActiveDevice().DeviceID())},
		},
	}

	var result UserEKBoxedResponse
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		err = errFromAppStatus(err)
		return userEK, err
	}

	if err = res.Body.UnmarshalAgain(&result); err != nil {
		return userEK, err
	}

	if result.Result == nil {
		err = newEKMissingBoxErr(mctx, UserEKKind, generation)
		return userEK, err
	}

	// Although we verify the signature is valid, it's possible that this key
	// was signed with a PUK that is not our latest and greatest. We allow this
	// when we are using this ek for *decryption*. When getting a key for
	// *encryption* callers are responsible for verifying the signature is
	// signed by the latest PUK or generating a new EK. This logic currently
	// lives in ephemeral/lib.go#KeygenIfNeeded (#newUserEKNeeded)
	_, userEKStatement, err := extractUserEKStatementFromSig(result.Result.Sig)
	if err != nil {
		return userEK, err
	} else if userEKStatement == nil { // shouldn't happen
		return userEK, fmt.Errorf("unable to fetch valid userEKStatement")
	}

	userEKMetadata := userEKStatement.CurrentUserEkMetadata
	if generation != userEKMetadata.Generation {
		// sanity check that we got the right generation
		return userEK, newEKCorruptedErr(mctx, UserEKKind, generation, userEKMetadata.Generation)
	}
	userEKBoxed := keybase1.UserEkBoxed{
		Box:                result.Result.Box,
		DeviceEkGeneration: result.Result.DeviceEKGeneration,
		Metadata:           userEKMetadata,
	}

	userEK, err = s.unbox(mctx, generation, userEKBoxed, nil)
	if err != nil {
		return userEK, err
	}

	seed := UserEKSeed(userEK.Seed)
	keypair := seed.DeriveDHKey()

	if !keypair.GetKID().Equal(userEKMetadata.Kid) {
		return userEK, fmt.Errorf("Failed to verify server given seed against signed KID %s", userEKMetadata.Kid)
	}

	// Store the boxed version, return the unboxed
	err = s.Put(mctx, generation, userEKBoxed)
	return userEK, err
}

func (s *UserEKBoxStorage) Put(mctx libkb.MetaContext, generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.putLocked(mctx, generation, userEKBoxed, nil /* ekErr */)
}

func (s *UserEKBoxStorage) putLocked(mctx libkb.MetaContext, generation keybase1.EkGeneration,
	userEKBoxed keybase1.UserEkBoxed, ekErr error) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("UserEKBoxStorage#putLocked: generation:%v", generation), func() error { return err })()

	// sanity check that we got the right generation
	if userEKBoxed.Metadata.Generation != generation && ekErr == nil {
		return newEKCorruptedErr(mctx, UserEKKind, generation, userEKBoxed.Metadata.Generation)
	}

	key, err := s.dbKey(mctx)
	if err != nil {
		return err
	}
	cache, err := s.getCache(mctx)
	if err != nil {
		return err
	}
	cache[generation] = newUserEKBoxCacheItem(userEKBoxed, ekErr)
	return mctx.G().GetKVStore().PutObj(key, nil, cache)
}

func (s *UserEKBoxStorage) unbox(mctx libkb.MetaContext, userEKGeneration keybase1.EkGeneration,
	userEKBoxed keybase1.UserEkBoxed, contentCtime *gregor1.Time) (userEK keybase1.UserEk, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("UserEKBoxStorage#unbox: generation:%v", userEKGeneration), func() error { return err })()

	deviceEKStorage := mctx.G().GetDeviceEKStorage()
	deviceEK, err := deviceEKStorage.Get(mctx, userEKBoxed.DeviceEkGeneration)
	if err != nil {
		mctx.Debug("unable to get from deviceEKStorage %v", err)
		if _, ok := err.(libkb.UnboxError); ok {
			return userEK, newEKUnboxErr(mctx, UserEKKind, userEKGeneration, DeviceEKKind,
				userEKBoxed.DeviceEkGeneration, contentCtime)
		}
		return userEK, err
	}

	deviceSeed := DeviceEKSeed(deviceEK.Seed)
	deviceKeypair := deviceSeed.DeriveDHKey()

	msg, _, err := deviceKeypair.DecryptFromString(userEKBoxed.Box)
	if err != nil {
		mctx.Debug("unable to decrypt userEKBoxed %v", err)
		return userEK, newEKUnboxErr(mctx, UserEKKind, userEKGeneration, DeviceEKKind,
			userEKBoxed.DeviceEkGeneration, contentCtime)
	}

	seed, err := newUserEKSeedFromBytes(msg)
	if err != nil {
		return userEK, err
	}

	return keybase1.UserEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: userEKBoxed.Metadata,
	}, nil
}

func (s *UserEKBoxStorage) Delete(mctx libkb.MetaContext, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.deleteMany(mctx, []keybase1.EkGeneration{generation})
}

func (s *UserEKBoxStorage) deleteMany(mctx libkb.MetaContext, generations []keybase1.EkGeneration) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("UserEKBoxStorage#deleteMany: generations:%v", generations), func() error { return err })()

	cache, err := s.getCache(mctx)
	if err != nil {
		return err
	}
	for _, generation := range generations {
		delete(cache, generation)
	}
	key, err := s.dbKey(mctx)
	if err != nil {
		return err
	}
	return mctx.G().GetKVStore().PutObj(key, nil, cache)
}

func (s *UserEKBoxStorage) GetAll(mctx libkb.MetaContext) (userEKs UserEKUnboxedMap, err error) {
	defer mctx.TraceTimed("UserEKBoxStorage#GetAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()
	cache, err := s.getCache(mctx)
	if err != nil {
		return userEKs, err
	}

	userEKs = make(UserEKUnboxedMap)
	for generation, cacheItem := range cache {
		if cacheItem.HasError() {
			continue
		}
		userEK, err := s.unbox(mctx, generation, cacheItem.UserEKBoxed, nil)
		if err != nil {
			return userEKs, err
		}
		userEKs[generation] = userEK
	}
	return userEKs, err
}

func (s *UserEKBoxStorage) ClearCache() {
	s.Lock()
	defer s.Unlock()
	s.cache = make(userEKBoxCache)
	s.indexed = false
}

func (s *UserEKBoxStorage) MaxGeneration(mctx libkb.MetaContext, includeErrs bool) (maxGeneration keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed("UserEKBoxStorage#MaxGeneration", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	maxGeneration = -1
	cache, err := s.getCache(mctx)
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

func (s *UserEKBoxStorage) DeleteExpired(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed("DeviceEKStorage#DeleteExpired", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(mctx)
	if err != nil {
		return nil, err
	}

	keyMap := make(keyExpiryMap)
	// We delete expired and invalid cache entries but only return the expired.
	toDelete := []keybase1.EkGeneration{}
	for generation, cacheItem := range cache {
		// purge any cached errors here so they don't stick around forever.
		if cacheItem.HasError() {
			toDelete = append(toDelete, generation)
		} else {
			keyMap[generation] = cacheItem.UserEKBoxed.Metadata.Ctime
		}
	}
	now := keybase1.TimeFromSeconds(merkleRoot.Ctime()).Time()
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	toDelete = append(toDelete, expired...)
	return expired, s.deleteMany(mctx, toDelete)
}

// getExpiredGenerations calculates which keys have expired and are safe to
// delete.  Keys normally expire after `libkb.MaxEphemeralContentLifetime`
// unless there has been a gap in their generation. If there has been a gap of
// more than a day (the normal generation time), a key can be re-used for up to
// `libkb.MaxEphemeralKeyStaleness` until it is considered expired. To
// determine expiration, we look at all of the current keys and account for any
// gaps since we don't want to expire a key if it is still used to encrypt a
// different key or ephemeral content.
func (s *UserEKBoxStorage) getExpiredGenerations(mctx libkb.MetaContext, keyMap keyExpiryMap, now time.Time) (expired []keybase1.EkGeneration) {
	// Sort the generations we have so we can walk through them in order.
	var keys []keybase1.EkGeneration
	for k := range keyMap {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	for i, generation := range keys {
		keyCtime := keyMap[generation].Time()
		expiryOffset := libkb.MaxEphemeralKeyStaleness
		if i < len(keys)-1 {
			expiryOffset = keyMap[keys[i+1]].Time().Sub(keyCtime)
			// Offset can be max libkb.MaxEphemeralKeyStaleness
			if expiryOffset > libkb.MaxEphemeralKeyStaleness {
				expiryOffset = libkb.MaxEphemeralKeyStaleness
			}
		}
		if now.Sub(keyCtime) >= (libkb.MinEphemeralKeyLifetime + expiryOffset) {
			mctx.Debug("getExpiredGenerations: expired generation:%v, now: %v, keyCtime:%v, expiryOffset:%v, keyMap: %v, i:%v, %v, %v",
				generation, now, keyCtime, expiryOffset, keyMap, i, now.Sub(keyCtime), (libkb.MinEphemeralKeyLifetime + expiryOffset))
			expired = append(expired, generation)
		}
	}

	return expired
}
