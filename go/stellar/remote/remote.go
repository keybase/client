package remote

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
)

type shouldCreateRes struct {
	libkb.AppStatusEmbed
	ShouldCreate bool `json:"shouldcreate"`
	HasWallet    bool `json:"haswallet"`
}

// ShouldCreate asks the server whether to create this user's initial wallet.
func ShouldCreate(ctx context.Context, g *libkb.GlobalContext) (shouldCreate, hasWallet bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.ShouldCreate", func() error { return err })()
	arg := libkb.NewAPIArgWithNetContext(ctx, "stellar/shouldcreate")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes shouldCreateRes
	err = g.API.GetDecode(arg, &apiRes)
	return apiRes.ShouldCreate, apiRes.HasWallet, err
}

// Post a bundle to the server with a chainlink.
func PostWithChainlink(ctx context.Context, g *libkb.GlobalContext, clearBundle stellar1.Bundle) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.PostWithChainlink", func() error { return err })()

	m := libkb.NewMetaContext(ctx, g)

	uid := g.ActiveDevice.UID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}
	m.CDebugf("Stellar.PostWithChainLink: load self")
	loadMeArg := libkb.NewLoadUserArg(g).
		WithNetContext(ctx).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	me, err := libkb.LoadUser(loadMeArg)
	if err != nil {
		return err
	}

	sigKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	pukGen, pukSeed, err := getLatestPuk(ctx, g)
	if err != nil {
		return err
	}

	err = clearBundle.CheckInvariants()
	if err != nil {
		return err
	}
	// Find the new primary account for the chain link.
	if len(clearBundle.Accounts) < 1 {
		return errors.New("stellar bundle has no accounts")
	}
	stellarAccount, err := clearBundle.PrimaryAccount()
	if err != nil {
		return err
	}
	if len(stellarAccount.Signers) < 1 {
		return errors.New("stellar bundle has no signers")
	}
	if !stellarAccount.IsPrimary {
		return errors.New("initial stellar account is not primary")
	}
	m.CDebugf("Stellar.PostWithChainLink: revision:%v accountID:%v pukGen:%v", clearBundle.Revision, stellarAccount.AccountID, pukGen)
	boxed, err := bundle.Box(clearBundle, pukGen, pukSeed)
	if err != nil {
		return err
	}

	m.CDebugf("Stellar.PostWithChainLink: make sigs")

	sig, err := libkb.StellarProofReverseSigned(m, me, stellarAccount.AccountID, stellarAccount.Signers[0], sigKey)
	if err != nil {
		return err
	}

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList

	addWalletServerArg(payload, boxed.EncB64, boxed.VisB64, int(boxed.FormatVersion))

	m.CDebugf("Stellar.PostWithChainLink: post")
	_, err = m.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		MetaContext: m,
	})
	if err != nil {
		return err
	}

	g.UserChanged(uid)
	return nil
}

// Post a bundle to the server.
func Post(ctx context.Context, g *libkb.GlobalContext, clearBundle stellar1.Bundle) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.Post", func() error { return err })()
	pukGen, pukSeed, err := getLatestPuk(ctx, g)
	if err != nil {
		return err
	}
	err = clearBundle.CheckInvariants()
	if err != nil {
		return err
	}
	g.Log.CDebugf(ctx, "Stellar.Post: revision:%v", clearBundle.Revision)
	boxed, err := bundle.Box(clearBundle, pukGen, pukSeed)
	if err != nil {
		return err
	}
	payload := make(libkb.JSONPayload)
	addWalletServerArg(payload, boxed.EncB64, boxed.VisB64, int(boxed.FormatVersion))
	g.Log.CDebugf(ctx, "Stellar.Post: post")
	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "stellar/bundle",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}

