package remote

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
)

var ErrAccountIDMissing = errors.New("account id parameter missing")

type shouldCreateRes struct {
	libkb.AppStatusEmbed
	ShouldCreateResult
}

type ShouldCreateResult struct {
	ShouldCreate       bool `json:"shouldcreate"`
	HasWallet          bool `json:"haswallet"`
	AcceptedDisclaimer bool `json:"accepteddisclaimer"`
}

// ShouldCreate asks the server whether to create this user's initial wallet.
func ShouldCreate(ctx context.Context, g *libkb.GlobalContext) (res ShouldCreateResult, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.TraceTimed("Stellar.ShouldCreate", func() error { return err })()
	defer func() {
		mctx.Debug("Stellar.ShouldCreate: (res:%+v, err:%v)", res, err != nil)
	}()
	arg := libkb.NewAPIArg("stellar/shouldcreate")
	arg.RetryCount = 3
	arg.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes shouldCreateRes
	err = mctx.G().API.GetDecode(mctx, arg, &apiRes)
	return apiRes.ShouldCreateResult, err
}

func buildChainLinkPayload(m libkb.MetaContext, b stellar1.Bundle, me *libkb.User, pukGen keybase1.PerUserKeyGeneration, pukSeed libkb.PerUserKeySeed, deviceSigKey libkb.GenericKey) (*libkb.JSONPayload, keybase1.Seqno, libkb.LinkID, error) {
	err := b.CheckInvariants()
	if err != nil {
		return nil, 0, nil, err
	}
	if len(b.Accounts) < 1 {
		return nil, 0, nil, errors.New("stellar bundle has no accounts")
	}
	// Find the new primary account for the chain link.
	stellarAccount, err := b.PrimaryAccount()
	if err != nil {
		return nil, 0, nil, err
	}
	stellarAccountBundle, ok := b.AccountBundles[stellarAccount.AccountID]
	if !ok {
		return nil, 0, nil, errors.New("stellar primary account has no account bundle")
	}
	if len(stellarAccountBundle.Signers) < 1 {
		return nil, 0, nil, errors.New("stellar bundle has no signers")
	}
	if !stellarAccount.IsPrimary {
		return nil, 0, nil, errors.New("initial stellar account is not primary")
	}
	m.Debug("Stellar.PostWithChainLink: revision:%v accountID:%v pukGen:%v", b.Revision, stellarAccount.AccountID, pukGen)

	boxed, err := bundle.BoxAndEncode(&b, pukGen, pukSeed)
	if err != nil {
		return nil, 0, nil, err
	}

	m.Debug("Stellar.PostWithChainLink: make sigs")

	sig, err := libkb.StellarProofReverseSigned(m, me, stellarAccount.AccountID, stellarAccountBundle.Signers[0], deviceSigKey)
	if err != nil {
		return nil, 0, nil, err
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []libkb.JSONPayload{sig.Payload}
	section := make(libkb.JSONPayload)
	section["encrypted_parent"] = boxed.EncParentB64
	section["visible_parent"] = boxed.VisParentB64
	section["version_parent"] = boxed.FormatVersionParent
	section["account_bundles"] = boxed.AcctBundles
	payload["stellar"] = section

	return &payload, sig.Seqno, sig.LinkID, nil
}

// Post a bundle to the server with a chainlink.
func PostWithChainlink(mctx libkb.MetaContext, clearBundle stellar1.Bundle) (err error) {
	defer mctx.TraceTimed("Stellar.PostWithChainlink", func() error { return err })()

	uid := mctx.G().ActiveDevice.UID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}
	mctx.Debug("Stellar.PostWithChainLink: load self")
	loadMeArg := libkb.NewLoadUserArg(mctx.G()).
		WithNetContext(mctx.Ctx()).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	me, err := libkb.LoadUser(loadMeArg)
	if err != nil {
		return err
	}

	deviceSigKey, err := mctx.G().ActiveDevice.SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	pukGen, pukSeed, err := getLatestPuk(mctx.Ctx(), mctx.G())
	if err != nil {
		return err
	}

	payload, seqno, linkID, err := buildChainLinkPayload(mctx, clearBundle, me, pukGen, pukSeed, deviceSigKey)
	if err != nil {
		return err
	}

	mctx.Debug("Stellar.PostWithChainLink: post")
	_, err = mctx.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: *payload,
	})
	if err != nil {
		return err
	}
	if err = libkb.MerkleCheckPostedUserSig(mctx, uid, seqno, linkID); err != nil {
		return err
	}

	mctx.G().UserChanged(mctx.Ctx(), uid)
	return nil
}

