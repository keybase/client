package horizonclient

import (
	"context"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/effects"
	"github.com/stellar/go/protocols/horizon/operations"
	"github.com/stellar/go/txnbuild"
	"github.com/stretchr/testify/mock"
)

// MockClient is a mockable horizon client.
type MockClient struct {
	mock.Mock
}

// AccountDetail is a mocking method
func (m *MockClient) AccountDetail(request AccountRequest) (hProtocol.Account, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.Account), a.Error(1)
}

// AccountData is a mocking method
func (m *MockClient) AccountData(request AccountRequest) (hProtocol.AccountData, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.AccountData), a.Error(1)
}

// Effects is a mocking method
func (m *MockClient) Effects(request EffectRequest) (effects.EffectsPage, error) {
	a := m.Called(request)
	return a.Get(0).(effects.EffectsPage), a.Error(1)
}

// Assets is a mocking method
func (m *MockClient) Assets(request AssetRequest) (hProtocol.AssetsPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.AssetsPage), a.Error(1)
}

// Ledgers is a mocking method
func (m *MockClient) Ledgers(request LedgerRequest) (hProtocol.LedgersPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.LedgersPage), a.Error(1)
}

// LedgerDetail is a mocking method
func (m *MockClient) LedgerDetail(sequence uint32) (hProtocol.Ledger, error) {
	a := m.Called(sequence)
	return a.Get(0).(hProtocol.Ledger), a.Error(1)
}

// Metrics is a mocking method
func (m *MockClient) Metrics() (hProtocol.Metrics, error) {
	a := m.Called()
	return a.Get(0).(hProtocol.Metrics), a.Error(1)
}

// FeeStats is a mocking method
func (m *MockClient) FeeStats() (hProtocol.FeeStats, error) {
	a := m.Called()
	return a.Get(0).(hProtocol.FeeStats), a.Error(1)
}

// Offers is a mocking method
func (m *MockClient) Offers(request OfferRequest) (hProtocol.OffersPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.OffersPage), a.Error(1)
}

// Operations is a mocking method
func (m *MockClient) Operations(request OperationRequest) (operations.OperationsPage, error) {
	a := m.Called(request)
	return a.Get(0).(operations.OperationsPage), a.Error(1)
}

// OperationDetail is a mocking method
func (m *MockClient) OperationDetail(id string) (operations.Operation, error) {
	a := m.Called(id)
	return a.Get(0).(operations.Operation), a.Error(1)
}

// SubmitTransactionXDR is a mocking method
func (m *MockClient) SubmitTransactionXDR(transactionXdr string) (hProtocol.TransactionSuccess, error) {
	a := m.Called(transactionXdr)
	return a.Get(0).(hProtocol.TransactionSuccess), a.Error(1)
}

// SubmitTransaction is a mocking method
func (m *MockClient) SubmitTransaction(transaction txnbuild.Transaction) (hProtocol.TransactionSuccess, error) {
	a := m.Called(transaction)
	return a.Get(0).(hProtocol.TransactionSuccess), a.Error(1)
}

// Transactions is a mocking method
func (m *MockClient) Transactions(request TransactionRequest) (hProtocol.TransactionsPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.TransactionsPage), a.Error(1)
}

// TransactionDetail is a mocking method
func (m *MockClient) TransactionDetail(txHash string) (hProtocol.Transaction, error) {
	a := m.Called(txHash)
	return a.Get(0).(hProtocol.Transaction), a.Error(1)
}

// OrderBook is a mocking method
func (m *MockClient) OrderBook(request OrderBookRequest) (hProtocol.OrderBookSummary, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.OrderBookSummary), a.Error(1)
}

// Paths is a mocking method
func (m *MockClient) Paths(request PathsRequest) (hProtocol.PathsPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.PathsPage), a.Error(1)
}

// Payments is a mocking method
func (m *MockClient) Payments(request OperationRequest) (operations.OperationsPage, error) {
	a := m.Called(request)
	return a.Get(0).(operations.OperationsPage), a.Error(1)
}

// TradeAggregations is a mocking method
func (m *MockClient) TradeAggregations(request TradeAggregationRequest) (hProtocol.TradeAggregationsPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.TradeAggregationsPage), a.Error(1)
}

// Trades is a mocking method
func (m *MockClient) Trades(request TradeRequest) (hProtocol.TradesPage, error) {
	a := m.Called(request)
	return a.Get(0).(hProtocol.TradesPage), a.Error(1)
}

// Fund is a mocking method
func (m *MockClient) Fund(addr string) (hProtocol.TransactionSuccess, error) {
	a := m.Called(addr)
	return a.Get(0).(hProtocol.TransactionSuccess), a.Error(1)
}

