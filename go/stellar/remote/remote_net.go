package remote

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

// RemoteNet is the real implementation of Remoter that talks to servers.
type RemoteNet struct {
	libkb.Contextified
}

var _ Remoter = (*RemoteNet)(nil)

func NewRemoteNet(g *libkb.GlobalContext) *RemoteNet {
	return &RemoteNet{Contextified: libkb.NewContextified(g)}
}

func (r *RemoteNet) AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error) {
	return AccountSeqno(ctx, r.G(), accountID)
}

func (r *RemoteNet) Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	return Balances(ctx, r.G(), accountID)
}

func (r *RemoteNet) SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
	return SubmitPayment(ctx, r.G(), post)
}

func (r *RemoteNet) SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error) {
	return SubmitRelayPayment(ctx, r.G(), post)
}

func (r *RemoteNet) SubmitRelayClaim(ctx context.Context, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	return SubmitRelayClaim(ctx, r.G(), post)
}

func (r *RemoteNet) RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error) {
	return RecentPayments(ctx, r.G(), accountID, limit)
}

func (r *RemoteNet) PaymentDetail(ctx context.Context, txID string) (res stellar1.PaymentSummary, err error) {
	return PaymentDetail(ctx, r.G(), txID)
}
