package teams

import (
	"fmt"
	"log"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	context "golang.org/x/net/context"

	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Store TeamData's on memory and disk. Threadsafe.
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

func (s *Storage) Put(ctx context.Context, state *keybase1.TeamData) {
	s.Lock()
	defer s.Unlock()

	s.mem.Put(ctx, state)

	err := s.disk.Put(ctx, state)
	if err != nil {
		s.G().Log.CWarningf(ctx, "teams.Storage.Put err: %v", err)
	}
}

// Can return nil.
func (s *Storage) Get(ctx context.Context, teamID keybase1.TeamID, public bool) *keybase1.TeamData {
	s.Lock()
	defer s.Unlock()

	item := s.mem.Get(ctx, teamID, public)
	if item != nil {
		// Mem hit
		return item
	}

	res, found, err := s.disk.Get(ctx, teamID, public)
	if found && err == nil {
		// Disk hit
		s.mem.Put(ctx, res)
		return res
	}
	if err != nil {
		s.G().Log.Debug("teams.Storage#Get disk err: %v", err)
	}

	return nil
}

func (s *Storage) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	s.mem.Delete(ctx, teamID, public)
	return s.disk.Delete(ctx, teamID, public)
}

func (s *Storage) onLogout() {
	s.mem.onLogout()
}

// --------------------------------------------------

// Store TeamData's on disk. Threadsafe.
type DiskStorage struct {
	libkb.Contextified
	sync.Mutex
	encryptedDB *encrypteddb.EncryptedDB
}

// Increment to invalidate the disk cache.
const diskStorageVersion = 5

type DiskStorageItem struct {
	Version int                `codec:"V"`
	State   *keybase1.TeamData `codec:"S"`
}

func NewDiskStorage(g *libkb.GlobalContext) *DiskStorage {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return getLocalStorageSecretBoxKey(ctx, g)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &DiskStorage{
		Contextified: libkb.NewContextified(g),
		encryptedDB:  encrypteddb.New(g, dbFn, keyFn),
	}
}

func (s *DiskStorage) Put(ctx context.Context, state *keybase1.TeamData) error {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, state.Chain.Id, state.Chain.Public)
	item := DiskStorageItem{
		Version: diskStorageVersion,
		State:   state,
	}

	err := s.encryptedDB.Put(ctx, key, item)
	if err != nil {
		return err
	}
	return nil
}

// Res is valid if (found && err == nil)
func (s *DiskStorage) Get(ctx context.Context, teamID keybase1.TeamID, public bool) (res *keybase1.TeamData, found bool, err error) {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID, public)
	var item DiskStorageItem
	found, err = s.encryptedDB.Get(ctx, key, &item)
	if (err != nil) || !found {
		return res, found, err
	}

	if item.Version != diskStorageVersion {
		// Pretend it wasn't found.
		return res, false, nil
	}

	// Sanity check
	if len(item.State.Chain.Id) == 0 {
		return res, false, fmt.Errorf("decode from disk had empty team id")
	}
	if !item.State.Chain.Id.Eq(teamID) {
		return res, false, fmt.Errorf("decode from disk had wrong team id %v != %v", item.State.Chain.Id, teamID)
	}
	if item.State.Chain.Public != public {
		return res, false, fmt.Errorf("decode from disk had wrong publicness %v != %v (%v)", item.State.Chain.Public, public, teamID)
	}

	return item.State, true, nil
}

func (s *DiskStorage) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID, public)
	return s.encryptedDB.Delete(ctx, key)
}

func (s *DiskStorage) dbKey(ctx context.Context, teamID keybase1.TeamID, public bool) libkb.DbKey {
	key := fmt.Sprintf("tid:%s", teamID)
	if public {
		key = fmt.Sprintf("tid:%s|pub", teamID)
	}
	return libkb.DbKey{
		Typ: libkb.DBChatInbox,
		Key: key,
	}
}

// --------------------------------------------------

const MemCacheLRUSize = 200

// Store some TeamSigChainState's in memory. Threadsafe.
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

func (s *MemoryStorage) Put(ctx context.Context, state *keybase1.TeamData) {
	s.lru.Add(s.key(state.Chain.Id, state.Chain.Public), state)
}

// Can return nil.
func (s *MemoryStorage) Get(ctx context.Context, teamID keybase1.TeamID, public bool) *keybase1.TeamData {
	untyped, ok := s.lru.Get(s.key(teamID, public))
	if !ok {
		return nil
	}
	state, ok := untyped.(*keybase1.TeamData)
	if !ok {
		s.G().Log.Warning("Team MemoryStorage got bad type from lru: %T", untyped)
		return nil
	}
	return state
}

func (s *MemoryStorage) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) {
	s.lru.Remove(s.key(teamID, public))
}

func (s *MemoryStorage) onLogout() {
	s.lru.Purge()
}

func (s *MemoryStorage) key(teamID keybase1.TeamID, public bool) (key string) {
	key = fmt.Sprintf("tid:%s", teamID)
	if public {
		key = fmt.Sprintf("tid:%s|pub", teamID)
	}
	return key
}

// --------------------------------------------------

func getLocalStorageSecretBoxKey(ctx context.Context, g *libkb.GlobalContext) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getLameSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt teams storage")
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
