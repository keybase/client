package stellar

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

func loadUvUpk(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion) (res *keybase1.UserPlusKeysV2, err error) {
	loadArg := libkb.NewLoadUserArgWithContext(ctx, g).WithUID(uv.Uid)
	upkv2, _, err := g.GetUPAKLoader().LoadV2(loadArg)
	if err != nil {
		return nil, err
	}
	if upkv2 == nil {
		return nil, fmt.Errorf("could not load user: %v (nil)", uv.String())
	}
	if upkv2.Current.EldestSeqno == uv.EldestSeqno {
		return &upkv2.Current, nil
	}
	for _, incarnation := range upkv2.PastIncarnations {
		if incarnation.EldestSeqno == uv.EldestSeqno {
			return &incarnation, nil
		}
	}
	return nil, fmt.Errorf("could not load user: %v (v)", uv.String())
}

func loadOwnLatestPuk(ctx context.Context, g *libkb.GlobalContext) (gen keybase1.PerUserKeyGeneration, seed libkb.PerUserKeySeed, err error) {
	pukring, err := g.GetPerUserKeyring(ctx)
	if err != nil {
		return 0, seed, err
	}
	m := libkb.NewMetaContext(ctx, g)
	err = pukring.Sync(m)
	if err != nil {
		return 0, seed, err
	}
	gen = pukring.CurrentGeneration()
	seed, err = pukring.GetSeedByGeneration(m, gen)
	return gen, seed, err
}

// Short-lived cache for looking up whether the logged-in user owns accounts.
type OwnAccountLookupCache interface {
	OwnAccount(ctx context.Context, accountID stellar1.AccountID) (own bool, accountName string, err error)
}

type ownAccountLookupCacheImpl struct {
	sync.RWMutex
	loadErr  error
	accounts map[stellar1.AccountID]*string
}

// NewOwnAccountLookupCache fetches the list of accounts in the background and stores them.
func NewOwnAccountLookupCache(ctx context.Context, g *libkb.GlobalContext) OwnAccountLookupCache {
	c := &ownAccountLookupCacheImpl{
		accounts: make(map[stellar1.AccountID]*string),
	}
	c.Lock()
	go c.fetch(ctx, g)
	return c
}

// Fetch populates the cache in the background.
func (c *ownAccountLookupCacheImpl) fetch(ctx context.Context, g *libkb.GlobalContext) {
	go func() {
		ctx := libkb.CopyTagsToBackground(ctx)
		defer c.Unlock()
		bundle, _, err := remote.Fetch(ctx, g)
		c.loadErr = err
		if err != nil {
			return
		}
		for _, account := range bundle.Accounts {
			name := account.Name
			c.accounts[account.AccountID] = &name
		}
	}()
}

// OwnAccount queries the cache. Blocks until the populating RPC returns.
func (c *ownAccountLookupCacheImpl) OwnAccount(ctx context.Context, accountID stellar1.AccountID) (own bool, accountName string, err error) {
	c.RLock()
	defer c.RLock()
	if c.loadErr != nil {
		return false, "", c.loadErr
	}
	name := c.accounts[accountID]
	if name == nil {
		return false, "", nil
	}
	return true, *name, nil
}
