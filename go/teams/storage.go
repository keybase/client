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
	*storageGeneric
}

// Increment to invalidate the disk cache.
const diskStorageVersion = 10
const MemCacheLRUSize = 200

type DiskStorageItem struct {
	Version int                `codec:"V"`
	State   *keybase1.TeamData `codec:"S"`
}

var _ teamDataGeneric = (*keybase1.TeamData)(nil)
var _ diskItemGeneric = (*DiskStorageItem)(nil)

func (d *DiskStorageItem) version() int {
	return d.Version
}
func (d *DiskStorageItem) value() teamDataGeneric {
	return d.State
}
func (d *DiskStorageItem) setVersion(i int) {
	d.Version = i
}
func (d *DiskStorageItem) setValue(v teamDataGeneric) error {
	typed, ok := v.(*keybase1.TeamData)
	if !ok {
		return fmt.Errorf("teams.Storage#Put: Bad object for setValue; got type %T", v)
	}
	d.State = typed
	return nil
}

func NewStorage(g *libkb.GlobalContext) *Storage {
	s := newStorageGeneric(g, MemCacheLRUSize, diskStorageVersion, libkb.DBChatInbox, libkb.EncryptionReasonTeamsLocalStorage, func() diskItemGeneric { return &DiskStorageItem{} })
	return &Storage{s}
}

func (s *Storage) Put(ctx context.Context, state *keybase1.TeamData) {
	s.storageGeneric.put(ctx, state)
}

// Can return nil.
func (s *Storage) Get(ctx context.Context, teamID keybase1.TeamID, public bool) *keybase1.TeamData {
	vp := s.storageGeneric.get(ctx, teamID, public)
	if vp == nil {
		return nil
	}
	ret, ok := vp.(*keybase1.TeamData)
	if !ok {
		s.G().Log.CDebugf(ctx, "teams.Storage#Get cast error: %T is wrong type", vp)
	}
	return ret
}

//---------------------------

// Store TeamData's on memory and disk. Threadsafe.
type storageGeneric struct {
	libkb.Contextified
	sync.Mutex
	mem  *memoryStorageGeneric
	disk *diskStorageGeneric
}

func newStorageGeneric(g *libkb.GlobalContext, lruSize int, version int, dbObjTyp libkb.ObjType, reason libkb.EncryptionReason, gdi func() diskItemGeneric) *storageGeneric {
	return &storageGeneric{
		Contextified: libkb.NewContextified(g),
		mem:          newMemoryStorageGeneric(g, lruSize),
		disk:         newDiskStorageGeneric(g, version, dbObjTyp, reason, gdi),
	}
}

func (s *storageGeneric) put(ctx context.Context, state teamDataGeneric) {
	s.Lock()
	defer s.Unlock()

	s.mem.put(ctx, state)

	err := s.disk.put(ctx, state)
	if err != nil {
		s.G().Log.CWarningf(ctx, "teams.Storage.Put err: %v", err)
	}
}

// Can return nil.
func (s *storageGeneric) get(ctx context.Context, teamID keybase1.TeamID, public bool) teamDataGeneric {
	s.Lock()
	defer s.Unlock()

	item := s.mem.get(ctx, teamID, public)
	if item != nil {
		// Mem hit
		return item
	}

	res, found, err := s.disk.get(ctx, teamID, public)
	if found && err == nil {
		// Disk hit
		s.mem.put(ctx, res)
		return res
	}
	if err != nil {
		s.G().Log.CDebugf(ctx, "teams.Storage#Get disk err: %v", err)
	}

	return nil
}

func (s *storageGeneric) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	s.mem.delete(ctx, teamID, public)
	return s.disk.delete(ctx, teamID, public)
}

// Clear the in-memory storage.
func (s *storageGeneric) clearMem() {
	s.mem.clear()
}

// --------------------------------------------------

type teamDataGeneric interface {
	IsPublic() bool
	ID() keybase1.TeamID
}

type diskItemGeneric interface {
	version() int
	value() teamDataGeneric
	setVersion(i int)
	setValue(o teamDataGeneric) error
}

// Store TeamData's on disk. Threadsafe.
type diskStorageGeneric struct {
	libkb.Contextified
	sync.Mutex
	encryptedDB      *encrypteddb.EncryptedDB
	version          int
	dbObjTyp         libkb.ObjType
	getEmptyDiskItem func() diskItemGeneric
}

