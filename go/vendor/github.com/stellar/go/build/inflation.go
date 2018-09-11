package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// Inflation groups the creation of a new InflationBuilder with a call to Mutate.
func Inflation(muts ...interface{}) (result InflationBuilder) {
	result.Mutate(muts...)
	return
}

// InflationBuilder represents an operation that is being built.
type InflationBuilder struct {
	O   xdr.Operation
	Err error
}

// Mutate applies the provided mutators to this builder's operation.
func (b *InflationBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "InflationBuilder error")
			return
		}
	}
}
