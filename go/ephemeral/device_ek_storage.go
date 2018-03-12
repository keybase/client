package ephemeral

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const DeviceEKPrefix EKPrefix = "device-ek"

type DeviceEKStorage struct {
	sync.Mutex
	storage  *Storage
	toc      map[keybase1.EkGeneration]bool
	initOnce *sync.Once
}

func NewDeviceEKStorage(g *libkb.GlobalContext) *DeviceEKStorage {
	return &DeviceEKStorage{
		storage:  NewStorage(g),
		toc:      make(map[keybase1.EkGeneration]bool),
		initOnce: new(sync.Once),
	}
}

func (s *DeviceEKStorage) init(ctx context.Context) {
	s.initOnce.Do(func() {
		untyped := s.storage.Get(ctx, s.tocKey())
		if untyped != nil {
			toc, ok := untyped.(map[keybase1.EkGeneration]bool)
			if ok {
				s.toc = toc
			}
		}
	})
}

func (s *DeviceEKStorage) tocKey() string {
	return fmt.Sprintf("%s-all", DeviceEKPrefix)
}

func (s *DeviceEKStorage) key(generation keybase1.EkGeneration) string {
	return fmt.Sprintf("%s-%s", DeviceEKPrefix, generation)
}

func (s *DeviceEKStorage) Put(ctx context.Context, generation keybase1.EkGeneration, deviceEK keybase1.DeviceEk) (err error) {
	s.Lock()
	defer s.Unlock()

	s.init(ctx)
	key := s.key(generation)
	err = s.storage.Put(ctx, key, deviceEK)
	if err != nil {
		return err
	}
	s.toc[generation] = true
	s.storage.Put(ctx, s.tocKey(), s.toc)
	return nil
}

func (s *DeviceEKStorage) delete(ctx context.Context, generation keybase1.EkGeneration) (err error) {
	// This method is private and is called by the DeleteExpired public method
	// TODO implement DeleteExpired
	s.Lock()
	defer s.Unlock()
	s.init(ctx)

	key := s.key(generation)
	err = s.storage.Delete(ctx, key)
	if err != nil {
		return err
	}
	delete(s.toc, generation)
	s.storage.Put(ctx, s.tocKey(), s.toc)
	return nil
}

func (s *DeviceEKStorage) Get(ctx context.Context, generation keybase1.EkGeneration) (deviceEK keybase1.DeviceEk, err error) {
	key := s.key(generation)
	untyped := s.storage.Get(ctx, key)
	if untyped == nil {
		return deviceEK, fmt.Errorf("DeviceEK not found %v", generation)
	}
	deviceEK, ok := untyped.(keybase1.DeviceEk)
	if ok {
		return deviceEK, nil
	}
	return deviceEK, fmt.Errorf("Invalid type for DeviceEK")
}

func (s *DeviceEKStorage) GetAll(ctx context.Context) (deviceEKs map[keybase1.EkGeneration]keybase1.DeviceEk, err error) {
	s.Lock()
	defer s.Unlock()
	s.init(ctx)

	deviceEKs = make(map[keybase1.EkGeneration]keybase1.DeviceEk)
	for generation, _ := range s.toc {
		deviceEK, err := s.Get(ctx, generation)
		if err != nil {
			return deviceEKs, err
		}
		deviceEKs[generation] = deviceEK
	}
	return deviceEKs, nil
}

func (s *DeviceEKStorage) GetMaxGeneration() (maxGeneration keybase1.EkGeneration, err error) {
	for generation, _ := range s.toc {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}