// Post a bundle to the server.
func Post(mctx libkb.MetaContext, clearBundle stellar1.Bundle) (err error) {
	defer mctx.TraceTimed("Stellar.Post", func() error { return err })()

	err = clearBundle.CheckInvariants()
	if err != nil {
		return err
	}
	pukGen, pukSeed, err := getLatestPuk(mctx.Ctx(), mctx.G())
	if err != nil {
		return err
	}
	boxed, err := bundle.BoxAndEncode(&clearBundle, pukGen, pukSeed)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	section := make(libkb.JSONPayload)
	section["encrypted_parent"] = boxed.EncParentB64
	section["visible_parent"] = boxed.VisParentB64
	section["version_parent"] = boxed.FormatVersionParent
	section["account_bundles"] = boxed.AcctBundles
	payload["stellar"] = section
	_, err = mctx.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "stellar/acctbundle",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}

func fetchBundleForAccount(mctx libkb.MetaContext, accountID *stellar1.AccountID) (
	b *stellar1.Bundle, bv stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, accountGens bundle.AccountPukGens, err error) {
	defer mctx.TraceTimed("Stellar.fetchBundleForAccount", func() error { return err })()

	fetchArgs := libkb.HTTPArgs{}
	if accountID != nil {
		fetchArgs = libkb.HTTPArgs{"account_id": libkb.S{Val: string(*accountID)}}
	}
	apiArg := libkb.APIArg{
		Endpoint:       "stellar/acctbundle",
		SessionType:    libkb.APISessionTypeREQUIRED,
		Args:           fetchArgs,
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes fetchAcctRes
	if err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes); err != nil {
		return nil, 0, 0, accountGens, err
	}

	finder := &pukFinder{}
	b, bv, pukGen, accountGens, err = bundle.DecodeAndUnbox(mctx, finder, apiRes.BundleEncoded)
	if err != nil {
		return b, bv, pukGen, accountGens, err
	}
	mctx.G().GetStellar().InformBundle(mctx, b.Revision, b.Accounts)
	return b, bv, pukGen, accountGens, err
}

// FetchSecretlessBundle gets an account bundle from the server and decrypts it
// but without any specified AccountID and therefore no secrets (signers).
// This method is safe to be called by any of a user's devices even if one or more of
// the accounts is marked as mobile only.
func FetchSecretlessBundle(mctx libkb.MetaContext) (bundle *stellar1.Bundle, err error) {
	defer mctx.TraceTimed("Stellar.FetchSecretlessBundle", func() error { return err })()

	bundle, _, _, _, err = fetchBundleForAccount(mctx, nil)
	return bundle, err
}

// FetchAccountBundle gets a bundle from the server with all of the accounts
// in it, but it will only have the secrets for the specified accountID.
// This method will bubble up an error if it's called by a Desktop device for
// an account that is mobile only. If you don't need the secrets, use
// FetchSecretlessBundle instead.
func FetchAccountBundle(mctx libkb.MetaContext, accountID stellar1.AccountID) (bundle *stellar1.Bundle, err error) {
	defer mctx.TraceTimed("Stellar.FetchAccountBundle", func() error { return err })()

	bundle, _, _, _, err = fetchBundleForAccount(mctx, &accountID)
	return bundle, err
}

