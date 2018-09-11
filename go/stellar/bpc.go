package stellar

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
)

// BuildPaymentCache has helpers for getting information quickly when building a payment.
// Methods should err on the side of performance rather at the cost of serialization.
// CORE-8119: But they don't yet.
type BuildPaymentCache interface {
	OwnsAccount(libkb.MetaContext, stellar1.AccountID) (bool, error)
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

func GetBuildPaymentCache(mctx libkb.MetaContext, remoter remote.Remoter) BuildPaymentCache {
	// CORE-8119: attach an instance to G and use that.
	// CORE-8119: delete it when a logout occurs.
	return &buildPaymentCache{
		remoter: remoter,
	}
}

// Each instance is tied to a UV login. Must be discarded when switching users.
// Threadsafe.
// CORE-8119: Make all of these methods hit caches when called repeatedly.
type buildPaymentCache struct {
	sync.Mutex
	remoter remote.Remoter
}

func (c *buildPaymentCache) OwnsAccount(mctx libkb.MetaContext,
	accountID stellar1.AccountID) (bool, error) {
	return OwnAccount(mctx.Ctx(), mctx.G(), accountID)
}

func (c *buildPaymentCache) PrimaryAccount(mctx libkb.MetaContext) (stellar1.AccountID, error) {
	return GetOwnPrimaryAccountID(mctx.Ctx(), mctx.G())
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

func (c *buildPaymentCache) LookupRecipient(mctx libkb.MetaContext,
	to stellarcommon.RecipientInput) (res stellarcommon.Recipient, err error) {
	// CORE-8119: Will delegating to stellar.LookupRecipient be too slow?
	// CORE-8119: Will it do identifies?
	return LookupRecipient(mctx, to, false /* isCLI */)
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
	cr, err := GetCurrencySetting(mctx, c.remoter, accountID)
	return cr.Code, err
}
