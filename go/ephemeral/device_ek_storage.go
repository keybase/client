package ephemeral

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const deviceEKPrefix = "device-eks/device-ephemeral-key"

type DeviceEKStorage struct {
	libkb.Contextified
	sync.Mutex
	indexOnce *sync.Once
	storage   ErasableKVStore
	cache     map[keybase1.EkGeneration]keybase1.DeviceEk
	keyPrefix string
}

func NewDeviceEKStorage(g *libkb.GlobalContext) *DeviceEKStorage {
	keyPrefix := fmt.Sprintf("%s-%s", deviceEKPrefix, g.Env.GetUsername().String())
	return &DeviceEKStorage{
		Contextified: libkb.NewContextified(g),
		storage:      NewFileErasableKVStore(g),
		cache:        make(map[keybase1.EkGeneration]keybase1.DeviceEk),
		indexOnce:    new(sync.Once),
		keyPrefix:    keyPrefix,
	}
}

func (s *DeviceEKStorage) key(generation keybase1.EkGeneration) string {
	return fmt.Sprintf("%s-%d.ek", s.keyPrefix, generation)
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

func (s *DeviceEKStorage) index(ctx context.Context) (err error) {
	s.indexOnce.Do(func() {
		defer s.G().CTrace(ctx, "DeviceEKStorage#indexInner", func() error { return err })()
		keys, err := s.storage.AllKeys(ctx)
		if err != nil {
			return
		}
		for _, key := range keys {
			key = strings.TrimSuffix(key, filepath.Ext(key))
			if strings.HasPrefix(key, deviceEKPrefix) {
				parts := strings.Split(key, deviceEKPrefix)
				g, err := strconv.ParseUint(parts[1], 10, 64)
				if err != nil {
					return
				}
				generation := keybase1.EkGeneration(g)
				deviceEK, err := s.get(ctx, generation)
				if err != nil {
					return
				}
				s.cache[generation] = deviceEK
			}
		}
	})
	return err
}

// Used for testing
func (s *DeviceEKStorage) ClearCache() {
	s.cache = make(map[keybase1.EkGeneration]keybase1.DeviceEk)
}

func (s *DeviceEKStorage) GetAll(ctx context.Context) (deviceEKs map[keybase1.EkGeneration]keybase1.DeviceEk, err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#GetAll", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	err = s.index(ctx)
	return s.cache, err
}

func (s *DeviceEKStorage) MaxGeneration(ctx context.Context) (maxGeneration keybase1.EkGeneration, err error) {
	defer s.G().CTrace(ctx, "DeviceEKStorage#MaxGeneration", func() error { return err })()
	s.Lock()
	defer s.Unlock()

	err = s.index(ctx)
	if err != nil {
		return maxGeneration, err
	}
	for generation := range s.cache {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}
