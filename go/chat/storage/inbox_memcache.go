package storage

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
)

type inboxMemCacheImpl struct {
	sync.RWMutex

	datMap map[string]*inboxDiskData
}

func newInboxMemCacheImpl() *inboxMemCacheImpl {
	return &inboxMemCacheImpl{
		datMap: make(map[string]*inboxDiskData),
	}
}

func (i *inboxMemCacheImpl) Get(uid gregor1.UID) *inboxDiskData {
	i.RLock()
	defer i.RUnlock()
	if ibox, ok := i.datMap[uid.String()]; ok {
		return ibox
	}
	return nil
}

func (i *inboxMemCacheImpl) Put(uid gregor1.UID, ibox *inboxDiskData) {
	i.Lock()
	defer i.Unlock()
	i.datMap[uid.String()] = ibox
}

func (i *inboxMemCacheImpl) Clear(uid gregor1.UID) {
	i.Lock()
	defer i.Unlock()
	delete(i.datMap, uid.String())
}

func (i *inboxMemCacheImpl) clearCache() {
	i.Lock()
	defer i.Unlock()
	i.datMap = make(map[string]*inboxDiskData)
}

func (i *inboxMemCacheImpl) OnLogout(m libkb.MetaContext) error {
	i.clearCache()
	return nil
}

func (i *inboxMemCacheImpl) OnDbNuke(m libkb.MetaContext) error {
	i.clearCache()
	return nil
}

var inboxMemCache = newInboxMemCacheImpl()
