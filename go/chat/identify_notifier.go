package chat

import (
	"context"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type IdentifyNotifier struct {
	libkb.Contextified
	sync.RWMutex
	identCache map[string]keybase1.CanonicalTLFNameAndIDWithBreaks
}

func NewIdentifyNotifier(g *libkb.GlobalContext) *IdentifyNotifier {
	return &IdentifyNotifier{
		Contextified: libkb.NewContextified(g),
		identCache:   make(map[string]keybase1.CanonicalTLFNameAndIDWithBreaks),
	}
}

func (i *IdentifyNotifier) Send(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	i.RLock()
	tlfName := update.CanonicalName.String()
	if stored, ok := i.identCache[tlfName]; ok {
		// We have the exact update stored, don't send it again
		if stored.Eq(update) {
			defer i.RUnlock()
			i.G().Log.Debug("IdentifyNotifier: hit cache, not sending notify: %s", tlfName)
			return
		}
	}
	i.RUnlock()

	i.Lock()
	defer i.Unlock()

	i.G().Log.Debug("IdentifyNotifier: cache miss, sending notify: %s dat: %v", tlfName, update)
	i.G().NotifyRouter.HandleChatIdentifyUpdate(context.Background(), update)
	i.identCache[tlfName] = update
}
