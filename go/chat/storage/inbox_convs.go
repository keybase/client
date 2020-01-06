package storage

import (
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type inboxConvsImpl struct {
	sync.Mutex

	encryptedDB *encrypteddb.EncryptedDB
	cache       map[string]types.RemoteConversation
}

func newInboxConvsImpl(g *globals.Context) *inboxConvsImpl {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &inboxConvsImpl{
		cache:       make(map[string]types.RemoteConversation),
		encryptedDB: encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (i *inboxConvsImpl) getDBKey(memKey string) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInboxConversations,
		Key: memKey,
	}
}

func (i *inboxConvsImpl) getMemKey(uid gregor1.UID, convID chat1.ConvIDShort) string {
	return uid.String() + chat1.DbShortFormToString(convID)
}

func (i *inboxConvsImpl) Get(ctx context.Context, uid gregor1.UID, convID chat1.ConvIDShort) (res types.RemoteConversation, found bool, err error) {
	i.Lock()
	defer i.Unlock()
	memkey := i.getMemKey(uid, convID)
	if rc, ok := i.cache[memkey]; ok {
		return rc.Copy(), true, nil
	}
	dbkey := i.getDBKey(memkey)
	if found, err = i.encryptedDB.Get(ctx, dbkey, &res); err != nil {
		return res, found, err
	}
	if found {
		i.cache[memkey] = res
	}
	return res, found, nil
}

func (i *inboxConvsImpl) Put(ctx context.Context, uid gregor1.UID, convID chat1.ConvIDShort,
	rc types.RemoteConversation) error {
	i.Lock()
	defer i.Unlock()
	memkey := i.getMemKey(uid, convID)
	dbkey := i.getDBKey(memkey)
	i.cache[memkey] = rc
	return i.encryptedDB.Put(ctx, dbkey, rc)
}

func (i *inboxConvsImpl) Clear() {
	i.Lock()
	defer i.Unlock()
	i.cache = make(map[string]types.RemoteConversation)
}

func (i *inboxConvsImpl) OnLogout(m libkb.MetaContext) error {
	i.Clear()
	return nil
}

func (i *inboxConvsImpl) OnDbNuke(m libkb.MetaContext) error {
	i.Clear()
	return nil
}

var inboxConvs = newInboxConvsImpl()
