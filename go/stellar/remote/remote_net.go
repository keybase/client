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

func (r *RemoteNet) SubmitPathPayment(mctx libkb.MetaContext, post stellar1.PathPaymentPost) (stellar1.PaymentResult, error) {
	return SubmitPathPayment(mctx, post)
}

func (r *RemoteNet) SubmitMultiPayment(ctx context.Context, post stellar1.PaymentMultiPost) (stellar1.SubmitMultiRes, error) {
	return SubmitMultiPayment(ctx, r.G(), post)
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

func (r *RemoteNet) RecentPayments(ctx context.Context, arg RecentPaymentsArg) (stellar1.PaymentsPage, error) {
	return RecentPayments(ctx, r.G(), arg)
}

func (r *RemoteNet) PendingPayments(ctx context.Context, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error) {
	return PendingPayments(ctx, r.G(), accountID, limit)
}

func (r *RemoteNet) PaymentDetails(ctx context.Context, accountID stellar1.AccountID, txID string) (res stellar1.PaymentDetails, err error) {
	return PaymentDetails(ctx, r.G(), accountID, txID)
}

func (r *RemoteNet) PaymentDetailsGeneric(ctx context.Context, txID string) (res stellar1.PaymentDetails, err error) {
	return PaymentDetailsGeneric(ctx, r.G(), txID)
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

func (r *RemoteNet) MarkAsRead(ctx context.Context, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	return MarkAsRead(ctx, r.G(), accountID, mostRecentID)
}

func (r *RemoteNet) IsAccountMobileOnly(ctx context.Context, accountID stellar1.AccountID) (bool, error) {
	return IsAccountMobileOnly(ctx, r.G(), accountID)
}

func (r *RemoteNet) SetAccountMobileOnly(ctx context.Context, accountID stellar1.AccountID) error {
	return SetAccountMobileOnly(ctx, r.G(), accountID)
}

func (r *RemoteNet) MakeAccountAllDevices(ctx context.Context, accountID stellar1.AccountID) error {
	return MakeAccountAllDevices(ctx, r.G(), accountID)
}

func (r *RemoteNet) ServerTimeboundsRecommendation(ctx context.Context) (stellar1.TimeboundsRecommendation, error) {
	return ServerTimeboundsRecommendation(ctx, r.G())
}

func (r *RemoteNet) SetInflationDestination(ctx context.Context, signedTx string) error {
	return SetInflationDestination(ctx, r.G(), signedTx)
}

func (r *RemoteNet) GetInflationDestinations(ctx context.Context) (ret []stellar1.PredefinedInflationDestination, err error) {
	return GetInflationDestinations(ctx, r.G())
}

func (r *RemoteNet) NetworkOptions(ctx context.Context) (stellar1.NetworkOptions, error) {
	return NetworkOptions(ctx, r.G())
}

func (r *RemoteNet) DetailsPlusPayments(ctx context.Context, accountID stellar1.AccountID) (stellar1.DetailsPlusPayments, error) {
	return DetailsPlusPayments(ctx, r.G(), accountID)
}

func (r *RemoteNet) ChangeTrustline(ctx context.Context, signedTx string) error {
	return ChangeTrustline(ctx, r.G(), signedTx)
}

func (r *RemoteNet) FindPaymentPath(mctx libkb.MetaContext, query stellar1.PaymentPathQuery) (stellar1.PaymentPath, error) {
	return FindPaymentPath(mctx, query)
}

func (r *RemoteNet) PostAnyTransaction(mctx libkb.MetaContext, signedTx string) error {
	return PostAnyTransaction(mctx, signedTx)
}

func (r *RemoteNet) FuzzyAssetSearch(mctx libkb.MetaContext, arg stellar1.FuzzyAssetSearchArg) ([]stellar1.Asset, error) {
	return FuzzyAssetSearch(mctx, arg)
}

func (r *RemoteNet) ListPopularAssets(mctx libkb.MetaContext, arg stellar1.ListPopularAssetsArg) (stellar1.AssetListResult, error) {
	return ListPopularAssets(mctx, arg)
}
