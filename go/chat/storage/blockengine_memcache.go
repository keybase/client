package storage

import (
	"fmt"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type blockEngineMemCacheImpl struct {
	blockCache *lru.Cache
}

func newBlockEngineMemCache() *blockEngineMemCacheImpl {
	c, _ := lru.New(100)
	return &blockEngineMemCacheImpl{
		blockCache: c,
	}
}

func (b *blockEngineMemCacheImpl) key(uid gregor1.UID, convID chat1.ConversationID, id int) string {
	return fmt.Sprintf("%s:%s:%d", uid, convID, id)
}

func (b *blockEngineMemCacheImpl) getBlock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, id int) (block, bool) {
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
