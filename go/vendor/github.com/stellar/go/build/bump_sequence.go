package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// BumpSequence groups the creation of a new BumpSequenceBuilder with a call
// to Mutate. Requires the BumpTo mutator to be set.
func BumpSequence(muts ...interface{}) (result BumpSequenceBuilder) {
	result.Mutate(muts...)
	return
}

// BumpSequenceMutator is a interface that wraps the
// MutateBumpSequence operation.  types may implement this interface to
// specify how they modify an xdr.BumpSequenceOp object
type BumpSequenceMutator interface {
	MutateBumpSequence(*xdr.BumpSequenceOp) error
}

// BumpSequenceBuilder helps to build BumpSequenceOp structs.
type BumpSequenceBuilder struct {
	O   xdr.Operation
	BS  xdr.BumpSequenceOp
	Err error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *BumpSequenceBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case BumpSequenceMutator:
			err = mut.MutateBumpSequence(&b.BS)
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "BumpSequenceBuilder error")
			return
		}
	}
}

// MutateBumpSequence for BumpTo sets the BumpSequenceOp's
// StartingBalance field
func (m BumpTo) MutateBumpSequence(o *xdr.BumpSequenceOp) (err error) {
	o.BumpTo = xdr.SequenceNumber(m)
	return
}
