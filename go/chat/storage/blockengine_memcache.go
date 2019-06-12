package storage

import (
	"fmt"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type blockEngineMemCacheImpl struct {
	lockTab    *libkb.LockTable
	blockCache *lru.Cache
}

func newBlockEngineMemCache() *blockEngineMemCacheImpl {
	c, _ := lru.New(100)
	return &blockEngineMemCacheImpl{
		blockCache: c,
		lockTab:    &libkb.LockTable{},
	}
}

func (b *blockEngineMemCacheImpl) key(uid gregor1.UID, convID chat1.ConversationID, id int) string {
	return fmt.Sprintf("%s:%s:%d", uid, convID, id)
}

func (b *blockEngineMemCacheImpl) getBlock(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, id int) (block, bool) {
	lockName := fmt.Sprintf("%s:%s:%d", uid, convID, id)
	l := b.lockTab.AcquireOnName(ctx, g.ExternalG(), lockName)
	defer l.Release(ctx)
	key := b.key(uid, convID, id)
	if v, ok := b.blockCache.Get(key); ok {
		bl := v.(block)
		var retMsgs [blockSize]chat1.MessageUnboxed
		for i := 0; i < blockSize; i++ {
			retMsgs[i] = bl.Msgs[i].DeepCopy()
		}
		return block{
			BlockID: bl.BlockID,
			Msgs:    retMsgs,
		}, true
	}
	return block{}, false
}

func (b *blockEngineMemCacheImpl) writeBlock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, bl block) {
	key := b.key(uid, convID, bl.BlockID)
	b.blockCache.Add(key, bl)
}

func (b *blockEngineMemCacheImpl) OnLogout(m libkb.MetaContext) error {
	b.blockCache.Purge()
	return nil
}

func (b *blockEngineMemCacheImpl) OnDbNuke(m libkb.MetaContext) error {
	b.blockCache.Purge()
	return nil
}

var blockEngineMemCache = newBlockEngineMemCache()
