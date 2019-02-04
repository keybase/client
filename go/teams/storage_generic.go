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

// Store TeamData's of FastTeamData's on memory and disk. Threadsafe.
type storageGeneric struct {
	sync.Mutex
	mem         *memoryStorageGeneric
	disk        *diskStorageGeneric
	description string
}

func newStorageGeneric(g *libkb.GlobalContext, lruSize int, version int, dbObjTyp libkb.ObjType, reason libkb.EncryptionReason, description string, gdi func() diskItemGeneric) *storageGeneric {
	return &storageGeneric{
		mem:         newMemoryStorageGeneric(lruSize),
		disk:        newDiskStorageGeneric(g, version, dbObjTyp, reason, gdi),
		description: description,
	}
}

func (s *storageGeneric) put(mctx libkb.MetaContext, state teamDataGeneric) {
	s.Lock()
	defer s.Unlock()

	s.mem.put(mctx, state)

	err := s.disk.put(mctx, state)
	if err != nil {
		mctx.CWarningf("teams.Storage#Put err: %v", err)
	}
}

// Can return nil.
func (s *storageGeneric) get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) teamDataGeneric {
	s.Lock()
	defer s.Unlock()

	item := s.mem.get(mctx, teamID, public)
	if item != nil {
		mctx.VLogf(libkb.VLog0, "teams.Storage#Get(%v) hit mem (%s)", teamID, s.description)
		// Mem hit
		return item
	}

	res, found, err := s.disk.get(mctx, teamID, public)
	if found && err == nil {
		// Disk hit
		mctx.VLogf(libkb.VLog0, "teams.Storage#Get(%v) hit disk (%s)", teamID, s.description)
		s.mem.put(mctx, res)
		return res
	}
	if err != nil {
		mctx.CDebugf("teams.Storage#Get(%v) disk err: %v", teamID, err)
	}
	mctx.VLogf(libkb.VLog0, "teams.Storage#Get(%v) missed (%s)", teamID, s.description)
	return nil
}

func (s *storageGeneric) Delete(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	s.mem.delete(mctx, teamID, public)
	return s.disk.delete(mctx, teamID, public)
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
	sync.Mutex
	encryptedDB      *encrypteddb.EncryptedDB
	version          int
	dbObjTyp         libkb.ObjType
	getEmptyDiskItem func() diskItemGeneric
}

func newDiskStorageGeneric(g *libkb.GlobalContext, version int, dbObjTyp libkb.ObjType, reason libkb.EncryptionReason, gdi func() diskItemGeneric) *diskStorageGeneric {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return GetLocalStorageSecretBoxKeyGeneric(ctx, g, reason)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &diskStorageGeneric{
		encryptedDB:      encrypteddb.New(g, dbFn, keyFn),
		version:          version,
		dbObjTyp:         dbObjTyp,
		getEmptyDiskItem: gdi,
	}
}

func (s *diskStorageGeneric) put(mctx libkb.MetaContext, state teamDataGeneric) error {
	s.Lock()
	defer s.Unlock()

	if !mctx.ActiveDevice().Valid() && !state.IsPublic() {
		mctx.CDebugf("skipping team store since user is logged out")
		return nil
	}

	key := s.dbKey(mctx, state.ID(), state.IsPublic())
	item := s.getEmptyDiskItem()
	item.setVersion(s.version)
	err := item.setValue(state)
	if err != nil {
		return err
	}

	err = s.encryptedDB.Put(mctx.Ctx(), key, item)
	if err != nil {
		return err
	}
	return nil
}

// Res is valid if (found && err == nil)
func (s *diskStorageGeneric) get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) (teamDataGeneric, bool, error) {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(mctx, teamID, public)
	item := s.getEmptyDiskItem()
	found, err := s.encryptedDB.Get(mctx.Ctx(), key, item)
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

func (s *diskStorageGeneric) delete(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) error {
	s.Lock()
	defer s.Unlock()

	key := s.dbKey(mctx, teamID, public)
	return s.encryptedDB.Delete(mctx.Ctx(), key)
}

func (s *diskStorageGeneric) dbKey(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) libkb.DbKey {
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
	lru *lru.Cache
}

func newMemoryStorageGeneric(size int) *memoryStorageGeneric {
	nlru, err := lru.New(size)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &memoryStorageGeneric{
		lru: nlru,
	}
}

func (s *memoryStorageGeneric) put(mctx libkb.MetaContext, state teamDataGeneric) {
	s.lru.Add(s.key(state.ID(), state.IsPublic()), state)
}

// Can return nil.
func (s *memoryStorageGeneric) get(mctx libkb.MetaContext, teamID keybase1.TeamID, public bool) teamDataGeneric {
	untyped, ok := s.lru.Get(s.key(teamID, public))
	if !ok {
		return nil
	}
	state, ok := untyped.(teamDataGeneric)
	if !ok {
		mctx.CWarningf("Team MemoryStorage got bad type from lru: %T", untyped)
		return nil
	}
	return state
}

func (s *memoryStorageGeneric) delete(m libkb.MetaContext, teamID keybase1.TeamID, public bool) {
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

// GetLocalStorageSecretBoxKeyGeneric gets a key for encrypting data on disk
// for the specified purpose
func GetLocalStorageSecretBoxKeyGeneric(ctx context.Context, g *libkb.GlobalContext, reason libkb.EncryptionReason) (fkey [32]byte, err error) {
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
