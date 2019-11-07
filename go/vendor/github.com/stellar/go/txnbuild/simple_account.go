package txnbuild

import (
	"github.com/stellar/go/xdr"
)

// SimpleAccount is a minimal implementation of an Account.
type SimpleAccount struct {
	AccountID string
	Sequence  int64
}

// GetAccountID returns the Account ID.
func (sa *SimpleAccount) GetAccountID() string {
	return sa.AccountID
}

// IncrementSequenceNumber increments the internal record of the
// account's sequence number by 1.
func (sa *SimpleAccount) IncrementSequenceNumber() (xdr.SequenceNumber, error) {
	sa.Sequence++
	return sa.GetSequenceNumber()
}

// GetSequenceNumber returns the sequence number of the account.
func (sa *SimpleAccount) GetSequenceNumber() (xdr.SequenceNumber, error) {
	return xdr.SequenceNumber(sa.Sequence), nil
}

// NewSimpleAccount is a factory method that creates a SimpleAccount from "accountID" and "sequence".
func NewSimpleAccount(accountID string, sequence int64) SimpleAccount {
	return SimpleAccount{accountID, sequence}
}

// ensure that SimpleAccount implements Account interface.
var _ Account = &SimpleAccount{}
