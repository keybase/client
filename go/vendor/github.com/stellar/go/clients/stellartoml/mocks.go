package stellartoml

import "github.com/stretchr/testify/mock"

// MockClient is a mockable stellartoml client.
type MockClient struct {
	mock.Mock
}

// GetStellarToml is a mocking a method
func (m *MockClient) GetStellarToml(domain string) (*Response, error) {
	a := m.Called(domain)
	return a.Get(0).(*Response), a.Error(1)
}

// GetStellarTomlByAddress is a mocking a method
func (m *MockClient) GetStellarTomlByAddress(address string) (*Response, error) {
	a := m.Called(address)
	return a.Get(0).(*Response), a.Error(1)
}
