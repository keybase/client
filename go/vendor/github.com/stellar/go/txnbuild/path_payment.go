package txnbuild

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// PathPayment represents the Stellar path_payment_strict_receive operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type PathPaymentStrictReceive PathPayment

// PathPayment represents the Stellar path payment operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type PathPayment struct {
	SendAsset     Asset
	SendMax       string
	Destination   string
	DestAsset     Asset
	DestAmount    string
	Path          []Asset
	SourceAccount Account
}

// BuildXDR for Payment returns a fully configured XDR Operation.
func (pp *PathPayment) BuildXDR() (xdr.Operation, error) {
	// Set XDR send asset
	if pp.SendAsset == nil {
		return xdr.Operation{}, errors.New("you must specify an asset to send for payment")
	}
	xdrSendAsset, err := pp.SendAsset.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set asset type")
	}

	// Set XDR send max
	xdrSendMax, err := amount.Parse(pp.SendMax)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse maximum amount to send")
	}

	// Set XDR destination
	var xdrDestination xdr.AccountId
	err = xdrDestination.SetAddress(pp.Destination)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set destination address")
	}

	// Set XDR destination asset
	if pp.DestAsset == nil {
		return xdr.Operation{}, errors.New("you must specify an asset for destination account to receive")
	}
	xdrDestAsset, err := pp.DestAsset.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set asset type")
	}

	// Set XDR destination amount
	xdrDestAmount, err := amount.Parse(pp.DestAmount)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse amount of asset destination account receives")
	}

	// Set XDR path
	var xdrPath []xdr.Asset
	var xdrPathAsset xdr.Asset
	for _, asset := range pp.Path {
		xdrPathAsset, err = asset.ToXDR()
		if err != nil {
			return xdr.Operation{}, errors.Wrap(err, "failed to set asset type")
		}
		xdrPath = append(xdrPath, xdrPathAsset)
	}

	opType := xdr.OperationTypePathPaymentStrictReceive
	xdrOp := xdr.PathPaymentStrictReceiveOp{
		SendAsset:   xdrSendAsset,
		SendMax:     xdrSendMax,
		Destination: xdrDestination,
		DestAsset:   xdrDestAsset,
		DestAmount:  xdrDestAmount,
		Path:        xdrPath,
	}
	body, err := xdr.NewOperationBody(opType, xdrOp)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to build XDR OperationBody")
	}
	op := xdr.Operation{Body: body}
	SetOpSourceAccount(&op, pp.SourceAccount)
	return op, nil
}

// FromXDR for PathPayment initialises the txnbuild struct from the corresponding xdr Operation.
func (pp *PathPayment) FromXDR(xdrOp xdr.Operation) error {
	result, ok := xdrOp.Body.GetPathPaymentStrictReceiveOp()
	if !ok {
		return errors.New("error parsing path_payment operation from xdr")
	}

	pp.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	pp.Destination = result.Destination.Address()
	pp.DestAmount = amount.String(result.DestAmount)
	pp.SendMax = amount.String(result.SendMax)

	destAsset, err := assetFromXDR(result.DestAsset)
	if err != nil {
		return errors.Wrap(err, "error parsing dest_asset in path_payment operation")
	}
	pp.DestAsset = destAsset

	sendAsset, err := assetFromXDR(result.SendAsset)
	if err != nil {
		return errors.Wrap(err, "error parsing send_asset in path_payment operation")
	}
	pp.SendAsset = sendAsset

	pp.Path = []Asset{}
	for _, p := range result.Path {
		pathAsset, err := assetFromXDR(p)
		if err != nil {
			return errors.Wrap(err, "error parsing paths in path_payment operation")
		}
		pp.Path = append(pp.Path, pathAsset)
	}

	return nil
}

// Validate for PathPayment validates the required struct fields. It returns an error if any
// of the fields are invalid. Otherwise, it returns nil.
func (pp *PathPayment) Validate() error {
	err := validateStellarPublicKey(pp.Destination)
	if err != nil {
		return NewValidationError("Destination", err.Error())
	}

	err = validateStellarAsset(pp.SendAsset)
	if err != nil {
		return NewValidationError("SendAsset", err.Error())
	}

	err = validateStellarAsset(pp.DestAsset)
	if err != nil {
		return NewValidationError("DestAsset", err.Error())
	}

	err = validateAmount(pp.SendMax)
	if err != nil {
		return NewValidationError("SendMax", err.Error())
	}

	err = validateAmount(pp.DestAmount)
	if err != nil {
		return NewValidationError("DestAmount", err.Error())
	}

	return nil
}