func getLatestPuk(ctx context.Context, g *libkb.GlobalContext) (pukGen keybase1.PerUserKeyGeneration, pukSeed libkb.PerUserKeySeed, err error) {
	pukring, err := g.GetPerUserKeyring()
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

type UserHasNoAccountsError struct{}

func (e UserHasNoAccountsError) Error() string {
	return "logged-in user has no wallet accounts"
}

type fetchRes struct {
	libkb.AppStatusEmbed
	EncryptedB64 string `json:"encrypted"`
	VisibleB64   string `json:"visible"`
}

// Fetch and unbox the latest bundle from the server.
func Fetch(ctx context.Context, g *libkb.GlobalContext) (res stellar1.Bundle, pukGen keybase1.PerUserKeyGeneration, err error) {
	defer g.CTraceTimed(ctx, "Stellar.Fetch", func() error { return err })()
	arg := libkb.NewAPIArgWithNetContext(ctx, "stellar/bundle")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes fetchRes
	err = g.API.GetDecode(arg, &apiRes)
	switch err := err.(type) {
	case nil:
	case libkb.AppStatusError:
		switch keybase1.StatusCode(err.Code) {
		case keybase1.StatusCode_SCNotFound:
			g.Log.CDebugf(ctx, "replacing error: %v", err)
			return res, 0, UserHasNoAccountsError{}
		}
	default:
		return res, 0, err
	}
	decodeRes, err := bundle.Decode(apiRes.EncryptedB64)
	if err != nil {
		return res, 0, err
	}
	pukring, err := g.GetPerUserKeyring()
	if err != nil {
		return res, 0, err
	}
	m := libkb.NewMetaContext(ctx, g)
	puk, err := pukring.GetSeedByGenerationOrSync(m, decodeRes.Enc.Gen)
	if err != nil {
		return res, 0, err
	}
	res, _, err = bundle.Unbox(decodeRes, apiRes.VisibleB64, puk)
	return res, decodeRes.Enc.Gen, err
}

// Make the "stellar" section of an API arg.
// Modifies `serverArg`.
func addWalletServerArg(serverArg libkb.JSONPayload, bundleEncB64 string, bundleVisB64 string, formatVersion int) {
	section := make(libkb.JSONPayload)
	section["encrypted"] = bundleEncB64
	section["visible"] = bundleVisB64
	section["version"] = formatVersion
	serverArg["stellar"] = section
}

type seqnoResult struct {
	libkb.AppStatusEmbed
	AccountSeqno string `json:"seqno"`
}

func AccountSeqno(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (uint64, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountseqno",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:  ctx,
	}

	var res seqnoResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
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
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/balances",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:  ctx,
	}

	var res balancesResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
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
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/details",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:  ctx,
	}

	var res detailsResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return stellar1.AccountDetails{}, err
	}

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
		NetContext:  ctx,
	}
	var res submitResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
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
		NetContext:  ctx,
	}
	var res submitResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return stellar1.PaymentResult{}, err
	}
	return res.PaymentResult, nil
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
		NetContext:  ctx,
	}
	var res submitClaimResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
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
		NetContext:  ctx,
	}
	var res acquireAutoClaimLockResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
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
		NetContext:  ctx,
	}
	var res libkb.AppStatusEmbed
	return g.API.PostDecode(apiArg, &res)
}

type nextAutoClaimResult struct {
	libkb.AppStatusEmbed
	Result *stellar1.AutoClaim `json:"result"`
}

func NextAutoClaim(ctx context.Context, g *libkb.GlobalContext) (*stellar1.AutoClaim, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/nextautoclaim",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}
	var res nextAutoClaimResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return nil, err
	}
	return res.Result, nil
}

type recentPaymentsResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentsPage `json:"res"`
}

func RecentPayments(ctx context.Context, g *libkb.GlobalContext,
	accountID stellar1.AccountID, cursor *stellar1.PageCursor, limit int) (stellar1.PaymentsPage, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/recentpayments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: accountID.String()},
			"limit":      libkb.I{Val: limit},
		},
		NetContext: ctx,
	}

	if cursor != nil {
		apiArg.Args["horizon_cursor"] = libkb.S{Val: cursor.HorizonCursor}
		apiArg.Args["direct_cursor"] = libkb.S{Val: cursor.DirectCursor}
		apiArg.Args["relay_cursor"] = libkb.S{Val: cursor.RelayCursor}
	}

	var apiRes recentPaymentsResult
	err := g.API.GetDecode(apiArg, &apiRes)
	return apiRes.Result, err
}

type paymentDetailResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentDetails `json:"res"`
}

func PaymentDetails(ctx context.Context, g *libkb.GlobalContext, txID string) (res stellar1.PaymentDetails, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/paymentdetail",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"txID": libkb.S{Val: txID},
		},
		NetContext: ctx,
	}
	var apiRes paymentDetailResult
	err = g.API.GetDecode(apiArg, &apiRes)
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
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/ticker",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"currency": libkb.S{Val: currency},
		},
		NetContext: ctx,
	}
	var apiRes tickerResult
	if err := g.API.GetDecode(apiArg, &apiRes); err != nil {
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
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
		},
		NetContext: ctx,
	}
	var apiRes accountCurrencyResult
	err := g.API.GetDecode(apiArg, &apiRes)
	return apiRes.CurrencyDisplayPreference, err
}

func SetAccountDefaultCurrency(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID,
	currency string) error {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
			"currency":   libkb.S{Val: currency},
		},
		NetContext: ctx,
	}
	_, err := g.API.Post(apiArg)
	return err
}

type disclaimerResult struct {
	libkb.AppStatusEmbed
	AcceptedDisclaimer bool `json:"accepted_disclaimer"`
}

func GetAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) (ret bool, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/disclaimer",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}
	var apiRes disclaimerResult
	err = g.API.GetDecode(apiArg, &apiRes)
	if err != nil {
		return ret, err
	}
	return apiRes.AcceptedDisclaimer, nil
}

func SetAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) error {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/disclaimer",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}
	_, err := g.API.Post(apiArg)
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
		NetContext:  ctx,
	}
	var res submitRequestResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return ret, err
	}
	return res.RequestID, nil
}

type requestDetailsResult struct {
	libkb.AppStatusEmbed
	Request stellar1.RequestDetails `json:"request"`
}

func RequestDetails(ctx context.Context, g *libkb.GlobalContext, requestID stellar1.KeybaseRequestID) (ret stellar1.RequestDetails, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/requestdetails",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"id": libkb.S{Val: requestID.String()},
		},
		NetContext: ctx,
	}
	var res requestDetailsResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
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
		NetContext:  ctx,
	}
	var res libkb.AppStatusEmbed
	return g.API.PostDecode(apiArg, &res)
}
