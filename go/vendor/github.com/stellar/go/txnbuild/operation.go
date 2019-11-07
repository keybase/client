package txnbuild

import (
	"github.com/stellar/go/xdr"
)

// Operation represents the operation types of the Stellar network.
type Operation interface {
	BuildXDR() (xdr.Operation, error)
	FromXDR(xdrOp xdr.Operation) error
	Validate() error
}

// SetOpSourceAccount sets the source account ID on an Operation.
func SetOpSourceAccount(op *xdr.Operation, sourceAccount Account) {
	if sourceAccount == nil {
		return
	}
	var opSourceAccountID xdr.AccountId
	opSourceAccountID.SetAddress(sourceAccount.GetAccountID())
	op.SourceAccount = &opSourceAccountID
}

// operationFromXDR returns a txnbuild Operation from its corresponding XDR operation
func operationFromXDR(xdrOp xdr.Operation) (Operation, error) {
	var newOp Operation
	switch xdrOp.Body.Type {
	case xdr.OperationTypeCreateAccount:
		newOp = &CreateAccount{}
	case xdr.OperationTypePayment:
		newOp = &Payment{}
	case xdr.OperationTypePathPaymentStrictReceive:
		newOp = &PathPayment{}
	case xdr.OperationTypeManageSellOffer:
		newOp = &ManageSellOffer{}
	case xdr.OperationTypeCreatePassiveSellOffer:
		newOp = &CreatePassiveSellOffer{}
	case xdr.OperationTypeSetOptions:
		newOp = &SetOptions{}
	case xdr.OperationTypeChangeTrust:
		newOp = &ChangeTrust{}
	case xdr.OperationTypeAllowTrust:
		newOp = &AllowTrust{}
	case xdr.OperationTypeAccountMerge:
		newOp = &AccountMerge{}
	case xdr.OperationTypeInflation:
		newOp = &Inflation{}
	case xdr.OperationTypeManageData:
		newOp = &ManageData{}
	case xdr.OperationTypeBumpSequence:
		newOp = &BumpSequence{}
	case xdr.OperationTypeManageBuyOffer:
		newOp = &ManageBuyOffer{}
	case xdr.OperationTypePathPaymentStrictSend:
		newOp = &PathPaymentStrictSend{}
	}

	err := newOp.FromXDR(xdrOp)
	return newOp, err
}

// accountFromXDR returns a txnbuild Account from a XDR Account.
func accountFromXDR(account *xdr.AccountId) Account {
	if account != nil {
		return &SimpleAccount{AccountID: account.Address()}
	}
	return nil
}
