package stellar

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
)

// BuildPaymentCache has helpers for getting information quickly when building a payment.
// Methods should err on the side of performance rather at the cost of serialization.
// CORE-8119: But they don't yet.
type BuildPaymentCache interface {
	PrimaryAccount(libkb.MetaContext) (stellar1.AccountID, error)
	// AccountSeqno should be cached _but_ it should also be busted asap.
	// Because it is used to prevent users from sending payments twice in a row.
	AccountSeqno(libkb.MetaContext, stellar1.AccountID) (string, error)
	IsAccountFunded(libkb.MetaContext, stellar1.AccountID, stellar1.BuildPaymentID) (bool, error)
	LookupRecipient(libkb.MetaContext, stellarcommon.RecipientInput) (stellarcommon.Recipient, error)
	GetOutsideExchangeRate(libkb.MetaContext, stellar1.OutsideCurrencyCode) (stellar1.OutsideExchangeRate, error)
	AvailableXLMToSend(libkb.MetaContext, stellar1.AccountID) (string, error)
	GetOutsideCurrencyPreference(libkb.MetaContext, stellar1.AccountID, stellar1.BuildPaymentID) (stellar1.OutsideCurrencyCode, error)
	ShouldOfferAdvancedSend(mctx libkb.MetaContext, from, to stellar1.AccountID) (stellar1.AdvancedBanner, error)
	InformDefaultCurrencyChange(mctx libkb.MetaContext)
}

// Each instance is tied to a UV login. Must be discarded when switching users.
// Threadsafe.
// CORE-8119: Make all of these methods hit caches when called repeatedly.
type buildPaymentCache struct {
	sync.Mutex
	remoter remote.Remoter

	accountFundedCache             *TimeCache
	lookupRecipientCache           *TimeCache
	shouldOfferAdvancedSendCache   *TimeCache
	currencyPreferenceCache        *TimeCache
	currencyPreferenceForeverCache *TimeCache
}

func newBuildPaymentCache(remoter remote.Remoter) *buildPaymentCache {
	return &buildPaymentCache{
		remoter:                        remoter,
		accountFundedCache:             NewTimeCache("accountFundedCache", 20, 0 /*forever*/),
		lookupRecipientCache:           NewTimeCache("lookupRecipient", 20, time.Minute),
		shouldOfferAdvancedSendCache:   NewTimeCache("shouldOfferAdvancedSend", 20, time.Minute),
		currencyPreferenceCache:        NewTimeCache("currencyPreference", 20, 5*time.Minute),
		currencyPreferenceForeverCache: NewTimeCache("currencyPreferenceForever", 20, 0 /*forever*/),
	}
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
	accountID stellar1.AccountID, bid stellar1.BuildPaymentID) (res bool, err error) {
	fill := func() (interface{}, error) {
		funded, err := isAccountFunded(mctx.Ctx(), c.remoter, accountID)
		res = funded
		return funded, err
	}
	if !bid.IsNil() {
		key := fmt.Sprintf("%v:%v", accountID, bid)
		err = c.accountFundedCache.GetWithFill(mctx, key, &res, fill)
		return res, err
	}
	_, err = fill()
	return res, err
}

func (c *buildPaymentCache) LookupRecipient(mctx libkb.MetaContext,
	to stellarcommon.RecipientInput) (res stellarcommon.Recipient, err error) {
	fill := func() (interface{}, error) {
		return LookupRecipient(mctx, to, false /* isCLI */)
	}
	err = c.lookupRecipientCache.GetWithFill(mctx, string(to), &res, fill)
	return res, err
}

func (c *buildPaymentCache) ShouldOfferAdvancedSend(mctx libkb.MetaContext, from, to stellar1.AccountID) (res stellar1.AdvancedBanner, err error) {
	key := from.String() + ":" + to.String()
	fill := func() (interface{}, error) {
		return ShouldOfferAdvancedSend(mctx, c.remoter, from, to)
	}
	err = c.shouldOfferAdvancedSendCache.GetWithFill(mctx, key, &res, fill)
	return res, err
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
	accountID stellar1.AccountID, bid stellar1.BuildPaymentID) (res stellar1.OutsideCurrencyCode, err error) {
	fillInner := func() (interface{}, error) {
		cr, err := GetCurrencySetting(mctx, accountID)
		return cr.Code, err
	}
	fillOuter := func() (interface{}, error) {
		err := c.currencyPreferenceCache.GetWithFill(mctx, accountID.String(), &res, fillInner)
		return res, err
	}
	if !bid.IsNil() {
		foreverKey := fmt.Sprintf("%v:%v", accountID, bid)
		err = c.currencyPreferenceForeverCache.GetWithFill(mctx, foreverKey, &res, fillOuter)
		return res, err
	}
	_, err = fillOuter()
	return res, err
}

func (c *buildPaymentCache) InformDefaultCurrencyChange(mctx libkb.MetaContext) {
	c.currencyPreferenceCache.Clear()
	c.currencyPreferenceForeverCache.Clear()
}
