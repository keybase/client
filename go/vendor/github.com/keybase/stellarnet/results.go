package stellarnet

import (
	"errors"

	"github.com/stellar/go/xdr"
)

// PathPaymentSourceAmount unpacks a result XDR string and
// calculates the amount of the source asset that was spent
// by adding up all the offers.
func PathPaymentSourceAmount(resultXDR string, opIndex int) (string, error) {
	var result xdr.TransactionResult
	if err := xdr.SafeUnmarshalBase64(resultXDR, &result); err != nil {
		return "", err
	}
	if result.Result.Code != xdr.TransactionResultCodeTxSuccess {
		return "", errors.New("cannot calculate path payment source amount for failed tx")
	}
	ops, ok := result.Result.GetResults()
	if !ok {
		return "", errors.New("could not get tx result operations")
	}
	if opIndex >= len(ops) {
		return "", errors.New("opIndex is out of range")
	}
	op := ops[opIndex]
	tr, ok := op.GetTr()
	if !ok {
		return "", errors.New("could not get OperationResultTr out of operation")
	}
	pathResult, ok := tr.GetPathPaymentResult()
	if !ok {
		return "", errors.New("could not get PathPaymentResult out of tr")
	}

	sendAmount := pathResult.SendAmount()

	return StringFromStellarXdrAmount(sendAmount), nil
}

// PathPaymentIntermediatePath unpacks an envelope XDR string to
// get the intermediate path assets.
// These are the intermediate assets that we used to form a
// payment path from the source asset to the destination asset.
// Note that the source asset and destination asset are not in this list.
// The order of the assets is from source asset to destination asset.
func PathPaymentIntermediatePath(envelopeXDR string, opIndex int) ([]AssetMinimal, error) {
	var tx xdr.TransactionEnvelope
	if err := xdr.SafeUnmarshalBase64(envelopeXDR, &tx); err != nil {
		return nil, err
	}
	if opIndex >= len(tx.Tx.Operations) {
		return nil, errors.New("opIndex out of range")
	}
	op := tx.Tx.Operations[opIndex]
	if op.Body.Type != xdr.OperationTypePathPayment {
		return nil, errors.New("not a path payment")
	}
	pathOp, ok := op.Body.GetPathPaymentOp()
	if !ok {
		return nil, errors.New("not a path payment")
	}
	path := make([]AssetMinimal, len(pathOp.Path))
	for i, a := range pathOp.Path {
		am, err := XDRToAssetMinimal(a)
		if err != nil {
			return nil, err
		}
		path[i] = am
	}

	return path, nil
}
