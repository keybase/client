package ephemeral

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type UserEKBoxMap map[keybase1.EkGeneration]keybase1.UserEkBoxed
type UserEKUnboxedMap map[keybase1.EkGeneration]keybase1.UserEk

// We cache UserEKBoxes from the server in memory and a persist to a local
// KVStore.
type UserEKBoxStorage struct {
	libkb.Contextified
	sync.Mutex
	indexed bool
	cache   UserEKBoxMap
}

func NewUserEKBoxStorage(g *libkb.GlobalContext) *UserEKBoxStorage {
	return &UserEKBoxStorage{
		Contextified: libkb.NewContextified(g),
		cache:        make(UserEKBoxMap),
	}
}

func (s *UserEKBoxStorage) dbKey(ctx context.Context) (dbKey libkb.DbKey, err error) {
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return dbKey, err
	}
	key := fmt.Sprintf("userEphemeralKeyBox-%s-%s", s.G().Env.GetUsername(), uv.EldestSeqno)
	return libkb.DbKey{
		Typ: libkb.DBUserEKBox,
		Key: key,
	}, nil
}

func (s *UserEKBoxStorage) getCache(ctx context.Context) (cache UserEKBoxMap, err error) {
	defer s.G().CTraceTimed(ctx, "UserEKBoxStorage#getCache", func() error { return err })()
	if !s.indexed {

		key, err := s.dbKey(ctx)
		if err != nil {
			return s.cache, err
		}
		_, err = s.G().GetKVStore().GetInto(&s.cache, key)
		if err != nil {
			return s.cache, err
		}
		s.indexed = true
	}
	return s.cache, nil
}

func (s *UserEKBoxStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("UserEKBoxStorage#Get: generation:%v", generation), func() error { return err })()

	s.Lock()

	cache, err := s.getCache(ctx)
	if err != nil {
		s.Unlock()
		return userEK, err
	}

	// Try cache first
	userEKBoxed, ok := cache[generation]
	if ok {
		defer s.Unlock() // release the lock after we unbox
		return s.unbox(ctx, generation, userEKBoxed)
	}

	// We don't have anything in our cache, fetch from the server
	s.Unlock() // release the lock while we fetch
	return s.fetchAndStore(ctx, generation)
}

type UserEKBoxedResponse struct {
	Result *struct {
		Box                string                `json:"box"`
		DeviceEKGeneration keybase1.EkGeneration `json:"device_ek_generation"`
		Sig                string                `json:"sig"`
	} `json:"result"`
}

func (s *UserEKBoxStorage) fetchAndStore(ctx context.Context, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	m := libkb.NewMetaContext(ctx, s.G())
	defer m.CTraceTimed(fmt.Sprintf("UserEKBoxStorage#fetchAndStore: generation: %v", generation), func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"generation":          libkb.U{Val: uint64(generation)},
			"recipient_device_id": libkb.S{Val: string(s.G().Env.GetDeviceID())},
		},
	}

	var result UserEKBoxedResponse
	res, err := s.G().GetAPI().Get(m, apiArg)
	if err != nil {
		return userEK, err
	}

	err = res.Body.UnmarshalAgain(&result)
	if err != nil {
		return userEK, err
	}

	if result.Result == nil {
		return userEK, newEKMissingBoxErr(UserEKStr, generation)
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
	userEKBoxed := keybase1.UserEkBoxed{
		Box:                result.Result.Box,
		DeviceEkGeneration: result.Result.DeviceEKGeneration,
		Metadata:           userEKMetadata,
	}

	userEK, err = s.unbox(ctx, generation, userEKBoxed)
	if err != nil {
		return userEK, err
	}

	seed := UserEKSeed(userEK.Seed)
	keypair := seed.DeriveDHKey()

	if !keypair.GetKID().Equal(userEKMetadata.Kid) {
		return userEK, fmt.Errorf("Failed to verify server given seed against signed KID %s", userEKMetadata.Kid)
	}

	// Store the boxed version, return the unboxed
	err = s.Put(ctx, generation, userEKBoxed)
	return userEK, err
}

func (s *UserEKBoxStorage) Put(ctx context.Context, generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("UserEKBoxStorage#Put: generation:%v", generation), func() error { return err })()

	s.Lock()
	defer s.Unlock()

	key, err := s.dbKey(ctx)
	if err != nil {
		return err
	}
	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	cache[generation] = userEKBoxed
	err = s.G().GetKVStore().PutObj(key, nil, cache)
	if err != nil {
		return err
	}
	return nil
}

