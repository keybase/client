package build

import (
	"github.com/stellar/go/xdr"
)

// OperationMutator is a interface that wraps the MutateOperation operation.
// types may implement this interface to specify how they modify an
// xdr.Operation object
type OperationMutator interface {
	MutateOperation(*xdr.Operation) error
}

// MutateOperation for SourceAccount sets the operation's SourceAccount
// to the pubilic key for the address provided
func (m SourceAccount) MutateOperation(o *xdr.Operation) error {
	o.SourceAccount = &xdr.AccountId{}
	return setAccountId(m.AddressOrSeed, o.SourceAccount)
}