// FetchBundleWithGens gets a bundle with all of the secrets in it to which this device
// has access, i.e. if there are no mobile-only accounts, then this bundle will have
// all of the secrets. Also returned is a map of accountID->pukGen. Entries are only in the
// map for accounts with secrets in the bundle. Inaccessible accounts will be in the
// visible part of the parent bundle but not in the AccountBundle secrets nor in the
// AccountPukGens map. FetchBundleWithGens is only for very specific usecases.
// FetchAccountBundle and FetchSecretlessBundle are the preferred ways to pull a bundle.
func FetchBundleWithGens(mctx libkb.MetaContext) (b *stellar1.Bundle, pukGen keybase1.PerUserKeyGeneration, accountGens bundle.AccountPukGens, err error) {
	defer mctx.TraceTimed("Stellar.FetchBundleWithGens", func() error { return err })()

	b, _, pukGen, _, err = fetchBundleForAccount(mctx, nil) // this bundle no account secrets
	if err != nil {
		return nil, 0, bundle.AccountPukGens{}, err
	}
	accountGens = make(bundle.AccountPukGens)
	newAccBundles := make(map[stellar1.AccountID]stellar1.AccountBundle)
	for _, acct := range b.Accounts {
		singleBundle, _, _, singleAccountGens, err := fetchBundleForAccount(mctx, &acct.AccountID)
		if err != nil {
			// expected errors include SCStellarDeviceNotMobile, SCStellarMobileOnlyPurgatory
			mctx.Debug("unable to pull secrets for account %v which is not necessarily a problem %v", acct.AccountID, err)
			continue
		}
		accBundle := singleBundle.AccountBundles[acct.AccountID]
		newAccBundles[acct.AccountID] = accBundle
		accountGens[acct.AccountID] = singleAccountGens[acct.AccountID]
	}
	b.AccountBundles = newAccBundles
	err = b.CheckInvariants()
	if err != nil {
		return nil, 0, bundle.AccountPukGens{}, err
	}

	return b, pukGen, accountGens, nil
}

func getLatestPuk(ctx context.Context, g *libkb.GlobalContext) (pukGen keybase1.PerUserKeyGeneration, pukSeed libkb.PerUserKeySeed, err error) {
	pukring, err := g.GetPerUserKeyring(ctx)
	if err != nil {
		return pukGen, pukSeed, err
	}
	m := libkb.NewMetaContext(ctx, g)
	err = pukring.Sync(m)
	if err != nil {
		return pukGen, pukSeed, err
	}
	pukGen = pukring.CurrentGeneration()
	pukSeed, err = pukring.GetSeedByGeneration(m, pukGen)
	return pukGen, pukSeed, err
}

type fetchAcctRes struct {
	libkb.AppStatusEmbed
	bundle.BundleEncoded
}

type seqnoResult struct {
	libkb.AppStatusEmbed
	AccountSeqno string `json:"seqno"`
}

func AccountSeqno(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (uint64, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:        "stellar/accountseqno",
		SessionType:     libkb.APISessionTypeREQUIRED,
		Args:            libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var res seqnoResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return 0, err
	}

	seqno, err := strconv.ParseUint(res.AccountSeqno, 10, 64)
	if err != nil {
		return 0, err
	}

	return seqno, nil
}

type balancesResult struct {
	Status   libkb.AppStatus    `json:"status"`
	Balances []stellar1.Balance `json:"balances"`
}

func (b *balancesResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func Balances(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:        "stellar/balances",
		SessionType:     libkb.APISessionTypeREQUIRED,
		Args:            libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var res balancesResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return nil, err
	}

	return res.Balances, nil
}

type detailsResult struct {
	Status  libkb.AppStatus         `json:"status"`
	Details stellar1.AccountDetails `json:"details"`
}

func (b *detailsResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func Details(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	// the endpoint requires the account_id parameter, so check it exists
	if strings.TrimSpace(accountID.String()) == "" {
		return stellar1.AccountDetails{}, ErrAccountIDMissing
	}
	mctx := libkb.NewMetaContext(ctx, g)

	apiArg := libkb.APIArg{
		Endpoint:    "stellar/details",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id":       libkb.S{Val: string(accountID)},
			"include_multi":    libkb.B{Val: true},
			"include_advanced": libkb.B{Val: true},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var res detailsResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return stellar1.AccountDetails{}, err
	}
	res.Details.SetDefaultDisplayCurrency()

	return res.Details, nil
}

type submitResult struct {
	libkb.AppStatusEmbed
	PaymentResult stellar1.PaymentResult `json:"payment_result"`
}

func SubmitPayment(ctx context.Context, g *libkb.GlobalContext, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitpayment",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res submitResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return stellar1.PaymentResult{}, err
	}
	return res.PaymentResult, nil
}

func SubmitRelayPayment(ctx context.Context, g *libkb.GlobalContext, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error) {
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitrelaypayment",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res submitResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return stellar1.PaymentResult{}, err
	}
	return res.PaymentResult, nil
}

type submitMultiResult struct {
	libkb.AppStatusEmbed
	SubmitMultiRes stellar1.SubmitMultiRes `json:"submit_multi_result"`
}

func SubmitMultiPayment(ctx context.Context, g *libkb.GlobalContext, post stellar1.PaymentMultiPost) (stellar1.SubmitMultiRes, error) {
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitmultipayment",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res submitMultiResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return stellar1.SubmitMultiRes{}, err
	}
	return res.SubmitMultiRes, nil
}

