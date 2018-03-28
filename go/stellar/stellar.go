package stellar

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/remote"
)

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func CreateWallet(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.CreateWallet", func() error { return err })()
	// TODO: short-circuit if the user has a bundle already
	clearBundle, err := bundle.NewInitialBundle()
	if err != nil {
		return created, err
	}
	err = remote.PostWithChainlink(ctx, g, clearBundle)
	switch e := err.(type) {
	case nil:
		// ok
	case libkb.AppStatusError:
		switch keybase1.StatusCode(e.Code) {
		case keybase1.StatusCode_SCStellarWrongRevision:
			// Assume this happened because a bundle already existed.
			// And suppress the error.
			g.Log.CDebugf(ctx, "suppressing error: %v", err)
			return false, nil
		}
		return false, err
	default:
		return false, err
	}
	return true, err
}

func CreateWalletGated(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.CreateWalletGated", func() error { return err })()
	// TODO: short-circuit if the user has a bundle already
	should, err := remote.ShouldCreate(ctx, g)
	if err != nil {
		return false, err
	}
	if !should {
		g.Log.CDebugf(ctx, "server did not recommend wallet creation")
		return false, nil
	}
	return CreateWallet(ctx, g)
}

// Upkeep makes sure the bundle is encrypted for the user's latest PUK.
func Upkeep(ctx context.Context, g *libkb.GlobalContext) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.Upkeep", func() error { return err })()
	pukring, err := g.GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(ctx)
	if err != nil {
		return err
	}
	prevBundle, prevPukGen, err := remote.Fetch(ctx, g)
	pukGen := pukring.CurrentGeneration()
	if pukGen <= prevPukGen {
		g.Log.CDebugf(ctx, "Stellar.Upkeep: early out prevPukGen:%v < pukGen:%v", prevPukGen, pukGen)
		return nil
	}
	nextBundle := bundle.Advance(prevBundle)
	return remote.Post(ctx, g, nextBundle)
}
