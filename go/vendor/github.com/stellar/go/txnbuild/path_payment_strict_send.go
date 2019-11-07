package txnbuild

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// PathPaymentStrictSend represents the Stellar path_payment_strict_send operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type PathPaymentStrictSend struct {
	SendAsset     Asset
	SendAmount    string
	Destination   string
	DestAsset     Asset
	DestMin       string
	Path          []Asset
	SourceAccount Account
}

// BuildXDR for Payment returns a fully configured XDR Operation.
func (pp *PathPaymentStrictSend) BuildXDR() (xdr.Operation, error) {
	// Set XDR send asset
	if pp.SendAsset == nil {
		return xdr.Operation{}, errors.New("you must specify an asset to send for payment")
	}
	xdrSendAsset, err := pp.SendAsset.ToXDR()
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set asset type")
	}

	// Set XDR dest min
	xdrDestMin, err := amount.Parse(pp.DestMin)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse minimum amount to receive")
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
	xdrSendAmount, err := amount.Parse(pp.SendAmount)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse amount of asset source account sends")
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

	opType := xdr.OperationTypePathPaymentStrictSend
	xdrOp := xdr.PathPaymentStrictSendOp{
		SendAsset:   xdrSendAsset,
		SendAmount:  xdrSendAmount,
		Destination: xdrDestination,
		DestAsset:   xdrDestAsset,
		DestMin:     xdrDestMin,
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

// FromXDR for PathPaymentStrictSend initialises the txnbuild struct from the corresponding xdr Operation.
func (pp *PathPaymentStrictSend) FromXDR(xdrOp xdr.Operation) error {
	result, ok := xdrOp.Body.GetPathPaymentStrictSendOp()
	if !ok {
		return errors.New("error parsing path_payment operation from xdr")
	}

	pp.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	pp.Destination = result.Destination.Address()
	pp.SendAmount = amount.String(result.SendAmount)
	pp.DestMin = amount.String(result.DestMin)

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

// Validate for PathPaymentStrictSend validates the required struct fields. It returns an error if any
// of the fields are invalid. Otherwise, it returns nil.
func (pp *PathPaymentStrictSend) Validate() error {
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

	err = validateAmount(pp.SendAmount)
	if err != nil {
		return NewValidationError("SendAmount", err.Error())
	}

	err = validateAmount(pp.DestMin)
	if err != nil {
		return NewValidationError("DestMin", err.Error())
	}

	return nil
}