type submitClaimResult struct {
	libkb.AppStatusEmbed
	RelayClaimResult stellar1.RelayClaimResult `json:"claim_result"`
}

func SubmitRelayClaim(ctx context.Context, g *libkb.GlobalContext, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	payload := make(libkb.JSONPayload)
	payload["claim"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitrelayclaim",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res submitClaimResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return stellar1.RelayClaimResult{}, err
	}
	return res.RelayClaimResult, nil
}

type acquireAutoClaimLockResult struct {
	libkb.AppStatusEmbed
	Result string `json:"result"`
}

func AcquireAutoClaimLock(ctx context.Context, g *libkb.GlobalContext) (string, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/acquireautoclaimlock",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var res acquireAutoClaimLockResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return "", err
	}
	return res.Result, nil
}

func ReleaseAutoClaimLock(ctx context.Context, g *libkb.GlobalContext, token string) error {
	payload := make(libkb.JSONPayload)
	payload["token"] = token
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/releaseautoclaimlock",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res libkb.AppStatusEmbed
	mctx := libkb.NewMetaContext(ctx, g)
	return g.API.PostDecode(mctx, apiArg, &res)
}

type nextAutoClaimResult struct {
	libkb.AppStatusEmbed
	Result *stellar1.AutoClaim `json:"result"`
}

func NextAutoClaim(ctx context.Context, g *libkb.GlobalContext) (*stellar1.AutoClaim, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/nextautoclaim",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var res nextAutoClaimResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return nil, err
	}
	return res.Result, nil
}

type recentPaymentsResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentsPage `json:"res"`
}

func RecentPayments(ctx context.Context, g *libkb.GlobalContext, arg RecentPaymentsArg) (stellar1.PaymentsPage, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/recentpayments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id":       libkb.S{Val: arg.AccountID.String()},
			"limit":            libkb.I{Val: arg.Limit},
			"skip_pending":     libkb.B{Val: arg.SkipPending},
			"include_multi":    libkb.B{Val: true},
			"include_advanced": libkb.B{Val: arg.IncludeAdvanced},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	if arg.Cursor != nil {
		apiArg.Args["horizon_cursor"] = libkb.S{Val: arg.Cursor.HorizonCursor}
		apiArg.Args["direct_cursor"] = libkb.S{Val: arg.Cursor.DirectCursor}
		apiArg.Args["relay_cursor"] = libkb.S{Val: arg.Cursor.RelayCursor}
	}

	var apiRes recentPaymentsResult
	err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	return apiRes.Result, err
}

type pendingPaymentsResult struct {
	libkb.AppStatusEmbed
	Result []stellar1.PaymentSummary `json:"res"`
}

func PendingPayments(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/pendingpayments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: accountID.String()},
			"limit":      libkb.I{Val: limit},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var apiRes pendingPaymentsResult
	err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	return apiRes.Result, err
}

type paymentDetailResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentDetails `json:"res"`
}

func PaymentDetails(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID, txID string) (res stellar1.PaymentDetails, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/paymentdetail",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
			"txID":       libkb.S{Val: txID},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var apiRes paymentDetailResult
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	return apiRes.Result, err
}

func PaymentDetailsGeneric(ctx context.Context, g *libkb.GlobalContext, txID string) (res stellar1.PaymentDetails, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/paymentdetail",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"txID": libkb.S{Val: txID},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var apiRes paymentDetailResult
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	return apiRes.Result, err
}

type tickerResult struct {
	libkb.AppStatusEmbed
	Price      string        `json:"price"`
	PriceInBTC string        `json:"xlm_btc"`
	CachedAt   keybase1.Time `json:"cached_at"`
	URL        string        `json:"url"`
	Currency   string        `json:"currency"`
}

func ExchangeRate(ctx context.Context, g *libkb.GlobalContext, currency string) (stellar1.OutsideExchangeRate, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/ticker",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"currency": libkb.S{Val: currency},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var apiRes tickerResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes); err != nil {
		return stellar1.OutsideExchangeRate{}, err
	}
	return stellar1.OutsideExchangeRate{
		Currency: stellar1.OutsideCurrencyCode(apiRes.Currency),
		Rate:     apiRes.Price,
	}, nil
}

