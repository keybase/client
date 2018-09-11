package build

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/price"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// CreateOffer creates a new offer
func CreateOffer(rate Rate, amount Amount) (result ManageOfferBuilder) {
	return ManageOffer(false, rate, amount)
}

// CreatePassiveOffer creates a new passive offer
func CreatePassiveOffer(rate Rate, amount Amount) (result ManageOfferBuilder) {
	return ManageOffer(true, rate, amount)
}

// UpdateOffer updates an existing offer
func UpdateOffer(rate Rate, amount Amount, offerID OfferID) (result ManageOfferBuilder) {
	return ManageOffer(false, rate, amount, offerID)
}

// DeleteOffer deletes an existing offer
func DeleteOffer(rate Rate, offerID OfferID) (result ManageOfferBuilder) {
	return ManageOffer(false, rate, Amount("0"), offerID)
}

// ManageOffer groups the creation of a new ManageOfferBuilder with a call to Mutate.
func ManageOffer(passiveOffer bool, muts ...interface{}) (result ManageOfferBuilder) {
	result.PassiveOffer = passiveOffer
	result.Mutate(muts...)
	return
}

// ManageOfferMutator is a interface that wraps the
// MutateManageOffer operation.  types may implement this interface to
// specify how they modify an xdr.ManageOfferOp object
type ManageOfferMutator interface {
	MutateManageOffer(interface{}) error
}

// ManageOfferBuilder represents a transaction that is being built.
type ManageOfferBuilder struct {
	PassiveOffer bool
	O            xdr.Operation
	MO           xdr.ManageOfferOp
	PO           xdr.CreatePassiveOfferOp
	Err          error
}

// Mutate applies the provided mutators to this builder's offer or operation.
func (b *ManageOfferBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case ManageOfferMutator:
			if b.PassiveOffer {
				err = mut.MutateManageOffer(&b.PO)
			} else {
				err = mut.MutateManageOffer(&b.MO)
			}
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "ManageOfferBuilder error")
			return
		}
	}
}

// MutateManageOffer for Amount sets the ManageOfferOp's Amount field
func (m Amount) MutateManageOffer(o interface{}) (err error) {
	switch o := o.(type) {
	default:
		err = errors.New("Unexpected operation type")
	case *xdr.ManageOfferOp:
		o.Amount, err = amount.Parse(string(m))
	case *xdr.CreatePassiveOfferOp:
		o.Amount, err = amount.Parse(string(m))
	}
	return
}

// MutateManageOffer for OfferID sets the ManageOfferOp's OfferID field
func (m OfferID) MutateManageOffer(o interface{}) (err error) {
	switch o := o.(type) {
	default:
		err = errors.New("Unexpected operation type")
	case *xdr.ManageOfferOp:
		o.OfferId = xdr.Uint64(m)
	}
	return
}

// MutateManageOffer for Rate sets the ManageOfferOp's selling, buying and price fields
func (m Rate) MutateManageOffer(o interface{}) (err error) {
	switch o := o.(type) {
	default:
		err = errors.New("Unexpected operation type")
	case *xdr.ManageOfferOp:
		o.Selling, err = m.Selling.ToXDR()
		if err != nil {
			return
		}

		o.Buying, err = m.Buying.ToXDR()
		if err != nil {
			return
		}

		o.Price, err = price.Parse(string(m.Price))
	case *xdr.CreatePassiveOfferOp:
		o.Selling, err = m.Selling.ToXDR()
		if err != nil {
			return
		}

		o.Buying, err = m.Buying.ToXDR()
		if err != nil {
			return
		}

		o.Price, err = price.Parse(string(m.Price))
	}
	return
}
