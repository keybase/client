package stellar

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/stellar1"
)

type RequestLoader struct {
	libkb.Contextified
}

var defaultRequestLoader *RequestLoader
var defaultReqLock sync.Mutex

func NewRequestLoader(g *libkb.GlobalContext) *RequestLoader {
	r := &RequestLoader{
		Contextified: libkb.NewContextified(g),
	}

	return r
}

func DefaultRequestLoader(g *libkb.GlobalContext) *RequestLoader {
	defaultReqLock.Lock()
	defer defaultReqLock.Unlock()

	if defaultRequestLoader == nil {
		defaultRequestLoader = NewRequestLoader(g)
		g.PushShutdownHook(defaultRequestLoader.Shutdown)
	}

	return defaultRequestLoader
}

func (r *RequestLoader) Shutdown() error {
	return nil
}

func (r *RequestLoader) Load(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo {
	defer libkb.CTrace(ctx, r.G().GetLog(), fmt.Sprintf("RequestLoader.Load(cid=%s,mid=%s,rid=%s)", convID, msgID, requestID), func() error { return nil })()

	return nil
}
