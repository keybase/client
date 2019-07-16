package contacts

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/encrypteddb"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Saving contact list into encrypted db.

// Cache resolutions of a lookup ran on entire contact list provided by the
// frontend. Assume every time SaveContacts is called, entire contact list is
// passed as an argument. Always cache the result of last resolution, do not do
// any result merging.

type SavedContactsStore struct {
	encryptedDB *encrypteddb.EncryptedDB
}

var _ libkb.SyncedContactListProvider = (*SavedContactsStore)(nil)

// NewSavedContactsStore creates a new SavedContactsStore for global context.
// The store is used to securely store list of resolved contacts.
func NewSavedContactsStore(g *libkb.GlobalContext) *SavedContactsStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return encrypteddb.GetSecretBoxKey(ctx, g, encrypteddb.DefaultSecretUI,
			libkb.EncryptionReasonContactsLocalStorage, "encrypting local contact list")
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &SavedContactsStore{
		encryptedDB: encrypteddb.New(g, dbFn, keyFn),
	}
}

func ServiceInit(g *libkb.GlobalContext) {
	g.SyncedContactList = NewSavedContactsStore(g)
}

func savedContactsDbKey(uid keybase1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBSavedContacts,
		Key: fmt.Sprintf("%v", uid),
	}
}

type savedContactsCache struct {
	Contacts []keybase1.ProcessedContact
	Version  int
}

const savedContactsCurrentVer = 1

func ResolveAndSaveContacts(mctx libkb.MetaContext, provider ContactsProvider, contacts []keybase1.Contact) (err error) {
	results, err := ResolveContacts(mctx, provider, contacts, keybase1.RegionCode(""))
	if err != nil {
		return err
	}
	s := mctx.G().SyncedContactList
	return s.SaveProcessedContacts(mctx, results)
}

func (s *SavedContactsStore) SaveProcessedContacts(mctx libkb.MetaContext, contacts []keybase1.ProcessedContact) (err error) {
	val := savedContactsCache{
		Contacts: contacts,
	}
	val.Version = savedContactsCurrentVer
	cacheKey := savedContactsDbKey(mctx.CurrentUID())
	err = s.encryptedDB.Put(mctx.Ctx(), cacheKey, val)
	return err
}

func (s *SavedContactsStore) RetrieveContacts(mctx libkb.MetaContext) (ret []keybase1.ProcessedContact, err error) {
	cacheKey := savedContactsDbKey(mctx.CurrentUID())
	var cache savedContactsCache
	found, err := s.encryptedDB.Get(mctx.Ctx(), cacheKey, &cache)
	if err != nil {
		return nil, err
	}
	if !found {
		return ret, nil
	}
	if cache.Version != savedContactsCurrentVer {
		mctx.Warning("synced contact list found but had an old version (found: %d, need: %d), returning empty list",
			cache.Version, savedContactsCurrentVer)
		return ret, nil
	}
	return cache.Contacts, nil
}