type accountCurrencyResult struct {
	libkb.AppStatusEmbed
	CurrencyDisplayPreference string `json:"currency_display_preference"`
}

func GetAccountDisplayCurrency(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (string, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	if strings.TrimSpace(accountID.String()) == "" {
		return "", ErrAccountIDMissing
	}

	// NOTE: If you are calling this, you might want to call
	// stellar.GetAccountDisplayCurrency instead which checks for
	// NULLs and returns a sane default ("USD").
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
		},
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes accountCurrencyResult
	err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	return apiRes.CurrencyDisplayPreference, err
}

func SetAccountDefaultCurrency(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID,
	currency string) error {
	mctx := libkb.NewMetaContext(ctx, g)

	conf, err := mctx.G().GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return err
	}
	if _, ok := conf.Currencies[stellar1.OutsideCurrencyCode(currency)]; !ok {
		return fmt.Errorf("Unknown currency code: %q", currency)
	}
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
			"currency":   libkb.S{Val: currency},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	mctx.G().GetStellar().InformDefaultCurrencyChange(mctx)
	return err
}

type disclaimerResult struct {
	libkb.AppStatusEmbed
	AcceptedDisclaimer bool `json:"accepted_disclaimer"`
}

func GetAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) (ret bool, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:       "stellar/disclaimer",
		SessionType:    libkb.APISessionTypeREQUIRED,
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes disclaimerResult
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return ret, err
	}
	return apiRes.AcceptedDisclaimer, nil
}

func SetAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) error {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/disclaimer",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	_, err := mctx.G().API.Post(mctx, apiArg)
	return err
}

type submitRequestResult struct {
	libkb.AppStatusEmbed
	RequestID stellar1.KeybaseRequestID `json:"request_id"`
}

func SubmitRequest(ctx context.Context, g *libkb.GlobalContext, post stellar1.RequestPost) (ret stellar1.KeybaseRequestID, err error) {
	payload := make(libkb.JSONPayload)
	payload["request"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitrequest",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res submitRequestResult
	mctx := libkb.NewMetaContext(ctx, g)
	if err := g.API.PostDecode(mctx, apiArg, &res); err != nil {
		return ret, err
	}
	return res.RequestID, nil
}

type requestDetailsResult struct {
	libkb.AppStatusEmbed
	Request stellar1.RequestDetails `json:"request"`
}

func RequestDetails(ctx context.Context, g *libkb.GlobalContext, requestID stellar1.KeybaseRequestID) (ret stellar1.RequestDetails, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/requestdetails",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"id": libkb.S{Val: requestID.String()},
		},
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var res requestDetailsResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return ret, err
	}
	return res.Request, nil
}

func CancelRequest(ctx context.Context, g *libkb.GlobalContext, requestID stellar1.KeybaseRequestID) (err error) {
	payload := make(libkb.JSONPayload)
	payload["id"] = requestID
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/cancelrequest",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res libkb.AppStatusEmbed
	mctx := libkb.NewMetaContext(ctx, g)
	return g.API.PostDecode(mctx, apiArg, &res)
}

func MarkAsRead(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	payload := make(libkb.JSONPayload)
	payload["account_id"] = accountID
	payload["most_recent_id"] = mostRecentID
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/markasread",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res libkb.AppStatusEmbed
	mctx := libkb.NewMetaContext(ctx, g)
	return g.API.PostDecode(mctx, apiArg, &res)
}

