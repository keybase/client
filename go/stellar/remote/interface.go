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
	AcquireAutoClaimLock(context.Context) (string, error)
	ReleaseAutoClaimLock(context.Context, string) error
	NextAutoClaim(context.Context) (*stellar1.AutoClaim, error)
	RecentPayments(ctx context.Context, accountID stellar1.AccountID, cursor *stellar1.PageCursor, limit int, skipPending bool) (stellar1.PaymentsPage, error)
	PendingPayments(ctx context.Context, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error)
	PaymentDetails(ctx context.Context, txID string) (res stellar1.PaymentDetails, err error)
	GetAccountDisplayCurrency(ctx context.Context, accountID stellar1.AccountID) (string, error)
	ExchangeRate(ctx context.Context, currency string) (stellar1.OutsideExchangeRate, error)
	SubmitRequest(ctx context.Context, post stellar1.RequestPost) (stellar1.KeybaseRequestID, error)
	RequestDetails(ctx context.Context, requestID stellar1.KeybaseRequestID) (stellar1.RequestDetails, error)
	CancelRequest(ctx context.Context, requestID stellar1.KeybaseRequestID) error
	MarkAsRead(ctx context.Context, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error
	IsAccountMobileOnly(ctx context.Context, accountID stellar1.AccountID) (bool, error)
	SetAccountMobileOnly(ctx context.Context, accountID stellar1.AccountID) error
	MakeAccountAllDevices(ctx context.Context, accountID stellar1.AccountID) error
	ServerTimeboundsRecommendation(ctx context.Context) (stellar1.TimeboundsRecommendation, error)
	SetInflationDestination(ctx context.Context, signedTx string) error
	GetInflationDestinations(ctx context.Context) (ret []stellar1.PredefinedInflationDestination, err error)
}
