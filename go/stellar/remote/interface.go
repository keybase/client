package remote

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

type RecentPaymentsArg struct {
	AccountID       stellar1.AccountID
	Cursor          *stellar1.PageCursor
	Limit           int
	SkipPending     bool
	IncludeAdvanced bool
}

type Remoter interface {
	AccountSeqno(ctx context.Context, accountID stellar1.AccountID) (uint64, error)
	Balances(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error)
	Details(ctx context.Context, accountID stellar1.AccountID) (stellar1.AccountDetails, error)
	SubmitPayment(ctx context.Context, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error)
	SubmitRelayPayment(ctx context.Context, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error)
	SubmitRelayClaim(context.Context, stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error)
	SubmitPathPayment(mctx libkb.MetaContext, post stellar1.PathPaymentPost) (stellar1.PaymentResult, error)
	SubmitMultiPayment(ctx context.Context, post stellar1.PaymentMultiPost) (stellar1.SubmitMultiRes, error)
	AcquireAutoClaimLock(context.Context) (string, error)
	ReleaseAutoClaimLock(context.Context, string) error
	NextAutoClaim(context.Context) (*stellar1.AutoClaim, error)
	RecentPayments(ctx context.Context, arg RecentPaymentsArg) (stellar1.PaymentsPage, error)
	PendingPayments(ctx context.Context, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error)
	PaymentDetails(ctx context.Context, accountID stellar1.AccountID, txID string) (res stellar1.PaymentDetails, err error)
	PaymentDetailsGeneric(ctx context.Context, txID string) (res stellar1.PaymentDetails, err error)
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
	NetworkOptions(ctx context.Context) (stellar1.NetworkOptions, error)
	DetailsPlusPayments(ctx context.Context, accountID stellar1.AccountID) (stellar1.DetailsPlusPayments, error)
	ChangeTrustline(ctx context.Context, signedTx string) error
	FindPaymentPath(mctx libkb.MetaContext, query stellar1.PaymentPathQuery) (stellar1.PaymentPath, error)
	PostAnyTransaction(mctx libkb.MetaContext, signedTx string) error
	FuzzyAssetSearch(mctx libkb.MetaContext, arg stellar1.FuzzyAssetSearchArg) ([]stellar1.Asset, error)
	ListPopularAssets(mctx libkb.MetaContext, arg stellar1.ListPopularAssetsArg) (stellar1.AssetListResult, error)
}
