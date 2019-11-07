package txnbuild

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/price"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// CreatePassiveSellOffer represents the Stellar create passive offer operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type CreatePassiveSellOffer struct {
	Selling       Asset
	Buying        Asset
	Amount        string
	Price         string
	SourceAccount Account
}

// BuildXDR for CreatePassiveSellOffer returns a fully configured XDR Operation.
func (cpo *CreatePassiveSellOffer) BuildXDR() (xdr.Operation, error) {
	xdrSelling, err := cpo.Selling.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set XDR 'Selling' field")
	}

	xdrBuying, err := cpo.Buying.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set XDR 'Buying' field")
	}

	xdrAmount, err := amount.Parse(cpo.Amount)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse 'Amount'")
	}

	xdrPrice, err := price.Parse(cpo.Price)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse 'Price'")
	}

	xdrOp := xdr.CreatePassiveSellOfferOp{
		Selling: xdrSelling,
		Buying:  xdrBuying,
		Amount:  xdrAmount,
		Price:   xdrPrice,
	}

	opType := xdr.OperationTypeCreatePassiveSellOffer
	body, err := xdr.NewOperationBody(opType, xdrOp)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to build XDR OperationBody")
	}
	op := xdr.Operation{Body: body}
	SetOpSourceAccount(&op, cpo.SourceAccount)
	return op, nil
}

// FromXDR for CreatePassiveSellOffer initialises the txnbuild struct from the corresponding xdr Operation.
func (cpo *CreatePassiveSellOffer) FromXDR(xdrOp xdr.Operation) error {
	result, ok := xdrOp.Body.GetCreatePassiveSellOfferOp()
	if !ok {
		return errors.New("error parsing create_passive_sell_offer operation from xdr")
	}

	cpo.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	cpo.Amount = amount.String(result.Amount)
	if result.Price != (xdr.Price{}) {
		cpo.Price = price.StringFromFloat64(float64(result.Price.N) / float64(result.Price.D))
	}
	buyingAsset, err := assetFromXDR(result.Buying)
	if err != nil {
		return errors.Wrap(err, "error parsing buying_asset in create_passive_sell_offer operation")
	}
	cpo.Buying = buyingAsset

	sellingAsset, err := assetFromXDR(result.Selling)
	if err != nil {
		return errors.Wrap(err, "error parsing selling_asset in create_passive_sell_offer operation")
	}
	cpo.Selling = sellingAsset
	return nil
}

// Validate for CreatePassiveSellOffer validates the required struct fields. It returns an error if any
// of the fields are invalid. Otherwise, it returns nil.
func (cpo *CreatePassiveSellOffer) Validate() error {
	return validatePassiveOffer(cpo.Buying, cpo.Selling, cpo.Amount, cpo.Price)
}
