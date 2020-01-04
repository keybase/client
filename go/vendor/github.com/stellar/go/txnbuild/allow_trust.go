package txnbuild

import (
	"bytes"

	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// AllowTrust represents the Stellar allow trust operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type AllowTrust struct {
	Trustor       string
	Type          Asset
	Authorize     bool
	SourceAccount Account
}

// BuildXDR for AllowTrust returns a fully configured XDR Operation.
func (at *AllowTrust) BuildXDR() (xdr.Operation, error) {
	var xdrOp xdr.AllowTrustOp

	// Set XDR address associated with the trustline
	err := xdrOp.Trustor.SetAddress(at.Trustor)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set trustor address")
	}

	// Validate this is an issued asset
	if at.Type.IsNative() {
		return xdr.Operation{}, errors.New("trustline doesn't exist for a native (XLM) asset")
	}

	// AllowTrust has a special asset type - map to it
	xdrAsset := xdr.Asset{}

	xdrOp.Asset, err = xdrAsset.ToAllowTrustOpAsset(at.Type.GetCode())
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "can't convert asset for trustline to allow trust asset type")
	}

	// Set XDR auth flag
	xdrOp.Authorize = at.Authorize

	opType := xdr.OperationTypeAllowTrust
	body, err := xdr.NewOperationBody(opType, xdrOp)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to build XDR OperationBody")
	}
	op := xdr.Operation{Body: body}
	SetOpSourceAccount(&op, at.SourceAccount)
	return op, nil
}

// FromXDR for AllowTrust initialises the txnbuild struct from the corresponding xdr Operation.
func (at *AllowTrust) FromXDR(xdrOp xdr.Operation) error {
	result, ok := xdrOp.Body.GetAllowTrustOp()
	if !ok {
		return errors.New("error parsing allow_trust operation from xdr")
	}

	at.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	at.Trustor = result.Trustor.Address()
	at.Authorize = result.Authorize
	//Because AllowTrust has a special asset type, we don't use assetFromXDR() here.
	if result.Asset.Type == xdr.AssetTypeAssetTypeCreditAlphanum4 {
		code := bytes.Trim(result.Asset.AssetCode4[:], "\x00")
		at.Type = CreditAsset{Code: string(code[:])}
	}
	if result.Asset.Type == xdr.AssetTypeAssetTypeCreditAlphanum12 {
		code := bytes.Trim(result.Asset.AssetCode12[:], "\x00")
		at.Type = CreditAsset{Code: string(code[:])}
	}

	return nil
}

// Validate for AllowTrust validates the required struct fields. It returns an error if any of the fields are
// invalid. Otherwise, it returns nil.
func (at *AllowTrust) Validate() error {
	err := validateStellarPublicKey(at.Trustor)
	if err != nil {
		return NewValidationError("Trustor", err.Error())
	}

	err = validateAllowTrustAsset(at.Type)
	if err != nil {
		return NewValidationError("Type", err.Error())
	}
	return nil
}
