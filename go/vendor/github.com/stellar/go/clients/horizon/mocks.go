package horizon

import (
	"github.com/stretchr/testify/mock"
	"golang.org/x/net/context"
)

// MockClient is a mockable horizon client.
type MockClient struct {
	mock.Mock
}

// Root is a mocking a method
func (m *MockClient) Root() (Root, error) {
	a := m.Called()
	return a.Get(0).(Root), a.Error(1)
}

// HomeDomainForAccount is a mocking a method
func (m *MockClient) HomeDomainForAccount(aid string) (string, error) {
	a := m.Called(aid)
	return a.Get(0).(string), a.Error(1)
}

// LoadAccount is a mocking a method
func (m *MockClient) LoadAccount(accountID string) (Account, error) {
	a := m.Called(accountID)
	return a.Get(0).(Account), a.Error(1)
}

// LoadAccountOffers is a mocking a method
func (m *MockClient) LoadAccountOffers(accountID string, params ...interface{}) (offers OffersPage, err error) {
	// There is no way to simply call:
	//
	// a := m.Called(accountID, params...)
	//
	// Go errors with: "too many arguments in call to m.Mock.Called"
	args := []interface{}{accountID}
	for _, param := range params {
		args = append(args, param)
	}
	a := m.Called(args...)
	return a.Get(0).(OffersPage), a.Error(1)
}

// LoadMemo is a mocking a method
func (m *MockClient) LoadMemo(p *Payment) error {
	a := m.Called(p)
	return a.Error(0)
}

// LoadOrderBook is a mocking a method
func (m *MockClient) LoadOrderBook(selling Asset, buying Asset, params ...interface{}) (orderBook OrderBookSummary, err error) {
	a := m.Called(selling, buying, params)
	return a.Get(0).(OrderBookSummary), a.Error(1)
}

// StreamLedgers is a mocking a method
func (m *MockClient) StreamLedgers(ctx context.Context, cursor *Cursor, handler LedgerHandler) error {
	a := m.Called(ctx, cursor, handler)
	return a.Error(0)
}

// StreamPayments is a mocking a method
func (m *MockClient) StreamPayments(ctx context.Context, accountID string, cursor *Cursor, handler PaymentHandler) error {
	a := m.Called(ctx, accountID, cursor, handler)
	return a.Error(0)
}

// StreamTransactions is a mocking a method
func (m *MockClient) StreamTransactions(ctx context.Context, accountID string, cursor *Cursor, handler TransactionHandler) error {
	a := m.Called(ctx, accountID, cursor, handler)
	return a.Error(0)
}

// SubmitTransaction is a mocking a method
func (m *MockClient) SubmitTransaction(txeBase64 string) (TransactionSuccess, error) {
	a := m.Called(txeBase64)
	return a.Get(0).(TransactionSuccess), a.Error(1)
}

// ensure that the MockClient implements ClientInterface
var _ ClientInterface = &MockClient{}