// StreamTransactions is a mocking method
func (m *MockClient) StreamTransactions(ctx context.Context, request TransactionRequest, handler TransactionHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamTrades is a mocking method
func (m *MockClient) StreamTrades(ctx context.Context, request TradeRequest, handler TradeHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamEffects is a mocking method
func (m *MockClient) StreamEffects(ctx context.Context, request EffectRequest, handler EffectHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamOperations is a mocking method
func (m *MockClient) StreamOperations(ctx context.Context, request OperationRequest, handler OperationHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamPayments is a mocking method
func (m *MockClient) StreamPayments(ctx context.Context, request OperationRequest, handler OperationHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamOffers is a mocking method
func (m *MockClient) StreamOffers(ctx context.Context, request OfferRequest, handler OfferHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamLedgers is a mocking method
func (m *MockClient) StreamLedgers(ctx context.Context, request LedgerRequest, handler LedgerHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// StreamOrderBooks is a mocking method
func (m *MockClient) StreamOrderBooks(ctx context.Context, request OrderBookRequest, handler OrderBookHandler) error {
	return m.Called(ctx, request, handler).Error(0)
}

// Root is a mocking method
func (m *MockClient) Root() (hProtocol.Root, error) {
	a := m.Called()
	return a.Get(0).(hProtocol.Root), a.Error(1)
}

// NextAssetsPage is a mocking method
func (m *MockClient) NextAssetsPage(page hProtocol.AssetsPage) (hProtocol.AssetsPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.AssetsPage), a.Error(1)
}

// PrevAssetsPage is a mocking method
func (m *MockClient) PrevAssetsPage(page hProtocol.AssetsPage) (hProtocol.AssetsPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.AssetsPage), a.Error(1)
}

// NextLedgersPage is a mocking method
func (m *MockClient) NextLedgersPage(page hProtocol.LedgersPage) (hProtocol.LedgersPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.LedgersPage), a.Error(1)
}

// PrevLedgersPage is a mocking method
func (m *MockClient) PrevLedgersPage(page hProtocol.LedgersPage) (hProtocol.LedgersPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.LedgersPage), a.Error(1)
}

// NextEffectsPage is a mocking method
func (m *MockClient) NextEffectsPage(page effects.EffectsPage) (effects.EffectsPage, error) {
	a := m.Called(page)
	return a.Get(0).(effects.EffectsPage), a.Error(1)
}

// PrevEffectsPage is a mocking method
func (m *MockClient) PrevEffectsPage(page effects.EffectsPage) (effects.EffectsPage, error) {
	a := m.Called(page)
	return a.Get(0).(effects.EffectsPage), a.Error(1)
}

// NextTransactionsPage is a mocking method
func (m *MockClient) NextTransactionsPage(page hProtocol.TransactionsPage) (hProtocol.TransactionsPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.TransactionsPage), a.Error(1)
}

// PrevTransactionsPage is a mocking method
func (m *MockClient) PrevTransactionsPage(page hProtocol.TransactionsPage) (hProtocol.TransactionsPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.TransactionsPage), a.Error(1)
}

// NextOperationsPage is a mocking method
func (m *MockClient) NextOperationsPage(page operations.OperationsPage) (operations.OperationsPage, error) {
	a := m.Called(page)
	return a.Get(0).(operations.OperationsPage), a.Error(1)
}

// PrevOperationsPage is a mocking method
func (m *MockClient) PrevOperationsPage(page operations.OperationsPage) (operations.OperationsPage, error) {
	a := m.Called(page)
	return a.Get(0).(operations.OperationsPage), a.Error(1)
}

// NextPaymentsPage is a mocking method
func (m *MockClient) NextPaymentsPage(page operations.OperationsPage) (operations.OperationsPage, error) {
	return m.NextOperationsPage(page)
}

// PrevPaymentsPage is a mocking method
func (m *MockClient) PrevPaymentsPage(page operations.OperationsPage) (operations.OperationsPage, error) {
	return m.PrevOperationsPage(page)
}

// NextOffersPage is a mocking method
func (m *MockClient) NextOffersPage(page hProtocol.OffersPage) (hProtocol.OffersPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.OffersPage), a.Error(1)
}

// PrevOffersPage is a mocking method
func (m *MockClient) PrevOffersPage(page hProtocol.OffersPage) (hProtocol.OffersPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.OffersPage), a.Error(1)
}

// NextTradesPage is a mocking method
func (m *MockClient) NextTradesPage(page hProtocol.TradesPage) (hProtocol.TradesPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.TradesPage), a.Error(1)
}

// PrevTradesPage is a mocking method
func (m *MockClient) PrevTradesPage(page hProtocol.TradesPage) (hProtocol.TradesPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.TradesPage), a.Error(1)
}

// HomeDomainForAccount is a mocking method
func (m *MockClient) HomeDomainForAccount(aid string) (string, error) {
	a := m.Called(aid)
	return a.Get(0).(string), a.Error(1)
}

// NextTradeAggregationsPage is a mocking method
func (m *MockClient) NextTradeAggregationsPage(page hProtocol.TradeAggregationsPage) (hProtocol.TradeAggregationsPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.TradeAggregationsPage), a.Error(1)
}

// PrevTradeAggregationsPage is a mocking method
func (m *MockClient) PrevTradeAggregationsPage(page hProtocol.TradeAggregationsPage) (hProtocol.TradeAggregationsPage, error) {
	a := m.Called(page)
	return a.Get(0).(hProtocol.TradeAggregationsPage), a.Error(1)
}

// ensure that the MockClient implements ClientInterface
var _ ClientInterface = &MockClient{}