func IsAccountMobileOnly(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (bool, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	bundle, err := FetchSecretlessBundle(mctx)
	if err != nil {
		return false, err
	}
	for _, account := range bundle.Accounts {
		if account.AccountID == accountID {
			return account.Mode == stellar1.AccountMode_MOBILE, nil
		}
	}
	err = libkb.AppStatusError{
		Code: libkb.SCStellarMissingAccount,
		Desc: "account does not exist for user",
	}
	return false, err
}

// SetAccountMobileOnly will fetch the account bundle and flip the mobile-only switch,
// then send the new account bundle revision to the server.
func SetAccountMobileOnly(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) error {
	mctx := libkb.NewMetaContext(ctx, g)
	b, err := FetchAccountBundle(mctx, accountID)
	if err != nil {
		return err
	}
	err = bundle.MakeMobileOnly(b, accountID)
	if err == bundle.ErrNoChangeNecessary {
		g.Log.CDebugf(ctx, "SetAccountMobileOnly account %s is already mobile-only", accountID)
		return nil
	}
	if err != nil {
		return err
	}
	nextBundle := bundle.AdvanceAccounts(*b, []stellar1.AccountID{accountID})
	if err := Post(mctx, nextBundle); err != nil {
		mctx.Debug("SetAccountMobileOnly Post error: %s", err)
		return err
	}

	return nil
}

// MakeAccountAllDevices will fetch the account bundle and flip the mobile-only switch to off
// (so that any device can get the account secret keys) then send the new account bundle
// to the server.
func MakeAccountAllDevices(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) error {
	mctx := libkb.NewMetaContext(ctx, g)
	b, err := FetchAccountBundle(mctx, accountID)
	if err != nil {
		return err
	}
	err = bundle.MakeAllDevices(b, accountID)
	if err == bundle.ErrNoChangeNecessary {
		g.Log.CDebugf(ctx, "MakeAccountAllDevices account %s is already in all-device mode", accountID)
		return nil
	}
	if err != nil {
		return err
	}
	nextBundle := bundle.AdvanceAccounts(*b, []stellar1.AccountID{accountID})
	if err := Post(mctx, nextBundle); err != nil {
		mctx.Debug("MakeAccountAllDevices Post error: %s", err)
		return err
	}

	return nil
}

type lookupUnverifiedResult struct {
	libkb.AppStatusEmbed
	Users []struct {
		UID         keybase1.UID   `json:"uid"`
		EldestSeqno keybase1.Seqno `json:"eldest_seqno"`
	} `json:"users"`
}

func LookupUnverified(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (ret []keybase1.UserVersion, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/lookup",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: accountID.String()},
		},
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var res lookupUnverifiedResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return ret, err
	}
	for _, user := range res.Users {
		ret = append(ret, keybase1.NewUserVersion(user.UID, user.EldestSeqno))
	}
	return ret, nil
}

// pukFinder implements the bundle.PukFinder interface.
type pukFinder struct{}

func (p *pukFinder) SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error) {
	pukring, err := m.G().GetPerUserKeyring(m.Ctx())
	if err != nil {
		return libkb.PerUserKeySeed{}, err
	}

	return pukring.GetSeedByGenerationOrSync(m, generation)
}

type serverTimeboundsRes struct {
	libkb.AppStatusEmbed
	stellar1.TimeboundsRecommendation
}

func ServerTimeboundsRecommendation(ctx context.Context, g *libkb.GlobalContext) (ret stellar1.TimeboundsRecommendation, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/timebounds",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
		RetryCount:  3,
	}
	var res serverTimeboundsRes
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return ret, err
	}
	return res.TimeboundsRecommendation, nil
}

func SetInflationDestination(ctx context.Context, g *libkb.GlobalContext, signedTx string) (err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/setinflation",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig": libkb.S{Val: signedTx},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

type getInflationDestinationsRes struct {
	libkb.AppStatusEmbed
	Destinations []stellar1.PredefinedInflationDestination `json:"destinations"`
}

func GetInflationDestinations(ctx context.Context, g *libkb.GlobalContext) (ret []stellar1.PredefinedInflationDestination, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/inflation_destinations",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var apiRes getInflationDestinationsRes
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return ret, err
	}
	return apiRes.Destinations, nil
}

type networkOptionsRes struct {
	libkb.AppStatusEmbed
	Options stellar1.NetworkOptions
}

func NetworkOptions(ctx context.Context, g *libkb.GlobalContext) (stellar1.NetworkOptions, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/network_options",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var apiRes networkOptionsRes
	if err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes); err != nil {
		return stellar1.NetworkOptions{}, err
	}
	return apiRes.Options, nil
}

type detailsPlusPaymentsRes struct {
	libkb.AppStatusEmbed
	Result stellar1.DetailsPlusPayments `json:"res"`
}

func DetailsPlusPayments(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.DetailsPlusPayments, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/details_plus_payments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id":       libkb.S{Val: accountID.String()},
			"include_advanced": libkb.B{Val: true},
		},
	}
	var apiRes detailsPlusPaymentsRes
	if err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes); err != nil {
		return stellar1.DetailsPlusPayments{}, err
	}
	return apiRes.Result, nil
}

type airdropDetails struct {
	libkb.AppStatusEmbed
	Details    json.RawMessage `json:"details"`
	Disclaimer json.RawMessage `json:"disclaimer"`
	IsPromoted bool            `json:"is_promoted"`
}

