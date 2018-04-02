package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// AllowTrust groups the creation of a new AllowTrustBuilder with a call to Mutate.
func AllowTrust(muts ...interface{}) (result AllowTrustBuilder) {
	result.Mutate(muts...)
	return
}

// AllowTrustMutator is a interface that wraps the
// MutateAllowTrust operation.  types may implement this interface to
// specify how they modify an xdr.AllowTrustOp object
type AllowTrustMutator interface {
	MutateAllowTrust(*xdr.AllowTrustOp) error
}

// AllowTrustBuilder represents a transaction that is being built.
type AllowTrustBuilder struct {
	O   xdr.Operation
	AT  xdr.AllowTrustOp
	Err error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *AllowTrustBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case AllowTrustMutator:
			err = mut.MutateAllowTrust(&b.AT)
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "AllowTrustBuilder error")
			return
		}
	}
}

// MutateAllowTrust for Authorize sets the AllowTrustOp's Authorize field
func (m Authorize) MutateAllowTrust(o *xdr.AllowTrustOp) error {
	o.Authorize = m.Value
	return nil
}

// MutateAllowTrust for Asset sets the AllowTrustOp's Asset field
func (m AllowTrustAsset) MutateAllowTrust(o *xdr.AllowTrustOp) (err error) {
	length := len(m.Code)

	switch {
	case length >= 1 && length <= 4:
		var code [4]byte
		byteArray := []byte(m.Code)
		copy(code[:], byteArray[0:length])
		o.Asset, err = xdr.NewAllowTrustOpAsset(xdr.AssetTypeAssetTypeCreditAlphanum4, code)
	case length >= 5 && length <= 12:
		var code [12]byte
		byteArray := []byte(m.Code)
		copy(code[:], byteArray[0:length])
		o.Asset, err = xdr.NewAllowTrustOpAsset(xdr.AssetTypeAssetTypeCreditAlphanum12, code)
	default:
		err = errors.New("Asset code length is invalid")
	}

	return
}

// MutateAllowTrust for Trustor sets the AllowTrustOp's Trustor field
func (m Trustor) MutateAllowTrust(o *xdr.AllowTrustOp) error {
	return setAccountId(m.Address, &o.Trustor)
}
