package ephemeral

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type UserEKBoxMap map[keybase1.EkGeneration]keybase1.UserEkBoxed
type UserEKMap map[keybase1.EkGeneration]keybase1.UserEk

// We cache UserEKBoxes from the server in memory and a persist to a local
// KVStore.
type UserEKBoxStorage struct {
	libkb.Contextified
	sync.Mutex
	indexOnce *sync.Once
	cache     UserEKBoxMap
}

func NewUserEKBoxStorage(g *libkb.GlobalContext) *UserEKBoxStorage {
	return &UserEKBoxStorage{
		Contextified: libkb.NewContextified(g),
		cache:        make(UserEKBoxMap),
		indexOnce:    new(sync.Once),
	}
}

func (s *UserEKBoxStorage) dbKey() libkb.DbKey {
	key := fmt.Sprintf("user-ek-box-%s", s.G().Env.GetUsername())
	return libkb.DbKey{
		Typ: libkb.DBUserEKBox,
		Key: key,
	}
}

func (s *UserEKBoxStorage) index(ctx context.Context) (err error) {
	s.indexOnce.Do(func() {
		defer s.G().CTrace(ctx, "UserEKBoxStorage#indexInner", func() error { return err })()
		key := s.dbKey()
		_, err = s.G().GetKVStore().GetInto(&s.cache, key)
		return
	})
	return err
}

func (s *UserEKBoxStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (userEK keybase1.UserEk, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#Get", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	err = s.index(ctx)
	if err != nil {
		return userEK, err
	}

	// Try cache first
	userEKBoxed, ok := s.cache[generation]
	if ok {
		return s.unbox(ctx, userEKBoxed)
	}

	// We don't have anything in our cache, fetch from the server
	return s.fetchAndPut(ctx, generation)
}

//// REMOVE AFTER REBASE
// TODO this is being implemented during userEKGeneration, swap this out once that is merged
type UserEKMetadata struct {
	Kid        keybase1.KID
	Generation keybase1.EkGeneration
	HashMeta   keybase1.HashMeta
}

func verifyUserEKSig(sig string) (m keybase1.UserEkMetadata, err error) {
	return m, err
}

//// REMOVE AFTER REBASE

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
	userEKMetadata, err := verifyUserEKSig(result.Result.Sig)
	if err != nil {
		return userEK, err
	}

	userEKBoxed := keybase1.UserEkBoxed{
		Box:                result.Result.Box,
		DeviceEkGeneration: result.Result.DeviceEKGeneration,
		Metadata:           userEKMetadata,
	}

	userEK, err = s.unbox(ctx, userEKBoxed)
	if err != nil {
		return userEK, err
	}

	// TODO Uncomment after rebase
	//keypair, err := UserEKSeed(userEK.Seed).DeriveDHKey()
	//if err != nil {
	//	return userEK, err

	//}

	//if !keypair.GetKID().Equal(userEKMetadata.Kid) {
	//	return userEK, fmt.Errorf("Failed to verify server given seed against signed KID %s", userEKMetadata.Kid)
	//}

	// Store the boxed version, return the unboxed
	err = s.put(generation, userEKBoxed)
	return userEK, err
}

func (s *UserEKBoxStorage) Put(ctx context.Context, generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#Put", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	return s.put(generation, userEKBoxed)
}

func (s *UserEKBoxStorage) put(generation keybase1.EkGeneration, userEKBoxed keybase1.UserEkBoxed) (err error) {
	key := s.dbKey()
	s.cache[generation] = userEKBoxed
	err = s.G().GetKVStore().PutObj(key, nil, s.cache)
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
	delete(s.cache, generation)
	key := s.dbKey()
	return s.G().GetKVStore().PutObj(key, nil, s.cache)
}

func (s *UserEKBoxStorage) GetAll(ctx context.Context) (userEKs UserEKMap, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#GetAll", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	err = s.index(ctx)
	if err != nil {
		return userEKs, err
	}

	userEKs = make(UserEKMap)
	for generation, userEKBoxed := range s.cache {
		userEK, err := s.unbox(ctx, userEKBoxed)
		if err != nil {
			return userEKs, err
		}
		userEKs[generation] = userEK
	}
	return userEKs, err
}

func (s *UserEKBoxStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTrace(ctx, "UserEKBoxStorage#MaxGeneration", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	err = s.index(ctx)
	if err != nil {
		return maxGeneration, err
	}

	for generation := range s.cache {
		if generation > maxGeneration {
			generation = maxGeneration
		}
	}
	return maxGeneration, nil
}
