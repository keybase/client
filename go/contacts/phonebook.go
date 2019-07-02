package contacts

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/storage"
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

func NewSavedContactsStore(g *libkb.GlobalContext) *SavedContactsStore {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g, storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalDb
	}
	return &SavedContactsStore{
		encryptedDB: encrypteddb.New(g, dbFn, keyFn),
	}
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

func (s *SavedContactsStore) SaveContacts(mctx libkb.MetaContext, provider ContactsProvider, contacts []keybase1.Contact) (err error) {
	results, err := ResolveContacts(mctx, provider, contacts, keybase1.RegionCode(""))
	if err != nil {
		return err
	}

	val := savedContactsCache{
		Contacts: results,
	}
	val.Version = savedContactsCurrentVer
	cacheKey := savedContactsDbKey(mctx.CurrentUID())
	err = s.encryptedDB.Put(mctx.Ctx(), cacheKey, val)
	return err
}

type NoSavedContactsErr struct {
	Msg string
}

func (e NoSavedContactsErr) Error() string {
	return e.Msg
}

func (s *SavedContactsStore) RetrieveContacts(mctx libkb.MetaContext) (ret []keybase1.ProcessedContact, err error) {
	cacheKey := savedContactsDbKey(mctx.CurrentUID())
	var cache savedContactsCache
	found, err := s.encryptedDB.Get(mctx.Ctx(), cacheKey, &cache)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, NoSavedContactsErr{Msg: "contact list not found in encrypted DB"}
	}
	if cache.Version != savedContactsCurrentVer {
		return nil, NoSavedContactsErr{
			Msg: fmt.Sprintf("contact list found but old version (found: %d, need: %d)",
				cache.Version, savedContactsCurrentVer),
		}
	}
	return cache.Contacts, nil
}
