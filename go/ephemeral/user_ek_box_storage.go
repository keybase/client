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

func (s *UserEKBoxStorage) dbKey() libkb.DbKey {
	key := fmt.Sprintf("user-ek-box-%s", s.G().Env.GetUsername())
	return libkb.DbKey{
		Typ: libkb.DBUserEKBox,
		Key: key,
	}
}

func (s *UserEKBoxStorage) getCache(ctx context.Context) (cache UserEKBoxMap, err error) {
	if !s.indexed {
		defer s.G().CTrace(ctx, "UserEKBoxStorage#indexInner", func() error { return err })()
		key := s.dbKey()
		_, err = s.G().GetKVStore().GetInto(&s.cache, key)
		if err != nil {
			return s.cache, err
		}
		s.indexed = true
	}
	return s.cache, nil
}

func (s *UserEKBoxStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#Get", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	cache, err := s.getCache(ctx)
	if err != nil {
		return userEK, err
	}

	// Try cache first
	userEKBoxed, ok := cache[generation]
	if ok {
		return s.unbox(ctx, userEKBoxed)
	}

	// We don't have anything in our cache, fetch from the server
	return s.fetchAndPut(ctx, generation)
}

type UserEKBoxedResponse struct {
	Result struct {
		Box                string                `json:"box"`
		DeviceEKGeneration keybase1.EkGeneration `json:"device_ek_generation"`
		Sig                string                `json:"sig"`
	} `json:"result"`
}

func (s *UserEKBoxStorage) fetchAndPut(ctx context.Context, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#fetchAndPut", func() error { return err })()
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

	// Before we store anything, let's verify that the server returned
	// signature is valid and the KID it has signed matches the boxed seed.
	// Otherwise something's fishy..
	userEKMetadata, wrongKID, err := VerifySigWithLatestPUK(ctx, s.G(), result.Result.Sig)

	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		s.G().Log.CWarningf(ctx, "It looks like you revoked a device without generating new ephemeral keys. Are you running an old version?")
		return userEK, nil
	}
	if err != nil {
		return userEK, err
	}

	if userEKMetadata == nil { // shouldn't happen
		s.G().Log.CWarningf(ctx, "No error but got nil userEKMetadata")
		return userEK, err
	}

	userEKBoxed := keybase1.UserEkBoxed{
		Box:                result.Result.Box,
		DeviceEkGeneration: result.Result.DeviceEKGeneration,
		Metadata:           *userEKMetadata,
	}

	userEK, err = s.unbox(ctx, userEKBoxed)
	if err != nil {
		return userEK, err
	}

	seed := UserEKSeed(userEK.Seed)
	keypair, err := seed.DeriveDHKey()
	if err != nil {
		return userEK, err

	}

	if !keypair.GetKID().Equal(userEKMetadata.Kid) {
		return userEK, fmt.Errorf("Failed to verify server given seed against signed KID %s", userEKMetadata.Kid)
	}

	// Store the boxed version, return the unboxed
	err = s.put(ctx, generation, userEKBoxed)
	return userEK, err
}

func (s *UserEKBoxStorage) Put(ctx context.Context, generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.put(ctx, generation, userEKBoxed)
}

func (s *UserEKBoxStorage) put(ctx context.Context, generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#Put", func() error { return err })()

	key := s.dbKey()
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

func (s *UserEKBoxStorage) unbox(ctx context.Context, userEKBoxed keybase1.UserEkBoxed) (userEK keybase1.UserEk, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#unbox", func() error { return err })()
	deviceEKStorage := s.G().GetDeviceEKStorage()
	deviceEK, err := deviceEKStorage.Get(ctx, userEKBoxed.DeviceEkGeneration)
	if err != nil {
		return userEK, err
	}

	deviceSeed := DeviceEKSeed(deviceEK.Seed)
	deviceKeypair, err := deviceSeed.DeriveDHKey()
	if err != nil {
		return userEK, err
	}

	msg, _, err := deviceKeypair.DecryptFromString(userEKBoxed.Box)
	if err != nil {
		return userEK, err
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
	defer s.G().CTrace(ctx, "UserEKBoxStorage#Delete", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	cache, err := s.getCache(ctx)
	if err != nil {
		return err
	}
	delete(cache, generation)
	key := s.dbKey()
	return s.G().GetKVStore().PutObj(key, nil, cache)
}

func (s *UserEKBoxStorage) GetAll(ctx context.Context) (userEKs UserEKUnboxedMap, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#GetAll", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	cache, err := s.getCache(ctx)
	if err != nil {
		return userEKs, err
	}

	userEKs = make(UserEKUnboxedMap)
	for generation, userEKBoxed := range cache {
		userEK, err := s.unbox(ctx, userEKBoxed)
		if err != nil {
			return userEKs, err
		}
		userEKs[generation] = userEK
	}
	return userEKs, err
}

// Used for testing
func (s *UserEKBoxStorage) ClearCache() {
	s.Lock()
	defer s.Unlock()
	s.cache = make(UserEKBoxMap)
}

func (s *UserEKBoxStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#MaxGeneration", func() error { return err })()
	s.Lock()
	defer s.Unlock()
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
