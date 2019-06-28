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

// So this is caching the inputs - unlike cache.go which caches contact
// resolutions (the outputs).

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
	Contacts []keybase1.Contact
	Version  int
}

const savedContactsCurrentVer = 1

func (s *SavedContactsStore) SaveContacts(mctx libkb.MetaContext, contacts []keybase1.Contact) (err error) {
	val := savedContactsCache{
		Contacts: contacts,
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

func (s *SavedContactsStore) RetrieveContacts(mctx libkb.MetaContext) (ret []keybase1.Contact, err error) {
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
