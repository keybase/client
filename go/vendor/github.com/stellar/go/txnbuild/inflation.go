package txnbuild

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// Inflation represents the Stellar inflation operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type Inflation struct {
	SourceAccount Account
}

// BuildXDR for Inflation returns a fully configured XDR Operation.
func (inf *Inflation) BuildXDR() (xdr.Operation, error) {
	opType := xdr.OperationTypeInflation
	body, err := xdr.NewOperationBody(opType, nil)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to build XDR OperationBody")
	}
	op := xdr.Operation{Body: body}
	SetOpSourceAccount(&op, inf.SourceAccount)
	return op, nil
}

// FromXDR for Inflation initialises the txnbuild struct from the corresponding xdr Operation.
func (inf *Inflation) FromXDR(xdrOp xdr.Operation) error {
	if xdrOp.Body.Type != xdr.OperationTypeInflation {
		return errors.New("error parsing inflation operation from xdr")
	}
	inf.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	return nil
}

// Validate for Inflation is just a method that implements the Operation interface. No logic is actually performed
// because the inflation operation does not have any required field. Nil is always returned.
func (inf *Inflation) Validate() error {
	// no required fields, return nil.
	return nil
}
