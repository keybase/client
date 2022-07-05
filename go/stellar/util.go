package stellar

import (
	"context"
	"fmt"
	"runtime/debug"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
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

type ownAccountLookupCacheFromGlobal struct {
	libkb.Contextified
}

// NewOwnAccountLookupCache was obsoleted and exists only as an interface bridge.
// Feel free to continue this refactor and remove it.
func NewOwnAccountLookupCache(mctx libkb.MetaContext) OwnAccountLookupCache {
	return &ownAccountLookupCacheFromGlobal{
		Contextified: libkb.NewContextified(mctx.G()),
	}
}

func (o *ownAccountLookupCacheFromGlobal) OwnAccount(ctx context.Context, accountID stellar1.AccountID) (own bool, accountName string, err error) {
	mctx := libkb.NewMetaContext(ctx, o.G())
	own, _, accountName, err = OwnAccountPlusNameCached(mctx, accountID)
	return own, accountName, err
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

// cancelOnMobileBackground returns a copy of mctx that is canceled
// when the app transitions out of foreground, in addition to its existing cancelation.
//
// Canceling this context releases resources associated with it, so code should
// call cancel as soon as the operations running in this Context complete.
func cancelOnMobileBackground(mctx libkb.MetaContext) (libkb.MetaContext, context.CancelFunc) {
	mctx, cancel := mctx.WithContextCancel()
	go func() {
		for {
			foreground := keybase1.MobileAppState_FOREGROUND
			select {
			case state := <-mctx.G().MobileAppState.NextUpdate(&foreground):
				if state != foreground {
					cancel()
					return
				}
			case <-mctx.Ctx().Done():
				return
			}
		}
	}()
	return mctx, cancel
}
