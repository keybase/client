package build

import (
	"fmt"

	"github.com/stellar/go/xdr"
)

// MockSequenceProvider is a mock sequence provider.
type MockSequenceProvider struct {
	Data map[string]xdr.SequenceNumber
}

var _ SequenceProvider = &MockSequenceProvider{}

// SequenceForAccount implements `SequenceProvider`
func (sp *MockSequenceProvider) SequenceForAccount(
	accountID string,
) (xdr.SequenceNumber, error) {

	ret, ok := sp.Data[accountID]

	if !ok {
		return 0, fmt.Errorf("No sequence for %s in mock", accountID)
	}

	return ret, nil
}
