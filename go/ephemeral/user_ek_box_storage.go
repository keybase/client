package ephemeral

import (
	"context"
	"fmt"
	"sync"

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
	uv, err := getCurrentUserUV(ctx, s.G())
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
	return s.fetchAndPut(ctx, generation)
}

type UserEKBoxedResponse struct {
	Result *struct {
		Box                string                `json:"box"`
		DeviceEKGeneration keybase1.EkGeneration `json:"device_ek_generation"`
		Sig                string                `json:"sig"`
	} `json:"result"`
}

func (s *UserEKBoxStorage) fetchAndPut(ctx context.Context, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("UserEKBoxStorage#fetchAndPut: generation: %v", generation), func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"generation":          libkb.U{Val: uint64(generation)},
			"recipient_device_id": libkb.S{Val: string(s.G().Env.GetDeviceID())},
		},
	}

	var result UserEKBoxedResponse
	res, err := s.G().GetAPI().Get(apiArg)
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

	// Before we store anything, let's verify that the server returned
	// signature is valid and the KID it has signed matches the boxed seed.
	// Otherwise something's fishy..
	userEKStatement, _, wrongKID, err := verifySigWithLatestPUK(ctx, s.G(), s.G().Env.GetUID(), result.Result.Sig)

	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		s.G().Log.CDebugf(ctx, "It looks like you revoked a device without generating new ephemeral keys. Are you running an old version?")
		return userEK, nil
	}
	if err != nil {
		return userEK, err
	}

	if userEKStatement == nil { // shouldn't happen
		s.G().Log.CDebugf(ctx, "No error but got nil userEKStatement")
		return userEK, err
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

	expired = getExpiredGenerations(keyMap, keybase1.TimeFromSeconds(merkleRoot.Ctime()))
	err = s.deleteMany(ctx, expired)
	return expired, err
}
