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
func (s *Storage) Get(ctx context.Context, teamID keybase1.TeamID) *keybase1.TeamData {
	s.Lock()
	defer s.Unlock()

	item := s.mem.Get(ctx, teamID)
	if item != nil {
		// Mem hit
		return item
	}

	res, found, err := s.disk.Get(ctx, teamID)
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
const diskStorageVersion = 1

type DiskStorageItem struct {
	Version int                `codec:"V"`
	State   *keybase1.TeamData `codec:"S"`
}

func NewDiskStorage(g *libkb.GlobalContext) *DiskStorage {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return getLocalStorageSecretBoxKey(ctx, g)
	}
	return &DiskStorage{
		Contextified: libkb.NewContextified(g),
		encryptedDB:  encrypteddb.New(g, g.LocalDb, keyFn),
	}
}

func (s *DiskStorage) Put(ctx context.Context, state *keybase1.TeamData) error {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, state.Chain.Id)
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
func (s *DiskStorage) Get(ctx context.Context, teamID keybase1.TeamID) (res *keybase1.TeamData, found bool, err error) {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID)
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

	return item.State, true, nil
}

func (s *DiskStorage) dbKey(ctx context.Context, teamID keybase1.TeamID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInbox,
		Key: fmt.Sprintf("tid:%s", teamID),
	}
}

// --------------------------------------------------

const MemCacheLRUSize = 50

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
	s.lru.Add(state.Chain.Id, state)
}

// Can return nil.
func (s *MemoryStorage) Get(ctx context.Context, teamID keybase1.TeamID) *keybase1.TeamData {
	untyped, ok := s.lru.Get(teamID)
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

func (s *MemoryStorage) onLogout() {
	s.lru.Purge()
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
