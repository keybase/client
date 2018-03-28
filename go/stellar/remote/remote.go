package remote

import (
	"context"
	"errors"
	"fmt"

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
	if err != nil {
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
