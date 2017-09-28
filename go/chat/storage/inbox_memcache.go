package storage

import (
	"sync"

	"github.com/keybase/client/go/protocol/gregor1"
)

type inboxMemCacheImpl struct {
	sync.Mutex

	datMap map[string]*inboxDiskData
}

func newInboxMemCacheImpl() *inboxMemCacheImpl {
	return &inboxMemCacheImpl{
		datMap: make(map[string]*inboxDiskData),
	}
}

func (i *inboxMemCacheImpl) Get(uid gregor1.UID) *inboxDiskData {
	i.Lock()
	defer i.Unlock()
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
	delete(i.datMap, uid.String())
}

var inboxMemCache = newInboxMemCacheImpl()
