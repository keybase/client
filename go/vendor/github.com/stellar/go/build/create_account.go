package build

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// CreateAccount groups the creation of a new CreateAccountBuilder with a call
// to Mutate. Requires the Destination and NativeAmount mutators to be set.
func CreateAccount(muts ...interface{}) (result CreateAccountBuilder) {
	result.Mutate(muts...)
	return
}

// CreateAccountMutator is a interface that wraps the
// MutateCreateAccount operation.  types may implement this interface to
// specify how they modify an xdr.PaymentOp object
type CreateAccountMutator interface {
	MutateCreateAccount(*xdr.CreateAccountOp) error
}

// CreateAccountBuilder helps to build CreateAccountOp structs.
type CreateAccountBuilder struct {
	O   xdr.Operation
	CA  xdr.CreateAccountOp
	Err error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *CreateAccountBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case CreateAccountMutator:
			err = mut.MutateCreateAccount(&b.CA)
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "CreateAccountBuilder error")
			return
		}
	}
}

// MutateCreateAccount for Destination sets the CreateAccountOp's Destination
// field
func (m Destination) MutateCreateAccount(o *xdr.CreateAccountOp) error {
	return setAccountId(m.AddressOrSeed, &o.Destination)
}

// MutateCreateAccount for NativeAmount sets the CreateAccountOp's
// StartingBalance field
func (m NativeAmount) MutateCreateAccount(o *xdr.CreateAccountOp) (err error) {
	o.StartingBalance, err = amount.Parse(m.Amount)
	return
}
