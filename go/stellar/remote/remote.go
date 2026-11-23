package remote

import (
	"context"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
)

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
	defer mctx.Trace("Stellar.ShouldCreate", &err)()
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

// Post a bundle to the server.
func Post(mctx libkb.MetaContext, clearBundle stellar1.Bundle) (err error) {
	defer mctx.Trace("Stellar.Post", &err)()

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

type fetchAcctRes struct {
	libkb.AppStatusEmbed
	bundle.BundleEncoded
}

func fetchBundleForAccount(mctx libkb.MetaContext, accountID *stellar1.AccountID) (
	b *stellar1.Bundle, bv stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, accountGens bundle.AccountPukGens, err error,
) {
	defer mctx.Trace("Stellar.fetchBundleForAccount", &err)()

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
	return b, bv, pukGen, accountGens, err
}

// FetchSecretlessBundle gets an account bundle from the server and decrypts it
// but without any specified AccountID and therefore no secrets (signers).
// This method is safe to be called by any of a user's devices even if one or more of
// the accounts is marked as mobile only.
func FetchSecretlessBundle(mctx libkb.MetaContext) (bundle *stellar1.Bundle, err error) {
	defer mctx.Trace("Stellar.FetchSecretlessBundle", &err)()

	bundle, _, _, _, err = fetchBundleForAccount(mctx, nil)
	return bundle, err
}

// FetchAccountBundle gets a bundle from the server with all of the accounts
// in it, but it will only have the secrets for the specified accountID.
// This method will bubble up an error if it's called by a Desktop device for
// an account that is mobile only. If you don't need the secrets, use
// FetchSecretlessBundle instead.
func FetchAccountBundle(mctx libkb.MetaContext, accountID stellar1.AccountID) (bundle *stellar1.Bundle, err error) {
	defer mctx.Trace("Stellar.FetchAccountBundle", &err)()

	bundle, _, _, _, err = fetchBundleForAccount(mctx, &accountID)
	return bundle, err
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

// pukFinder implements the bundle.PukFinder interface.
type pukFinder struct{}

func (p *pukFinder) SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error) {
	pukring, err := m.G().GetPerUserKeyring(m.Ctx())
	if err != nil {
		return libkb.PerUserKeySeed{}, err
	}

	return pukring.GetSeedByGenerationOrSync(m, generation)
}
