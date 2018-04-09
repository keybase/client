package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// AccountMerge groups the creation of a new AccountMergeBuilder with a call to
// Mutate.
func AccountMerge(muts ...interface{}) (result AccountMergeBuilder) {
	result.Mutate(muts...)
	return
}

// AccountMergeMutator is a interface that wraps the
// MutateAccountMerge operation.  types may implement this interface to
// specify how they modify an xdr.AccountMergeBuilder object
type AccountMergeMutator interface {
	MutateAccountMerge(*AccountMergeBuilder) error
}

// AccountMergeBuilder represents a transaction that is being built.
type AccountMergeBuilder struct {
	O           xdr.Operation
	Destination xdr.AccountId
	Err         error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *AccountMergeBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case AccountMergeMutator:
			err = mut.MutateAccountMerge(b)
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "AccountMergeBuilder error")
			return
		}
	}
}

// MutateAccountMerge for Destination sets the AccountMergeBuilder's Destination field
func (m Destination) MutateAccountMerge(o *AccountMergeBuilder) error {
	return setAccountId(m.AddressOrSeed, &o.Destination)
}
