package stellar

import (
	"context"
	"fmt"
	"runtime/debug"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
)

func loadUvUpk(mctx libkb.MetaContext, uv keybase1.UserVersion) (res *keybase1.UserPlusKeysV2, err error) {
	loadArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(uv.Uid)
	upkv2, _, err := mctx.G().GetUPAKLoader().LoadV2(loadArg)
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

func loadOwnLatestPuk(mctx libkb.MetaContext) (gen keybase1.PerUserKeyGeneration, seed libkb.PerUserKeySeed, err error) {
	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return 0, seed, err
	}
	err = pukring.Sync(mctx)
	if err != nil {
		return 0, seed, err
	}
	gen = pukring.CurrentGeneration()
	seed, err = pukring.GetSeedByGeneration(mctx, gen)
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
// Was created before Stellar.accounts, and could probably benefit from using that cache.
func NewOwnAccountLookupCache(mctx libkb.MetaContext) OwnAccountLookupCache {
	c := &ownAccountLookupCacheImpl{
		accounts: make(map[stellar1.AccountID]*string),
	}
	c.Lock()
	go c.fetch(mctx)
	return c
}

// Fetch populates the cache in the background.
func (c *ownAccountLookupCacheImpl) fetch(mctx libkb.MetaContext) {
	go func() {
		mc := mctx.BackgroundWithLogTags()
		defer c.Unlock()
		bundle, err := remote.FetchSecretlessBundle(mc)
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

func LookupSenderSeed(mctx libkb.MetaContext) (stellar1.AccountID, stellarnet.SeedStr, error) {
	senderEntry, senderAccountBundle, err := LookupSenderPrimary(mctx)
	if err != nil {
		return "", "", err
	}
	senderSeed, err := stellarnet.NewSeedStr(senderAccountBundle.Signers[0].SecureNoLogString())
	if err != nil {
		return "", "", err
	}

	return senderEntry.AccountID, senderSeed, nil
}

func isAmountLessThanMin(amount, min string) bool {
	cmp, err := stellarnet.CompareStellarAmounts(amount, min)
	if err == nil && cmp == -1 {
		return true
	}
	return false
}

func EmptyAmountStack(mctx libkb.MetaContext) {
	mctx.Debug("unexpected empty amount\n%v", string(debug.Stack()))
}
