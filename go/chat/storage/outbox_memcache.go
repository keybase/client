package storage

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
)

type outboxMemCacheImpl struct {
	sync.RWMutex

	datMap map[string]*diskOutbox
}

func newoutboxMemCacheImpl() *outboxMemCacheImpl {
	return &outboxMemCacheImpl{
		datMap: make(map[string]*diskOutbox),
	}
}

func (o *outboxMemCacheImpl) Get(uid gregor1.UID) *diskOutbox {
	o.RLock()
	defer o.RUnlock()
	if obox, ok := o.datMap[uid.String()]; ok {
		return obox
	}
	return nil
}

func (o *outboxMemCacheImpl) Put(uid gregor1.UID, obox *diskOutbox) {
	o.Lock()
	defer o.Unlock()
	o.datMap[uid.String()] = obox
}

func (o *outboxMemCacheImpl) Clear(uid gregor1.UID) {
	o.Lock()
	defer o.Unlock()
	delete(o.datMap, uid.String())
}

func (o *outboxMemCacheImpl) clearCache() {
	o.Lock()
	defer o.Unlock()
	o.datMap = make(map[string]*diskOutbox)
}

func (o *outboxMemCacheImpl) OnLogout(mctx libkb.MetaContext) error {
	o.clearCache()
	return nil
}

func (o *outboxMemCacheImpl) OnDbNuke(mctx libkb.MetaContext) error {
	o.clearCache()
	return nil
}

var outboxMemCache = newoutboxMemCacheImpl()
