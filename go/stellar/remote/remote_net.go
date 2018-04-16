package remote

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

type RemoteNet struct {
	libkb.Contextified
}

func NewRemoteNet(g *libkb.GlobalContext) *RemoteNet {
	return &RemoteNet{Contextified: libkb.NewContextified(g)}
}

func (r *RemoteNet) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	return AccountSeqno(ctx, r.G(), accountID)
}

func (r *RemoteNet) Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	return Balances(ctx, r.G(), accountID)
}

func (r *RemoteNet) SubmitTransaction(ctx context.Context, payload libkb.JSONPayload) (stellar1.PaymentResult, error) {
	return SubmitTransaction(ctx, r.G(), payload)
}

func (r *RemoteNet) RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	return RecentPayments(ctx, r.G(), accountID, limit)
}