func (s *UserEKBoxStorage) unbox(ctx context.Context, userEKGeneration keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (userEK keybase1.UserEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("UserEKBoxStorage#unbox: generation:%v", userEKGeneration), func() error { return err })()

	deviceEKStorage := s.G().GetDeviceEKStorage()
	deviceEK, err := deviceEKStorage.Get(ctx, userEKBoxed.DeviceEkGeneration)
	if err != nil {
		s.G().Log.CDebugf(ctx, "%v", err)
		return userEK, newEKUnboxErr(UserEKStr, userEKGeneration, DeviceEKStr, userEKBoxed.DeviceEkGeneration)
	}

	deviceSeed := DeviceEKSeed(deviceEK.Seed)
	deviceKeypair := deviceSeed.DeriveDHKey()

	msg, _, err := deviceKeypair.DecryptFromString(userEKBoxed.Box)
	if err != nil {
		s.G().Log.CDebugf(ctx, "%v", err)
		return userEK, newEKUnboxErr(UserEKStr, userEKGeneration, DeviceEKStr, userEKBoxed.DeviceEkGeneration)
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

func (s *UserEKBoxStorage) Delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.deleteMany(ctx, []keybase1.EkGeneration{generation})
}

func (s *UserEKBoxStorage) deleteMany(ctx context.Context, generations []keybase1.EkGeneration) (err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("UserEKBoxStorage#deleteMany: generations:%v", generations), func() error { return err })()

	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	for _, generation := range generations {
		delete(cache, generation)
	}
	key, err := s.dbKey(ctx)
	if err != nil {
		return err
	}
	return s.G().GetKVStore().PutObj(key, nil, cache)
}

func (s *UserEKBoxStorage) GetAll(ctx context.Context) (userEKs UserEKUnboxedMap, err error) {
	defer s.G().CTraceTimed(ctx, "UserEKBoxStorage#GetAll", func() error { return err })()

	s.Lock()
	defer s.Unlock()
	cache, err := s.getCache(ctx)
	if err != nil {
		return userEKs, err
	}

	userEKs = make(UserEKUnboxedMap)
	for generation, userEKBoxed := range cache {
		userEK, err := s.unbox(ctx, generation, userEKBoxed)
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
	s.cache = make(UserEKBoxMap)
	s.indexed = false
}

func (s *UserEKBoxStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, "UserEKBoxStorage#MaxGeneration", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	maxGeneration = -1
	cache, err := s.getCache(ctx)
	if err != nil {
		return maxGeneration, err
	}

	for generation := range cache {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}

func (s *UserEKBoxStorage) DeleteExpired(ctx context.Context, merkleRoot libkb.MerkleRoot) (expired []keybase1.EkGeneration, err error) {
	defer s.G().CTraceTimed(ctx, "DeviceEKStorage#DeleteExpired", func() error { return err })()

	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(ctx)
	if err != nil {
		return nil, err
	}

	keyMap := make(keyExpiryMap)
	for generation, userEKBoxed := range cache {
		keyMap[generation] = userEKBoxed.Metadata.Ctime
	}

	expired = s.getExpiredGenerations(ctx, keyMap, keybase1.TimeFromSeconds(merkleRoot.Ctime()).Time())
	err = s.deleteMany(ctx, expired)
	return expired, err
}

// getExpiredGenerations calculates which keys have expired and are safe to
// delete.  Keys normally expire after `libkb.MaxEphemeralContentLifetime`
// unless there has been a gap in their generation. If there has been a gap of
// more than a day (the normal generation time), a key can be re-used for up to
// `libkb.MaxEphemeralKeyStaleness` until it is considered expired. To
// determine expiration, we look at all of the current keys and account for any
// gaps since we don't want to expire a key if it is still used to encrypt a
// different key or ephemeral content.
func (s *UserEKBoxStorage) getExpiredGenerations(ctx context.Context, keyMap keyExpiryMap, now time.Time) (expired []keybase1.EkGeneration) {
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
			s.G().Log.CDebugf(ctx, "getExpiredGenerations: expired generation:%v, now: %v, keyCtime:%v, expiryOffset:%v, keyMap: %v, i:%v, %v, %v",
				generation, now, keyCtime, expiryOffset, keyMap, i, now.Sub(keyCtime), (libkb.MinEphemeralKeyLifetime + expiryOffset))
			expired = append(expired, generation)
		}
	}

	return expired
}
