package client

import (
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type walletAPIHandler struct {
	libkb.Contextified
	cli    stellar1.LocalClient
	indent bool
}

func newWalletAPIHandler(g *libkb.GlobalContext, indentOutput bool) *walletAPIHandler {
	return &walletAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

func (w *walletAPIHandler) handle(ctx context.Context, c Call, wr io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return w.handleV1(ctx, c, wr)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

const (
	balancesMethod = "balances"
)

var validWalletMethodsV1 = map[string]bool{
	balancesMethod: true,
}

func (w *walletAPIHandler) handleV1(ctx context.Context, c Call, wr io.Writer) error {
	if !validWalletMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	cli, err := GetWalletClient(w.G())
	if err != nil {
		return err
	}
	w.cli = cli

	switch c.Method {
	case balancesMethod:
		return w.balances(ctx, c, wr)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

func (w *walletAPIHandler) balances(ctx context.Context, c Call, wr io.Writer) error {
	accounts, err := w.cli.WalletGetAccountsCLILocal(ctx)
	if err != nil {
		return err
	}
	_ = accounts
	return nil
}
