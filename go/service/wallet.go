package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
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

func (h *walletHandler) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/balances",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:  ctx,
	}

	var res balancesResult
	if err := h.G().API.GetDecode(apiArg, &res); err != nil {
		return nil, err
	}

	return res.Balances, nil
}
