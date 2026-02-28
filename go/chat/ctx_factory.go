package chat

import (
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CtxFactory struct {
	globals.Contextified
}

var _ types.ContextFactory = (*CtxFactory)(nil)

func NewCtxFactory(g *globals.Context) types.ContextFactory {
	return &CtxFactory{
		Contextified: globals.NewContextified(g),
	}
}

func (c *CtxFactory) NewKeyFinder() types.KeyFinder {
	return NewKeyFinder(c.G())
}

func (c *CtxFactory) NewUPAKFinder() types.UPAKFinder {
	return NewCachingUPAKFinder(c.G())
}

// For testing
type mockCtxFactory struct {
	globals.Contextified
	cryptKeys []keybase1.CryptKey
}

var _ types.ContextFactory = (*mockCtxFactory)(nil)

func newMockCtxFactory(g *globals.Context, cryptKeys []keybase1.CryptKey) types.ContextFactory {
	return &mockCtxFactory{
		Contextified: globals.NewContextified(g),
		cryptKeys:    cryptKeys,
	}
}

func (c *mockCtxFactory) NewKeyFinder() types.KeyFinder {
	return NewKeyFinderMock(c.cryptKeys)
}

func (c *mockCtxFactory) NewUPAKFinder() types.UPAKFinder {
	return NewCachingUPAKFinder(c.G())
}