func AirdropDetails(mctx libkb.MetaContext) (bool, string, string, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/airdrop/details",
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	var res airdropDetails
	if err := mctx.G().API.GetDecode(mctx, apiArg, &res); err != nil {
		return false, "", "", err
	}

	return res.IsPromoted, string(res.Details), string(res.Disclaimer), nil
}

func AirdropRegister(mctx libkb.MetaContext, register bool) error {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/airdrop/register",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"remove": libkb.B{Val: !register},
		},
	}
	_, err := mctx.G().API.Post(mctx, apiArg)
	return err
}

type AirConfig struct {
	MinActiveDevices        int    `json:"min_active_devices"`
	MinActiveDevicesTitle   string `json:"min_active_devices_title"`
	AccountCreationTitle    string `json:"account_creation_title"`
	AccountCreationSubtitle string `json:"account_creation_subtitle"`
	AccountUsed             string `json:"account_used"`
}

type AirSvc struct {
	Qualifies     bool   `json:"qualifies"`
	IsOldEnough   bool   `json:"is_old_enough"`
	IsUsedAlready bool   `json:"is_used_already"`
	Username      string `json:"service_username"`
}

type AirQualifications struct {
	QualifiesOverall bool              `json:"qualifies_overall"`
	HasEnoughDevices bool              `json:"has_enough_devices"`
	ServiceChecks    map[string]AirSvc `json:"service_checks"`
}

type AirdropStatusAPI struct {
	libkb.AppStatusEmbed
	AlreadyRegistered bool              `json:"already_registered"`
	Qualifications    AirQualifications `json:"qualifications"`
	AirdropConfig     AirConfig         `json:"airdrop_cfg"`
}

func AirdropStatus(mctx libkb.MetaContext) (AirdropStatusAPI, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/airdrop/status_check",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var status AirdropStatusAPI
	if err := mctx.G().API.GetDecode(mctx, apiArg, &status); err != nil {
		return AirdropStatusAPI{}, err
	}
	return status, nil
}

func ChangeTrustline(ctx context.Context, g *libkb.GlobalContext, signedTx string) (err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/change_trustline",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig": libkb.S{Val: signedTx},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

type findPaymentPathResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentPath `json:"result"`
}

func FindPaymentPath(mctx libkb.MetaContext, query stellar1.PaymentPathQuery) (stellar1.PaymentPath, error) {
	payload := make(libkb.JSONPayload)
	payload["query"] = query
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/findpaymentpath",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}

	var res findPaymentPathResult
	if err := mctx.G().API.PostDecode(mctx, apiArg, &res); err != nil {
		return stellar1.PaymentPath{}, err
	}
	return res.Result, nil
}

func SubmitPathPayment(mctx libkb.MetaContext, post stellar1.PathPaymentPost) (stellar1.PaymentResult, error) {
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitpathpayment",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res submitResult
	if err := mctx.G().API.PostDecode(mctx, apiArg, &res); err != nil {
		return stellar1.PaymentResult{}, err
	}
	return res.PaymentResult, nil
}

func PostAnyTransaction(mctx libkb.MetaContext, signedTx string) (err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/postanytransaction",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig": libkb.S{Val: signedTx},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

type fuzzyAssetSearchResult struct {
	libkb.AppStatusEmbed
	Assets []stellar1.Asset `json:"matches"`
}

func FuzzyAssetSearch(mctx libkb.MetaContext, arg stellar1.FuzzyAssetSearchArg) ([]stellar1.Asset, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/fuzzy_asset_search",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"search_string": libkb.S{Val: arg.SearchString},
		},
	}
	var apiRes fuzzyAssetSearchResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes); err != nil {
		return []stellar1.Asset{}, err
	}
	return apiRes.Assets, nil
}

type popularAssetsResult struct {
	libkb.AppStatusEmbed
	Assets     []stellar1.Asset `json:"assets"`
	TotalCount int              `json:"totalCount"`
}

func ListPopularAssets(mctx libkb.MetaContext, arg stellar1.ListPopularAssetsArg) (stellar1.AssetListResult, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/list_popular_assets",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
	}
	var apiRes popularAssetsResult
	if err := mctx.G().API.GetDecode(mctx, apiArg, &apiRes); err != nil {
		return stellar1.AssetListResult{}, err
	}
	return stellar1.AssetListResult{
		Assets:     apiRes.Assets,
		TotalCount: apiRes.TotalCount,
	}, nil
}
