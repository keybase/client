package stellarsvc

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/stellar"
)

// Service handlers

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func CreateWallet(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	return stellar.CreateWallet(ctx, g)
}
