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
	Status       libkb.AppStatus `json:"status"`
	ShouldCreate bool            `json:"shouldcreate"`
}

func (r *shouldCreateRes) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

// ShouldCreate asks the server whether to create this user's initial wallet.
func ShouldCreate(ctx context.Context, g *libkb.GlobalContext) (should bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.ShouldCreate", func() error { return err })()
	arg := libkb.NewAPIArgWithNetContext(ctx, "stellar/shouldcreate")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes shouldCreateRes
	err = g.API.GetDecode(arg, &apiRes)
	return apiRes.ShouldCreate, err
}

// Post a bundle to the server with a chainlink.
func PostWithChainlink(ctx context.Context, g *libkb.GlobalContext, clearBundle stellar1.Bundle) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.PostWithChainlink", func() error { return err })()

	uid := g.ActiveDevice.UID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}
	g.Log.CDebugf(ctx, "Stellar.PostWithChainLink: load self")
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
	g.Log.CDebugf(ctx, "Stellar.PostWithChainLink: revision:%v accountID:%v pukGen:%v", clearBundle.Revision, stellarAccount.AccountID, pukGen)
	boxed, err := bundle.Box(clearBundle, pukGen, pukSeed)
	if err != nil {
		return err
	}

	g.Log.CDebugf(ctx, "Stellar.PostWithChainLink: make sigs")

	sig, err := libkb.StellarProofReverseSigned(me, stellarAccount.AccountID, stellarAccount.Signers[0], sigKey)
	if err != nil {
		return err
	}

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList

	addWalletServerArg(payload, boxed.EncB64, boxed.VisB64, int(boxed.FormatVersion))

	g.Log.CDebugf(ctx, "Stellar.PostWithChainLink: post")
	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
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
	err = pukring.Sync(ctx)
	if err != nil {
		return pukGen, pukSeed, err
	}
	pukGen = pukring.CurrentGeneration()
	pukSeed, err = pukring.GetSeedByGeneration(ctx, pukGen)
	return pukGen, pukSeed, err
}

type fetchRes struct {
	Status       libkb.AppStatus `json:"status"`
	EncryptedB64 string          `json:"encrypted"`
	VisibleB64   string          `json:"visible"`
}

func (r *fetchRes) GetAppStatus() *libkb.AppStatus {
	return &r.Status
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
			return res, 0, errors.New("logged-in user has no wallet accounts")
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
	err = pukring.Sync(ctx)
	if err != nil {
		return res, 0, err
	}
	puk, err := pukring.GetSeedByGeneration(ctx, decodeRes.Enc.Gen)
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
	Status       libkb.AppStatus `json:"status"`
	AccountSeqno string          `json:"seqno"`
}

func (s *seqnoResult) GetAppStatus() *libkb.AppStatus {
	return &s.Status
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

type submitResult struct {
	Status        libkb.AppStatus        `json:"status"`
	PaymentResult stellar1.PaymentResult `json:"payment_result"`
}

func (s *submitResult) GetAppStatus() *libkb.AppStatus {
	return &s.Status
}

func SubmitTransaction(ctx context.Context, g *libkb.GlobalContext, payload libkb.JSONPayload) (stellar1.PaymentResult, error) {
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

// TODO make status mixin
type recentPaymentsResult struct {
	Status libkb.AppStatus           `json:"status"`
	Result []stellar1.PaymentSummary `json:"res"`
}

func (s *recentPaymentsResult) GetAppStatus() *libkb.AppStatus {
	return &s.Status
}

func RecentPayments(ctx context.Context, g *libkb.GlobalContext,
	accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	payload := make(libkb.JSONPayload)
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/recentpayments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: accountID.String()},
			"limit":      libkb.I{Val: limit},
		},
		JSONPayload: payload,
		NetContext:  ctx,
	}
	var apiRes recentPaymentsResult
	err = g.API.GetDecode(apiArg, &apiRes)
	return apiRes.Result, err
}
