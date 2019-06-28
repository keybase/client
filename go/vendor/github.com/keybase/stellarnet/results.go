package stellarnet

import (
	"errors"

	"github.com/stellar/go/xdr"
)

// PathPaymentSourceAmount unpacks a result XDR string and
// calculates the amount of the source asset that was spent
// by adding up all the offers.
func PathPaymentSourceAmount(resultXDR string) (string, error) {
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
	if len(ops) != 1 {
		return "", errors.New("cannot handle multi-operation result")
	}
	op := ops[0]
	tr, ok := op.GetTr()
	if !ok {
		return "", errors.New("could not get OperationResultTr out of operation")
	}
	pathResult, ok := tr.GetPathPaymentResult()
	if !ok {
		return "", errors.New("could not get PathPaymentResult out of tr")
	}
	success, ok := pathResult.GetSuccess()
	if !ok {
		return "", errors.New("path payment not successful, cannot calculate source amount")
	}

	if len(success.Offers) == 0 {
		return StringFromStellarXdrAmount(success.Last.Amount), nil
	}

	// finally, we have the offers...the sum of the AmountBought values should
	// be the total of the source asset that the sender spent.
	var total xdr.Int64
	for _, offer := range success.Offers {
		total += offer.AmountBought
	}

	return StringFromStellarXdrAmount(total), nil
}

// PathPaymentIntermediatePath unpacks an envelope XDR string to
// get the intermediate path assets.
// These are the intermediate assets that we used to form a
// payment path from the source asset to the destination asset.
// Note that the source asset and destination asset are not in this list.
// The order of the assets is from source asset to destination asset.
func PathPaymentIntermediatePath(envelopeXDR string) ([]AssetMinimal, error) {
	var tx xdr.TransactionEnvelope
	if err := xdr.SafeUnmarshalBase64(envelopeXDR, &tx); err != nil {
		return nil, err
	}
	if len(tx.Tx.Operations) != 1 {
		return nil, errors.New("cannot handle multi-operation result")
	}
	op := tx.Tx.Operations[0]
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
