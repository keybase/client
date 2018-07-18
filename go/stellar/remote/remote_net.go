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

func (r *RemoteNet) Details(ctx context.Context, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	return Details(ctx, r.G(), accountID)
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

func (r *RemoteNet) AcquireAutoClaimLock(ctx context.Context) (string, error) {
	return AcquireAutoClaimLock(ctx, r.G())
}

func (r *RemoteNet) ReleaseAutoClaimLock(ctx context.Context, token string) error {
	return ReleaseAutoClaimLock(ctx, r.G(), token)
}

func (r *RemoteNet) NextAutoClaim(ctx context.Context) (*stellar1.AutoClaim, error) {
	return NextAutoClaim(ctx, r.G())
}

func (r *RemoteNet) RecentPayments(ctx context.Context, accountID stellar1.AccountID, cursor *stellar1.PageCursor, limit int) (stellar1.PaymentsPage, error) {
	return RecentPayments(ctx, r.G(), accountID, cursor, limit)
}

func (r *RemoteNet) PaymentDetails(ctx context.Context, txID string) (res stellar1.PaymentDetails, err error) {
	return PaymentDetails(ctx, r.G(), txID)
}

func (r *RemoteNet) GetAccountDisplayCurrency(ctx context.Context, accountID stellar1.AccountID) (string, error) {
	return GetAccountDisplayCurrency(ctx, r.G(), accountID)
}

func (r *RemoteNet) ExchangeRate(ctx context.Context, currency string) (stellar1.OutsideExchangeRate, error) {
	return ExchangeRate(ctx, r.G(), currency)
}

func (r *RemoteNet) SubmitRequest(ctx context.Context, post stellar1.RequestPost) (stellar1.KeybaseRequestID, error) {
	return SubmitRequest(ctx, r.G(), post)
}

func (r *RemoteNet) RequestDetails(ctx context.Context, requestID stellar1.KeybaseRequestID) (stellar1.RequestDetails, error) {
	return RequestDetails(ctx, r.G(), requestID)
}

func (r *RemoteNet) CancelRequest(ctx context.Context, requestID stellar1.KeybaseRequestID) error {
	return CancelRequest(ctx, r.G(), requestID)
}
