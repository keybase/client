package storage

import (
	"sync"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type inboxMemCacheImpl struct {
	sync.Mutex

	versMap  map[string]*inboxDiskVersions
	indexMap map[string]*inboxDiskIndex
	convMap  map[string]types.RemoteConversation
}

func newInboxMemCacheImpl() *inboxMemCacheImpl {
	return &inboxMemCacheImpl{
		versMap:  make(map[string]*inboxDiskVersions),
		indexMap: make(map[string]*inboxDiskIndex),
		convMap:  make(map[string]types.RemoteConversation),
	}
}

func (i *inboxMemCacheImpl) GetVersions(uid gregor1.UID) *inboxDiskVersions {
	i.Lock()
	defer i.Unlock()
	if ibox, ok := i.versMap[uid.String()]; ok {
		return ibox
	}
	return nil
}

func (i *inboxMemCacheImpl) PutVersions(uid gregor1.UID, ibox *inboxDiskVersions) {
	i.Lock()
	defer i.Unlock()
	i.versMap[uid.String()] = ibox
}

func (i *inboxMemCacheImpl) GetIndex(uid gregor1.UID) *inboxDiskIndex {
	i.Lock()
	defer i.Unlock()
	if ibox, ok := i.indexMap[uid.String()]; ok {
		ret := ibox.DeepCopy()
		return &ret
	}
	return nil
}

func (i *inboxMemCacheImpl) PutIndex(uid gregor1.UID, ibox *inboxDiskIndex) {
	i.Lock()
	defer i.Unlock()
	i.indexMap[uid.String()] = ibox
}

func (i *inboxMemCacheImpl) convKey(uid gregor1.UID, convID chat1.ConversationID) string {
	return uid.String() + convID.String()
}

func (i *inboxMemCacheImpl) GetConv(uid gregor1.UID, convID chat1.ConversationID) *types.RemoteConversation {
	i.Lock()
	defer i.Unlock()
	if conv, ok := i.convMap[i.convKey(uid, convID)]; ok {
		ret := conv.DeepCopy()
		return &ret
	}
	return nil
}

func (i *inboxMemCacheImpl) PutConv(uid gregor1.UID, conv types.RemoteConversation) {
	i.Lock()
	defer i.Unlock()
	i.convMap[i.convKey(uid, conv.GetConvID())] = conv
}

func (i *inboxMemCacheImpl) Clear(uid gregor1.UID) {
	i.Lock()
	defer i.Unlock()
	delete(i.versMap, uid.String())
	delete(i.indexMap, uid.String())
	i.convMap = make(map[string]types.RemoteConversation)
}

func (i *inboxMemCacheImpl) clearCache() {
	i.Lock()
	defer i.Unlock()
	i.versMap = make(map[string]*inboxDiskVersions)
	i.indexMap = make(map[string]*inboxDiskIndex)
	i.convMap = make(map[string]types.RemoteConversation)
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
