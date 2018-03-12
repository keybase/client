package ephemeral

import (
	"context"
	"fmt"
	"log"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type EKPrefix string

// Store EphemeralKeys's on memory and disk. Threadsafe.
type Storage struct {
	libkb.Contextified
	sync.Mutex
	mem  *MemoryStorage
	disk *DiskStorage
}

func NewStorage(g *libkb.GlobalContext) *Storage {
	return &Storage{
		Contextified: libkb.NewContextified(g),
		mem:          NewMemoryStorage(g),
		disk:         NewDiskStorage(g),
	}
}

func (s *Storage) Put(ctx context.Context, key string, data interface{}) (err error) {
	s.Lock()
	defer s.Unlock()

	s.mem.Put(ctx, key, data)

	return s.disk.Put(ctx, key, data)
}

// Can return nil.
func (s *Storage) Get(ctx context.Context, key string) interface{} {
	s.Lock()
	defer s.Unlock()

	item := s.mem.Get(ctx, key)
	if item != nil {
		// Mem hit
		return item
	}

	res, found, err := s.disk.Get(ctx, key)
	if found && err == nil {
		// Disk hit
		s.mem.Put(ctx, key, res)
		return res
	}
	if err != nil {
		s.G().Log.Debug("ephemeral.Storage#Get disk err: %v", err)
	}

	return nil
}

func (s *Storage) Delete(ctx context.Context, key string) error {
	s.Lock()
	defer s.Unlock()

	s.mem.Delete(ctx, key)
	return s.disk.Delete(ctx, key)
}

type DiskStorage struct {
	libkb.Contextified
	sync.Mutex
	encryptedDB *encrypteddb.EncryptedDB
}

func NewDiskStorage(g *libkb.GlobalContext) *DiskStorage {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return getLocalStorageSecretBoxKey(ctx, g)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalEKDb
	}
	return &DiskStorage{
		Contextified: libkb.NewContextified(g),
		encryptedDB:  encrypteddb.New(g, dbFn, keyFn),
	}
}

func (s *DiskStorage) Put(ctx context.Context, key string, data interface{}) error {
	s.Lock()
	defer s.Unlock()

	if !s.G().ActiveDevice.Valid() {
		s.G().Log.CDebugf(ctx, "skipping local storage since user is logged out")
		return nil
	}

	dbKey := s.dbKey(ctx, key)
	err := s.encryptedDB.Put(ctx, dbKey, data)
	if err != nil {
		return err
	}

	if err != nil {
		return err
	}

	return nil
}

// Res is valid if (found && err == nil)
func (s *DiskStorage) Get(ctx context.Context, key string) (res interface{}, found bool, err error) {
	s.Lock()
	defer s.Unlock()

	dbKey := s.dbKey(ctx, key)
	found, err = s.encryptedDB.Get(ctx, dbKey, &res)
	if (err != nil) || !found {
		return res, found, err
	}

	return res, true, nil
}

func (s *DiskStorage) Delete(ctx context.Context, key string) error {
	s.Lock()
	defer s.Unlock()

	dbKey := s.dbKey(ctx, key)
	return s.encryptedDB.Delete(ctx, dbKey)
}

func (s *DiskStorage) dbKey(ctx context.Context, key string) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBEphemeralKey,
		Key: key,
	}
}

// --------------------------------------------------

const MemCacheLRUSize = 200

// Store some DeviceEks's in memory. Threadsafe.
type MemoryStorage struct {
	libkb.Contextified
	lru *lru.Cache
}

func NewMemoryStorage(g *libkb.GlobalContext) *MemoryStorage {
	nlru, err := lru.New(MemCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &MemoryStorage{
		Contextified: libkb.NewContextified(g),
		lru:          nlru,
	}
}

func (s *MemoryStorage) Put(ctx context.Context, key string, data interface{}) {
	s.lru.Add(key, data)
}

// Can return nil.
func (s *MemoryStorage) Get(ctx context.Context, key string) interface{} {
	untyped, ok := s.lru.Get(key)
	if !ok {
		return nil
	}
	return untyped
}

func (s *MemoryStorage) Delete(ctx context.Context, key string) {
	s.lru.Remove(key)
}

func (s *MemoryStorage) Clear() {
	s.lru.Purge()
}

// --------------------------------------------------

func getLocalStorageSecretBoxKey(ctx context.Context, g *libkb.GlobalContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getLameSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt ephemeral key storage")
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonTeamsLocalStorage)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}

type LameSecretUI struct{}

func (d LameSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

var getLameSecretUI = func() libkb.SecretUI { return LameSecretUI{} }
