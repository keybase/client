package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// ClearData removes a key/value pair associated with the source account
func ClearData(name string, muts ...interface{}) (result ManageDataBuilder) {
	result.MD.DataName = xdr.String64(name)
	result.MD.DataValue = nil
	result.validateName()
	result.Mutate(muts...)
	return
}

// SetData sets a key/value pair associated with the source account, updating it
// if one already exists.
func SetData(name string, value []byte, muts ...interface{}) (result ManageDataBuilder) {
	result.MD.DataName = xdr.String64(name)
	v := xdr.DataValue(value)
	result.MD.DataValue = &v
	result.validateName()
	result.validateValue()
	result.Mutate(muts...)
	return
}

// ManageDataBuilder helps to build ManageDataOp structs.
type ManageDataBuilder struct {
	O   xdr.Operation
	MD  xdr.ManageDataOp
	Err error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *ManageDataBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "ManageDataBuilder error")
			return
		}
	}
}

func (b *ManageDataBuilder) validateName() {
	if len(b.MD.DataName) > 64 {
		b.Err = errors.New("Name too long: must be less than 64 bytes")
		return
	}

	if b.MD.DataName == "" {
		b.Err = errors.New("Invalid name: empty string")
		return
	}
}

func (b *ManageDataBuilder) validateValue() {
	if *b.MD.DataValue == nil {
		b.Err = errors.New("Invalid value: cannot set a nil value")
	}

	if len(*b.MD.DataValue) > 64 {
		b.Err = errors.New("Value too long: must be less than 64 bytes")
	}
}
