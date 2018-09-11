package build

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// Payment groups the creation of a new PaymentBuilder with a call to Mutate.
// Requires the Destination and NativeAmount mutators to be set.
func Payment(muts ...interface{}) (result PaymentBuilder) {
	result.Mutate(muts...)
	return
}

// PaymentMutator is a interface that wraps the
// MutatePayment operation.  types may implement this interface to
// specify how they modify an xdr.PaymentOp object
type PaymentMutator interface {
	MutatePayment(interface{}) error
}

// PaymentBuilder represents a transaction that is being built.
type PaymentBuilder struct {
	PathPayment bool
	O           xdr.Operation
	P           xdr.PaymentOp
	PP          xdr.PathPaymentOp
	Err         error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *PaymentBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		if _, ok := m.(PayWithPath); ok {
			b.PathPayment = true
			break
		}
	}

	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case PaymentMutator:
			if b.PathPayment {
				err = mut.MutatePayment(&b.PP)
			} else {
				err = mut.MutatePayment(&b.P)
			}
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "PaymentBuilder error")
			return
		}
	}
}

// MutatePayment for Asset sets the PaymentOp's Asset field
func (m CreditAmount) MutatePayment(o interface{}) (err error) {
	switch o := o.(type) {
	default:
		err = errors.New("Unexpected operation type")
	case *xdr.PaymentOp:
		o.Amount, err = amount.Parse(m.Amount)
		if err != nil {
			return
		}

		o.Asset, err = createAlphaNumAsset(m.Code, m.Issuer)
	case *xdr.PathPaymentOp:
		o.DestAmount, err = amount.Parse(m.Amount)
		if err != nil {
			return
		}

		o.DestAsset, err = createAlphaNumAsset(m.Code, m.Issuer)
	}
	return
}

// MutatePayment for Destination sets the PaymentOp's Destination field
func (m Destination) MutatePayment(o interface{}) error {
	switch o := o.(type) {
	default:
		return errors.New("Unexpected operation type")
	case *xdr.PaymentOp:
		return setAccountId(m.AddressOrSeed, &o.Destination)
	case *xdr.PathPaymentOp:
		return setAccountId(m.AddressOrSeed, &o.Destination)
	}
}

// MutatePayment for NativeAmount sets the PaymentOp's currency field to
// native and sets its amount to the provided integer
func (m NativeAmount) MutatePayment(o interface{}) (err error) {
	switch o := o.(type) {
	default:
		err = errors.New("Unexpected operation type")
	case *xdr.PaymentOp:
		o.Amount, err = amount.Parse(m.Amount)
		if err != nil {
			return
		}

		o.Asset, err = xdr.NewAsset(xdr.AssetTypeAssetTypeNative, nil)
	case *xdr.PathPaymentOp:
		o.DestAmount, err = amount.Parse(m.Amount)
		if err != nil {
			return
		}

		o.DestAsset, err = xdr.NewAsset(xdr.AssetTypeAssetTypeNative, nil)
	}
	return
}

// MutatePayment for PayWithPath sets the PathPaymentOp's SendAsset,
// SendMax and Path fields
func (m PayWithPath) MutatePayment(o interface{}) (err error) {
	var pathPaymentOp *xdr.PathPaymentOp
	var ok bool
	if pathPaymentOp, ok = o.(*xdr.PathPaymentOp); !ok {
		return errors.New("Unexpected operation type")
	}

	// MaxAmount
	pathPaymentOp.SendMax, err = amount.Parse(m.MaxAmount)
	if err != nil {
		return
	}

	// Path
	var path []xdr.Asset
	var xdrAsset xdr.Asset

	for _, asset := range m.Path {
		xdrAsset, err = asset.ToXDR()
		if err != nil {
			return err
		}

		path = append(path, xdrAsset)
	}

	pathPaymentOp.Path = path

	// Asset
	pathPaymentOp.SendAsset, err = m.Asset.ToXDR()
	return
}
