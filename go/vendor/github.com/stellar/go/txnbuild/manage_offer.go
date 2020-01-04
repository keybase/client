package txnbuild

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/price"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

//CreateOfferOp returns a ManageSellOffer operation to create a new offer, by
// setting the OfferID to "0". The sourceAccount is optional, and if not provided,
// will be that of the surrounding transaction.
func CreateOfferOp(selling, buying Asset, amount, price string, sourceAccount ...Account) (ManageSellOffer, error) {
	if len(sourceAccount) > 1 {
		return ManageSellOffer{}, errors.New("offer can't have multiple source accounts")
	}
	offer := ManageSellOffer{
		Selling: selling,
		Buying:  buying,
		Amount:  amount,
		Price:   price,
		OfferID: 0,
	}
	if len(sourceAccount) == 1 {
		offer.SourceAccount = sourceAccount[0]
	}
	return offer, nil
}

// UpdateOfferOp returns a ManageSellOffer operation to update an offer.
// The sourceAccount is optional, and if not provided, will be that of
// the surrounding transaction.
func UpdateOfferOp(selling, buying Asset, amount, price string, offerID int64, sourceAccount ...Account) (ManageSellOffer, error) {
	if len(sourceAccount) > 1 {
		return ManageSellOffer{}, errors.New("offer can't have multiple source accounts")
	}
	offer := ManageSellOffer{
		Selling: selling,
		Buying:  buying,
		Amount:  amount,
		Price:   price,
		OfferID: offerID,
	}
	if len(sourceAccount) == 1 {
		offer.SourceAccount = sourceAccount[0]
	}
	return offer, nil
}

//DeleteOfferOp returns a ManageSellOffer operation to delete an offer, by
// setting the Amount to "0". The sourceAccount is optional, and if not provided,
// will be that of the surrounding transaction.
func DeleteOfferOp(offerID int64, sourceAccount ...Account) (ManageSellOffer, error) {
	// It turns out Stellar core doesn't care about any of these fields except the amount.
	// However, Horizon will reject ManageSellOffer if it is missing fields.
	// Horizon will also reject if Buying == Selling.
	// Therefore unfortunately we have to make up some dummy values here.
	if len(sourceAccount) > 1 {
		return ManageSellOffer{}, errors.New("offer can't have multiple source accounts")
	}
	offer := ManageSellOffer{
		Selling: NativeAsset{},
		Buying:  CreditAsset{Code: "FAKE", Issuer: "GBAQPADEYSKYMYXTMASBUIS5JI3LMOAWSTM2CHGDBJ3QDDPNCSO3DVAA"},
		Amount:  "0",
		Price:   "1",
		OfferID: offerID,
	}
	if len(sourceAccount) == 1 {
		offer.SourceAccount = sourceAccount[0]
	}
	return offer, nil
}

// ManageSellOffer represents the Stellar manage offer operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type ManageSellOffer struct {
	Selling       Asset
	Buying        Asset
	Amount        string
	Price         string
	OfferID       int64
	SourceAccount Account
}

// BuildXDR for ManageSellOffer returns a fully configured XDR Operation.
func (mo *ManageSellOffer) BuildXDR() (xdr.Operation, error) {
	xdrSelling, err := mo.Selling.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set XDR 'Selling' field")
	}

	xdrBuying, err := mo.Buying.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set XDR 'Buying' field")
	}

	xdrAmount, err := amount.Parse(mo.Amount)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse 'Amount'")
	}

	xdrPrice, err := price.Parse(mo.Price)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse 'Price'")
	}

	opType := xdr.OperationTypeManageSellOffer
	xdrOp := xdr.ManageSellOfferOp{
		Selling: xdrSelling,
		Buying:  xdrBuying,
		Amount:  xdrAmount,
		Price:   xdrPrice,
		OfferId: xdr.Int64(mo.OfferID),
	}
	body, err := xdr.NewOperationBody(opType, xdrOp)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to build XDR OperationBody")
	}

	op := xdr.Operation{Body: body}
	SetOpSourceAccount(&op, mo.SourceAccount)
	return op, nil
}

// FromXDR for ManageSellOffer initialises the txnbuild struct from the corresponding xdr Operation.
func (mo *ManageSellOffer) FromXDR(xdrOp xdr.Operation) error {
	result, ok := xdrOp.Body.GetManageSellOfferOp()
	if !ok {
		return errors.New("error parsing manage_sell_offer operation from xdr")
	}

	mo.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	mo.OfferID = int64(result.OfferId)
	mo.Amount = amount.String(result.Amount)
	if result.Price != (xdr.Price{}) {
		mo.Price = price.StringFromFloat64(float64(result.Price.N) / float64(result.Price.D))
	}
	buyingAsset, err := assetFromXDR(result.Buying)
	if err != nil {
		return errors.Wrap(err, "error parsing buying_asset in manage_sell_offer operation")
	}
	mo.Buying = buyingAsset

	sellingAsset, err := assetFromXDR(result.Selling)
	if err != nil {
		return errors.Wrap(err, "error parsing selling_asset in manage_sell_offer operation")
	}
	mo.Selling = sellingAsset
	return nil
}

// Validate for ManageSellOffer validates the required struct fields. It returns an error if any
// of the fields are invalid. Otherwise, it returns nil.
func (mo *ManageSellOffer) Validate() error {
	return validateOffer(mo.Buying, mo.Selling, mo.Amount, mo.Price, mo.OfferID)
}
