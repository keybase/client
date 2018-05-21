package remote

import (
	"context"

	"github.com/keybase/client/go/protocol/stellar1"
)

type Remoter interface {
	AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error)
	Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error)
	Details(ctx context.Context, accountID stellar1.AccountID) (stellar1.AccountDetails, error)
	SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error)
	SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error)
	SubmitRelayClaim(context.Context, stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error)
	RecentPayments(ctx context.Context, accountID stellar1.AccountID, limit int) (res []stellar1.PaymentSummary, err error)
	PaymentDetail(ctx context.Context, txID string) (res stellar1.PaymentSummary, err error)
	GetAccountDisplayCurrency(ctx context.Context, accountID stellar1.AccountID) (string, error)
	ExchangeRate(ctx context.Context, currency string) (stellar1.OutsideExchangeRate, error)
}
