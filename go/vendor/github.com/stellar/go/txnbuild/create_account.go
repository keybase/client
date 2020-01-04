package txnbuild

import (
	"github.com/stellar/go/amount"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// CreateAccount represents the Stellar create account operation. See
// https://www.stellar.org/developers/guides/concepts/list-of-operations.html
type CreateAccount struct {
	Destination   string
	Amount        string
	SourceAccount Account
}

// BuildXDR for CreateAccount returns a fully configured XDR Operation.
func (ca *CreateAccount) BuildXDR() (xdr.Operation, error) {
	var xdrOp xdr.CreateAccountOp

	err := xdrOp.Destination.SetAddress(ca.Destination)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to set destination address")
	}

	xdrOp.StartingBalance, err = amount.Parse(ca.Amount)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to parse amount")
	}

	opType := xdr.OperationTypeCreateAccount
	body, err := xdr.NewOperationBody(opType, xdrOp)
	if err != nil {
		return xdr.Operation{}, errors.Wrap(err, "failed to build XDR OperationBody")
	}
	op := xdr.Operation{Body: body}
	SetOpSourceAccount(&op, ca.SourceAccount)
	return op, nil
}

// FromXDR for CreateAccount initialises the txnbuild struct from the corresponding xdr Operation.
func (ca *CreateAccount) FromXDR(xdrOp xdr.Operation) error {
	result, ok := xdrOp.Body.GetCreateAccountOp()
	if !ok {
		return errors.New("error parsing create_account operation from xdr")
	}

	ca.SourceAccount = accountFromXDR(xdrOp.SourceAccount)
	ca.Destination = result.Destination.Address()
	ca.Amount = amount.String(result.StartingBalance)

	return nil
}

// Validate for CreateAccount validates the required struct fields. It returns an error if any of the fields are
// invalid. Otherwise, it returns nil.
func (ca *CreateAccount) Validate() error {
	err := validateStellarPublicKey(ca.Destination)
	if err != nil {
		return NewValidationError("Destination", err.Error())
	}

	err = validateAmount(ca.Amount)
	if err != nil {
		return NewValidationError("Amount", err.Error())
	}

	return nil
}
