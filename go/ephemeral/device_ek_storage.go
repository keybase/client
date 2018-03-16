package ephemeral

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/keybase/client/go/erasablekv"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const deviceEKPrefix = "device-ephemeral-key"
const deviceEKSubDir = "device-eks"

type DeviceEKMap map[keybase1.EkGeneration]keybase1.DeviceEk

type DeviceEKStorage struct {
	libkb.Contextified
	sync.Mutex
	storage   erasablekv.ErasableKVStore
	cache     DeviceEKMap
	keyPrefix string
	indexed   bool
}

func NewDeviceEKStorage(g *libkb.GlobalContext) *DeviceEKStorage {
	keyPrefix := fmt.Sprintf("%s-%s-", deviceEKPrefix, g.Env.GetUsername())
	return &DeviceEKStorage{
		Contextified: libkb.NewContextified(g),
		storage:      erasablekv.NewFileErasableKVStore(g, deviceEKSubDir),
		cache:        make(DeviceEKMap),
		keyPrefix:    keyPrefix,
	}
}

func (s *DeviceEKStorage) key(generation keybase1.EkGeneration) string {
	return fmt.Sprintf("%s%d.ek", s.keyPrefix, generation)
}

func (s *DeviceEKStorage) keyToGeneration(key string) (generation keybase1.EkGeneration, err error) {
	if !strings.HasPrefix(key, s.keyPrefix) {
		return generation, fmt.Errorf("Invalid key %s, missing key prefix", key)
	}
	key = strings.TrimSuffix(key, filepath.Ext(key))
	parts := strings.Split(key, s.keyPrefix)
	// We can expect two elements in `parts` here since we check
	// strings.HasPrefix above.
	g, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		return generation, err
	}
	return keybase1.EkGeneration(g), nil
}

func (s *DeviceEKStorage) Put(ctx context.Context, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) (err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#Put", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	key := s.key(generation)
	err = s.storage.Put(ctx, key, deviceEK)
	if err != nil {
		return err
	}

	// cache the result
	s.cache[generation] = deviceEK
	return nil
}

func (s *DeviceEKStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#Get", func() error { return err })()
	s.Lock()
	defer s.Unlock()
	return s.get(ctx, generation)
}

func (s *DeviceEKStorage) get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	deviceEK, ok := s.cache[generation]
	if ok {
		return deviceEK, nil
	}

	key := s.key(generation)
	data, err := s.storage.Get(ctx, key)
	if err != nil {
		return deviceEK, err
	}

	deviceEK, ok = data.(keybase1.DeviceEk)
	if !ok {
		return deviceEK, fmt.Errorf("Unable to cast data to deviceEK")
	}

	// cache the result
	s.cache[generation] = deviceEK
	return deviceEK, nil
}

func (s *DeviceEKStorage) Delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#Delete", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	// clear the cache
	delete(s.cache, generation)
	key := s.key(generation)
	return s.storage.Erase(ctx, key)
}

func (s *DeviceEKStorage) getCache(ctx context.Context) (deviceEKs DeviceEKMap, err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#getCache", func() error { return err })()
	if !s.indexed {
		keys, err := s.storage.AllKeys(ctx)
		if err != nil {
			return deviceEKs, err
		}
		for _, key := range keys {
			generation, err := s.keyToGeneration(key)
			if err != nil {
				return deviceEKs, err
			}
			deviceEK, err := s.get(ctx, generation)
			if err != nil {
				return deviceEKs, err
			}
			s.cache[generation] = deviceEK
		}
		s.indexed = true
	}
	return s.cache, nil
}

// Used for testing
func (s *DeviceEKStorage) ClearCache() {
	s.Lock()
	defer s.Unlock()
	s.cache = make(DeviceEKMap)
	s.indexed = false
}

func (s *DeviceEKStorage) GetAll(ctx context.Context) (deviceEKs DeviceEKMap, err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#GetAll", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	return s.getCache(ctx)
}

func (s *DeviceEKStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#MaxGeneration", func() error { return err })()
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
