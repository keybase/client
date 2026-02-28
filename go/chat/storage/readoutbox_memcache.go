package storage

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
)

type readOutboxMemCacheImpl struct {
	sync.RWMutex

	datMap map[string]*diskReadOutbox
}

func newReadOutboxMemCacheImpl() *readOutboxMemCacheImpl {
	return &readOutboxMemCacheImpl{
		datMap: make(map[string]*diskReadOutbox),
	}
}

func (o *readOutboxMemCacheImpl) Get(uid gregor1.UID) *diskReadOutbox {
	o.RLock()
	defer o.RUnlock()
	if obox, ok := o.datMap[uid.String()]; ok {
		return obox
	}
	return nil
}

func (o *readOutboxMemCacheImpl) Put(uid gregor1.UID, obox *diskReadOutbox) {
	o.Lock()
	defer o.Unlock()
	o.datMap[uid.String()] = obox
}

func (o *readOutboxMemCacheImpl) Clear(uid gregor1.UID) {
	o.Lock()
	defer o.Unlock()
	delete(o.datMap, uid.String())
}

func (o *readOutboxMemCacheImpl) clearCache() {
	o.Lock()
	defer o.Unlock()
	o.datMap = make(map[string]*diskReadOutbox)
}

func (o *readOutboxMemCacheImpl) OnLogout(mctx libkb.MetaContext) error {
	o.clearCache()
	return nil
}

func (o *readOutboxMemCacheImpl) OnDbNuke(mctx libkb.MetaContext) error {
	o.clearCache()
	return nil
}

var readOutboxMemCache = newReadOutboxMemCacheImpl()
