package stellarnet

import (
	"fmt"
	"strings"

	"github.com/stellar/go/xdr"
)

// OpSummary returns a string summary of an operation.
func OpSummary(op xdr.Operation) string {
	body := opBodySummary(op)
	if op.SourceAccount != nil {
		return fmt.Sprintf("[Source account %s] %s", op.SourceAccount.Address(), body)
	}
	return body
}

func opBodySummary(op xdr.Operation) string {
	switch op.Body.Type {
	case xdr.OperationTypeCreateAccount:
		iop := op.Body.MustCreateAccountOp()
		return fmt.Sprintf("Create account %s with starting balance of %s XLM", iop.Destination.Address(), StringFromStellarXdrAmount(iop.StartingBalance))
	case xdr.OperationTypePayment:
		iop := op.Body.MustPaymentOp()
		return fmt.Sprintf("Pay %s to account %s", XDRAssetAmountSummary(iop.Amount, iop.Asset), iop.Destination.Address())
	case xdr.OperationTypePathPayment:
		iop := op.Body.MustPathPaymentOp()
		return fmt.Sprintf("Pay %s to account %s using at most %s", XDRAssetAmountSummary(iop.DestAmount, iop.DestAsset), iop.Destination.Address(), XDRAssetAmountSummary(iop.SendMax, iop.SendAsset))
	case xdr.OperationTypeManageOffer:
		iop := op.Body.MustManageOfferOp()
		switch {
		case iop.OfferId == 0:
			return fmt.Sprintf("Create offer selling %s for %s to buy %s", XDRAssetAmountSummary(iop.Amount, iop.Selling), XDRPriceString(iop.Price), XDRAssetSummary(iop.Buying))
		case iop.Amount == 0:
			return fmt.Sprintf("Remove offer selling %s for %s to buy %s (id %d)", XDRAssetSummary(iop.Selling), XDRPriceString(iop.Price), XDRAssetSummary(iop.Buying), iop.OfferId)
		default:
			return fmt.Sprintf("Update offer selling %s for %s to buy %s (id %d)", XDRAssetAmountSummary(iop.Amount, iop.Selling), XDRPriceString(iop.Price), XDRAssetSummary(iop.Buying), iop.OfferId)
		}
	case xdr.OperationTypeCreatePassiveOffer:
		iop := op.Body.MustCreatePassiveOfferOp()
		if iop.Amount == 0 {
			return fmt.Sprintf("Remove passive offer selling %s for %s to buy %s", XDRAssetSummary(iop.Selling), XDRPriceString(iop.Price), XDRAssetSummary(iop.Buying))
		}
		return fmt.Sprintf("Create passive offer selling %s for %s to buy %s", XDRAssetAmountSummary(iop.Amount, iop.Selling), XDRPriceString(iop.Price), XDRAssetSummary(iop.Buying))
	case xdr.OperationTypeSetOptions:
		iop := op.Body.MustSetOptionsOp()
		var all []string
		if iop.InflationDest != nil {
			all = append(all, fmt.Sprintf("Set inflation destination to %s", iop.InflationDest.Address()))
		}
		if iop.ClearFlags != nil {
			all = append(all, fmt.Sprintf("Clear account flags %b", *iop.ClearFlags))
		}
		if iop.SetFlags != nil {
			all = append(all, fmt.Sprintf("Set account flags %b", *iop.SetFlags))
		}
		if iop.MasterWeight != nil {
			all = append(all, fmt.Sprintf("Set master key weight to %d", *iop.MasterWeight))
		}
		if iop.LowThreshold != nil {
			all = append(all, fmt.Sprintf("Set low threshold to %d", *iop.LowThreshold))
		}
		if iop.MedThreshold != nil {
			all = append(all, fmt.Sprintf("Set medium threshold to %d", *iop.MedThreshold))
		}
		if iop.HighThreshold != nil {
			all = append(all, fmt.Sprintf("Set high threshold to %d", *iop.HighThreshold))
		}
		if iop.HomeDomain != nil {
			all = append(all, fmt.Sprintf("Set home domain to %q", *iop.HomeDomain))
		}
		if iop.Signer != nil {
			all = append(all, fmt.Sprintf("Set signer key %s with weight %d", iop.Signer.Key.Address(), iop.Signer.Weight))
		}
		return strings.Join(all, "\n")
	case xdr.OperationTypeChangeTrust:
		iop := op.Body.MustChangeTrustOp()
		if iop.Limit == 0 {
			return fmt.Sprintf("Remove trust line to %s", XDRAssetSummary(iop.Line))
		} else {
			return fmt.Sprintf("Establish trust line to %s with limit %v", XDRAssetSummary(iop.Line), iop.Limit)
		}
	case xdr.OperationTypeAllowTrust:
		iop := op.Body.MustAllowTrustOp()
		var assetCode string
		switch iop.Asset.Type {
		case xdr.AssetTypeAssetTypeCreditAlphanum4:
			code := iop.Asset.MustAssetCode4()
			assetCode = string(code[:])
		case xdr.AssetTypeAssetTypeCreditAlphanum12:
			code := iop.Asset.MustAssetCode12()
			assetCode = string(code[:])
		default:
			return "invalid allow trust asset code"
		}
		if iop.Authorize {
			return fmt.Sprintf("Authorize trustline to %s for %s", assetCode, iop.Trustor.Address())
		} else {
			return fmt.Sprintf("Deauthorize trustline to %s for %s", assetCode, iop.Trustor.Address())
		}
	case xdr.OperationTypeAccountMerge:
		// oh of cource, MustDestination...why would it possibly match
		// everything else?
		destination := op.Body.MustDestination()
		return fmt.Sprintf("Merge account into %s", destination.Address())
	case xdr.OperationTypeManageData:
		iop := op.Body.MustManageDataOp()
		if iop.DataValue == nil {
			return fmt.Sprintf("Remove data %q", iop.DataName)
		}
		return fmt.Sprintf("Add data with key %s, hex of binary data %x", iop.DataName, iop.DataValue)
	default:
		return "invalid operation type"
	}
}
