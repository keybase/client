package attachments

import (
	"io"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/lru"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type PendingCache struct {
	globals.Contextified
	utils.DebugLabeler
	diskLRU *lru.DiskLRU
}

func NewPendingCache(g *globals.Context, size int) *PendingCache {
	return &PendingCache{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "PendingCache", false),
		diskLRU:      lru.NewDiskLRU("pending", 1, size),
	}
}

func (p *PendingCache) Get(ctx context.Context, uid gregor1.UID, outboxID chat1.OutboxID) (res io.Reader, err error) {
	defer p.Trace(ctx, func() error { return err }, "Get(%s)", outboxID)()

}
