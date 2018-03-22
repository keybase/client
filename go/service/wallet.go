package service

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"

	// TODO remove these imports. They are just for testing vendoring.
	_ "github.com/stellar/go/keypair"
	_ "github.com/stellar/go/strkey"
)

type walletHandler struct {
	libkb.Contextified
	*BaseHandler
}

func newWalletHandler(xp rpc.Transporter, g *libkb.GlobalContext) *walletHandler {
	return &walletHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

type balancesResult struct {
	Status   libkb.AppStatus    `json:"status"`
	Balances []stellar1.Balance `json:"balances"`
}

func (b *balancesResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func (h *walletHandler) Balances(ctx context.Context, arg stellar1.BalancesArg) ([]stellar1.Balance, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/balances",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(arg.AccountID)}},
		NetContext:  ctx,
	}

	var res balancesResult
	if err := h.G().API.GetDecode(apiArg, &res); err != nil {
		return nil, err
	}

	return res.Balances, nil
}

func (h *walletHandler) RecentTransactions(ctx context.Context, arg stellar1.RecentTransactionsArg) ([]stellar1.TransactionSummary, error) {
	return nil, errors.New("not yet implemented")
}

func (h *walletHandler) Transaction(ctx context.Context, arg stellar1.TransactionArg) (stellar1.TransactionDetails, error) {
	return stellar1.TransactionDetails{}, errors.New("not yet implemented")
}

func (h *walletHandler) SubmitPayment(ctx context.Context, arg stellar1.SubmitPaymentArg) (stellar1.PaymentResult, error) {
	return stellar1.PaymentResult{}, errors.New("not yet implemented")
}
