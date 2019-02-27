package stellar

import (
	"fmt"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
)

// BuildPaymentCache has helpers for getting information quickly when building a payment.
// Methods should err on the side of performance rather at the cost of serialization.
// CORE-8119: But they don't yet.
type BuildPaymentCache interface {
	OwnsAccount(libkb.MetaContext, stellar1.AccountID) (own bool, primary bool, err error)
	PrimaryAccount(libkb.MetaContext) (stellar1.AccountID, error)
	// AccountSeqno should be cached _but_ it should also be busted asap.
	// Because it is used to prevent users from sending payments twice in a row.
	AccountSeqno(libkb.MetaContext, stellar1.AccountID) (string, error)
	IsAccountFunded(libkb.MetaContext, stellar1.AccountID) (bool, error)
	LookupRecipient(libkb.MetaContext, stellarcommon.RecipientInput) (stellarcommon.Recipient, error)
	GetOutsideExchangeRate(libkb.MetaContext, stellar1.OutsideCurrencyCode) (stellar1.OutsideExchangeRate, error)
	AvailableXLMToSend(libkb.MetaContext, stellar1.AccountID) (string, error)
	GetOutsideCurrencyPreference(libkb.MetaContext, stellar1.AccountID) (stellar1.OutsideCurrencyCode, error)
}

// Each instance is tied to a UV login. Must be discarded when switching users.
// Threadsafe.
// CORE-8119: Make all of these methods hit caches when called repeatedly.
type buildPaymentCache struct {
	sync.Mutex
	remoter remote.Remoter

	lookupRecipientLocktab libkb.LockTable
	lookupRecipientCache   *lru.Cache
}

func newBuildPaymentCache(remoter remote.Remoter) *buildPaymentCache {
	lookupRecipientCache, err := lru.New(50)
	if err != nil {
		panic(err)
	}
	return &buildPaymentCache{
		remoter:              remoter,
		lookupRecipientCache: lookupRecipientCache,
	}
}

func (c *buildPaymentCache) OwnsAccount(mctx libkb.MetaContext,
	accountID stellar1.AccountID) (bool, bool, error) {
	return OwnAccount(mctx, accountID)
}

func (c *buildPaymentCache) PrimaryAccount(mctx libkb.MetaContext) (stellar1.AccountID, error) {
	return GetOwnPrimaryAccountID(mctx)
}

func (c *buildPaymentCache) AccountSeqno(mctx libkb.MetaContext,
	accountID stellar1.AccountID) (string, error) {
	seqno, err := c.remoter.AccountSeqno(mctx.Ctx(), accountID)
	return fmt.Sprintf("%v", seqno), err
}

func (c *buildPaymentCache) IsAccountFunded(mctx libkb.MetaContext,
	accountID stellar1.AccountID) (bool, error) {
	return isAccountFunded(mctx.Ctx(), c.remoter, accountID)
}

type lookupRecipientCacheEntry struct {
	Recipient stellarcommon.Recipient
	Time      time.Time
}

func (c *buildPaymentCache) LookupRecipient(mctx libkb.MetaContext,
	to stellarcommon.RecipientInput) (res stellarcommon.Recipient, err error) {
	lock := c.lookupRecipientLocktab.AcquireOnName(mctx.Ctx(), mctx.G(), string(to))
	defer lock.Release(mctx.Ctx())
	if val, ok := c.lookupRecipientCache.Get(to); ok {
		if entry, ok := val.(lookupRecipientCacheEntry); ok {
			if mctx.G().GetClock().Now().Sub(entry.Time) <= time.Minute {
				// Cache hit
				mctx.Debug("bpc.LookupRecipient cache hit")
				return entry.Recipient, nil
			}
		} else {
			mctx.Debug("bpc.LookupRecipient bad cached type: %T", val)
		}
		c.lookupRecipientCache.Remove(to)
	}
	res, err = LookupRecipient(mctx, to, false /* isCLI */)
	if err != nil {
		return res, err
	}
	c.lookupRecipientCache.Add(to, lookupRecipientCacheEntry{
		Time:      time.Now().Round(0),
		Recipient: res,
	})
	return res, nil
}

func (c *buildPaymentCache) GetOutsideExchangeRate(mctx libkb.MetaContext,
	currency stellar1.OutsideCurrencyCode) (rate stellar1.OutsideExchangeRate, err error) {
	return c.remoter.ExchangeRate(mctx.Ctx(), string(currency))
}

func (c *buildPaymentCache) AvailableXLMToSend(mctx libkb.MetaContext,
	accountID stellar1.AccountID) (string, error) {
	details, err := c.remoter.Details(mctx.Ctx(), accountID)
	if err != nil {
		return "", err
	}
	if details.Available == "" {
		// This is what stellard does if the account is not funded.
		return "0", nil
	}
	return details.Available, nil
}

func (c *buildPaymentCache) GetOutsideCurrencyPreference(mctx libkb.MetaContext,
	accountID stellar1.AccountID) (stellar1.OutsideCurrencyCode, error) {
	cr, err := GetCurrencySetting(mctx, accountID)
	return cr.Code, err
}