func newDiskStorageGeneric(g *libkb.GlobalContext, version int, dbObjTyp libkb.ObjType, reason libkb.EncryptionReason, gdi func() diskItemGeneric) *diskStorageGeneric {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return getLocalStorageSecretBoxKeyGeneric(ctx, g, reason)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &diskStorageGeneric{
		Contextified:     libkb.NewContextified(g),
		encryptedDB:      encrypteddb.New(g, dbFn, keyFn),
		version:          version,
		dbObjTyp:         dbObjTyp,
		getEmptyDiskItem: gdi,
	}
}

func (s *diskStorageGeneric) put(ctx context.Context, state teamDataGeneric) error {
	s.Lock()
	defer s.Unlock()

	if !s.G().ActiveDevice.Valid() && !state.IsPublic() {
		s.G().Log.CDebugf(ctx, "skipping team store since user is logged out")
		return nil
	}

	key := s.dbKey(ctx, state.ID(), state.IsPublic())
	item := s.getEmptyDiskItem()
	item.setVersion(s.version)
	err := item.setValue(state)
	if err != nil {
		return err
	}

	err = s.encryptedDB.Put(ctx, key, item)
	if err != nil {
		return err
	}
	return nil
}

// Res is valid if (found && err == nil)
func (s *diskStorageGeneric) get(ctx context.Context, teamID keybase1.TeamID, public bool) (teamDataGeneric, bool, error) {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID, public)
	item := s.getEmptyDiskItem()
	found, err := s.encryptedDB.Get(ctx, key, item)
	if (err != nil) || !found {
		return nil, found, err
	}

	if item.version() != s.version {
		// Pretend it wasn't found.
		return nil, false, nil
	}

	ret := item.value()

	// Sanity check
	if len(ret.ID()) == 0 {
		return nil, false, fmt.Errorf("decode from disk had empty team id")
	}
	if !ret.ID().Eq(teamID) {
		return nil, false, fmt.Errorf("decode from disk had wrong team id %v != %v", ret.ID(), teamID)
	}
	if ret.IsPublic() != public {
		return nil, false, fmt.Errorf("decode from disk had wrong publicness %v != %v (%v)", ret.IsPublic(), public, teamID)
	}

	return item.value(), true, nil
}

func (s *diskStorageGeneric) delete(ctx context.Context, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(ctx, teamID, public)
	return s.encryptedDB.Delete(ctx, key)
}

func (s *diskStorageGeneric) dbKey(ctx context.Context, teamID keybase1.TeamID, public bool) libkb.DbKey {
	key := fmt.Sprintf("tid:%s", teamID)
	if public {
		key = fmt.Sprintf("tid:%s|pub", teamID)
	}
	return libkb.DbKey{
		Typ: s.dbObjTyp,
		Key: key,
	}
}

// --------------------------------------------------

// Store some TeamSigChainState's in memory. Threadsafe.
type memoryStorageGeneric struct {
	libkb.Contextified
	lru *lru.Cache
}

func newMemoryStorageGeneric(g *libkb.GlobalContext, sz int) *memoryStorageGeneric {
	nlru, err := lru.New(sz)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &memoryStorageGeneric{
		Contextified: libkb.NewContextified(g),
		lru:          nlru,
	}
}

func (s *memoryStorageGeneric) put(ctx context.Context, state teamDataGeneric) {
	s.lru.Add(s.key(state.ID(), state.IsPublic()), state)
}

// Can return nil.
func (s *memoryStorageGeneric) get(ctx context.Context, teamID keybase1.TeamID, public bool) teamDataGeneric {
	untyped, ok := s.lru.Get(s.key(teamID, public))
	if !ok {
		return nil
	}
	state, ok := untyped.(teamDataGeneric)
	if !ok {
		s.G().Log.Warning("Team MemoryStorage got bad type from lru: %T", untyped)
		return nil
	}
	return state
}

func (s *memoryStorageGeneric) delete(ctx context.Context, teamID keybase1.TeamID, public bool) {
	s.lru.Remove(s.key(teamID, public))
}

func (s *memoryStorageGeneric) clear() {
	s.lru.Purge()
}

func (s *memoryStorageGeneric) key(teamID keybase1.TeamID, public bool) (key string) {
	key = fmt.Sprintf("tid:%s", teamID)
	if public {
		key = fmt.Sprintf("tid:%s|pub", teamID)
	}
	return key
}

// --------------------------------------------------

func getLocalStorageSecretBoxKeyGeneric(ctx context.Context, g *libkb.GlobalContext, reason libkb.EncryptionReason) (fkey [32]byte, err error) {
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
	skey, err := encKey.SecretSymmetricKey(reason)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}

// --------------------------------------------------

type LameSecretUI struct{}

func (d LameSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

var getLameSecretUI = func() libkb.SecretUI { return LameSecretUI{} }
