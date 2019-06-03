package stellarsvc

// Stuff copied from stellard for mocks

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/xdr"
)

type ExtractedPayment struct {
	Tx         xdr.Transaction
	OpType     xdr.OperationType
	From       stellar1.AccountID
	To         stellar1.AccountID
	AmountXdr  xdr.Int64
	Amount     string
	Asset      stellar1.Asset
	TimeBounds *xdr.TimeBounds
}

// Extract the balance transfer from a transaction.
// Errors out if not all conditions are met:
// - Tx has one operation
// - The operation is one of the types [payment, create_account]
// - The per-operation source account override is not set
func extractPaymentTx(tx xdr.Transaction) (res ExtractedPayment, err error) {
	res.Tx = tx
	if len(tx.Operations) == 0 {
		return res, fmt.Errorf("transaction had no operations")
	}
	if len(tx.Operations) != 1 {
		return res, fmt.Errorf("transaction must contain only 1 operation but had %v", len(tx.Operations))
	}
	if tx.Operations[0].SourceAccount != nil {
		return res, fmt.Errorf("transaction operation must not override source account")
	}
	res.From = stellar1.AccountID(tx.SourceAccount.Address())
	op := tx.Operations[0].Body
	res.OpType = op.Type
	res.TimeBounds = tx.TimeBounds
	if op, ok := op.GetPaymentOp(); ok {
		res.To = stellar1.AccountID(op.Destination.Address())
		res.AmountXdr = op.Amount
		res.Amount, res.Asset, err = balanceXdrToProto(op.Amount, op.Asset)
		if err != nil {
			return res, err
		}
		return res, nil
	}
	if op, ok := op.GetCreateAccountOp(); ok {
		res.To = stellar1.AccountID(op.Destination.Address())
		res.AmountXdr = op.StartingBalance
		res.Amount = stellarnet.StringFromStellarXdrAmount(op.StartingBalance)
		res.Asset = stellar1.AssetNative()
		return res, nil
	}
	return res, fmt.Errorf("unexpected op type: %v", op.Type)
}

type ExtractedRelocate struct {
	Tx xdr.Transaction
	// Source can be any account. They pay the fees.
	Source stellar1.AccountID
	From   stellar1.AccountID
	To     stellar1.AccountID
}

// Extract a transaction that transfers all balance into another account.
// Errors out if not all conditions are met:
// Case 1: account_merge operation
// - Tx has one operation
// - The operation is of type account_merge
// Case 2: Two ops: [create_account, account_merge]
// - Tx has two operations operation
// - ops[0] is of type create_account for 1 XLM
// - ops[1] is of type account_merge to the same destination address
func extractRelocateTx(tx xdr.Transaction) (res ExtractedRelocate, err error) {
	res.Tx = tx
	if len(tx.Operations) == 0 {
		return res, fmt.Errorf("transaction had no operations")
	}
	if len(tx.Operations) > 2 {
		return res, fmt.Errorf("transaction must contain <=2 operations but had %v", len(tx.Operations))
	}
	res.Source = stellar1.AccountID(tx.SourceAccount.Address())
	res.From = stellar1.AccountID(tx.SourceAccount.Address())
	opFinal := tx.Operations[len(tx.Operations)-1]
	if opFinal.SourceAccount != nil {
		res.From = stellar1.AccountID(opFinal.SourceAccount.Address())
	}
	destination, ok := opFinal.Body.GetDestination()
	if !ok {
		return res, fmt.Errorf("unexpected final operation type: %v", opFinal.Body.Type)
	}
	res.To = stellar1.AccountID(destination.Address())
	if len(tx.Operations) == 1 {
		// Return case 1
		return res, nil
	}
	opFirst := tx.Operations[0]
	if opFirst.SourceAccount != nil && !stellar1.AccountID(opFirst.SourceAccount.Address()).Eq(res.From) {
		return res, fmt.Errorf("unexpected mismatch in operations' from fields: %v != %v",
			stellar1.AccountID(opFirst.SourceAccount.Address()), res.From)
	}
	createAccount, ok := opFirst.Body.GetCreateAccountOp()
	if !ok {
		return res, fmt.Errorf("unexpected first operation type: %v", opFirst.Body.Type)
	}
	if !stellar1.AccountID(createAccount.Destination.Address()).Eq(res.To) {
		return res, fmt.Errorf("unexpected mismatch in operations' destination fields: %v != %v",
			res.To, stellar1.AccountID(createAccount.Destination.Address()))
	}
	if createAccount.StartingBalance != xdr.Int64(10000000) {
		return res, fmt.Errorf("unexpected relocation amount: %v != 1 XLM", stellarnet.StringFromStellarXdrAmount(createAccount.StartingBalance))
	}
	// Return case 2
	return res, nil
}

func balanceXdrToProto(amountXdr xdr.Int64, assetXdr xdr.Asset) (amount string, asset stellar1.Asset, err error) {
	unpad := func(in []byte) (out string) {
		return strings.TrimRight(string(in), string([]byte{0}))
	}
	amount = stellarnet.StringFromStellarXdrAmount(amountXdr)
	switch assetXdr.Type {
	case xdr.AssetTypeAssetTypeNative:
		return amount, stellar1.AssetNative(), nil
	case xdr.AssetTypeAssetTypeCreditAlphanum4:
		if assetXdr.AlphaNum4 == nil {
			return amount, asset, fmt.Errorf("balance missing alphanum4")
		}
		return amount, stellar1.Asset{
			Type:   "credit_alphanum4",
			Code:   unpad(assetXdr.AlphaNum4.AssetCode[:]),
			Issuer: assetXdr.AlphaNum4.Issuer.Address(),
		}, nil
	case xdr.AssetTypeAssetTypeCreditAlphanum12:
		if assetXdr.AlphaNum12 == nil {
			return amount, asset, fmt.Errorf("balance missing alphanum12")
		}
		return amount, stellar1.Asset{
			Type:   "credit_alphanum12",
			Code:   unpad(assetXdr.AlphaNum12.AssetCode[:]),
			Issuer: assetXdr.AlphaNum12.Issuer.Address(),
		}, nil
	default:
		return amount, asset, fmt.Errorf("unsupported asset type: %v", assetXdr.Type)
	}
}
