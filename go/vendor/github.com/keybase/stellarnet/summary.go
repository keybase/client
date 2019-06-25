package stellarnet

import (
	"fmt"
	"strings"

	"github.com/stellar/go/xdr"
)

// OpSummary returns a string summary of an operation.
func OpSummary(op xdr.Operation, pastTense bool) string {
	body := opBodySummary(op, pastTense)
	if op.SourceAccount != nil {
		return fmt.Sprintf("[Source account %s] %s", op.SourceAccount.Address(), body)
	}
	return body
}

func opBodySummary(op xdr.Operation, pastTense bool) string {
	past := func(suffix string) string {
		if pastTense {
			return suffix
		}
		return ""
	}
	tense := func(present, past string) string {
		if pastTense {
			return past
		}
		return present
	}
	switch op.Body.Type {
	case xdr.OperationTypeCreateAccount:
		iop := op.Body.MustCreateAccountOp()
		return fmt.Sprintf("Create%s account %s with starting balance of %s XLM", past("d"), iop.Destination.Address(), StringFromStellarXdrAmount(iop.StartingBalance))
	case xdr.OperationTypePayment:
		iop := op.Body.MustPaymentOp()
		return fmt.Sprintf("%s %s to account %s", tense("Pay", "Paid"), XDRAssetAmountSummary(iop.Amount, iop.Asset), iop.Destination.Address())
	case xdr.OperationTypePathPayment:
		iop := op.Body.MustPathPaymentOp()
		return fmt.Sprintf("%s %s to account %s using at most %s", tense("Pay", "Paid"), XDRAssetAmountSummary(iop.DestAmount, iop.DestAsset), iop.Destination.Address(), XDRAssetAmountSummary(iop.SendMax, iop.SendAsset))
	case xdr.OperationTypeManageSellOffer:
		iop := op.Body.MustManageSellOfferOp()
		switch {
		case iop.OfferId == 0:
			return fmt.Sprintf("Create%s offer selling %s for %s to buy %s", past("d"), XDRAssetAmountSummary(iop.Amount, iop.Selling), iop.Price.String(), XDRAssetSummary(iop.Buying))
		case iop.Amount == 0:
			return fmt.Sprintf("Remove%s offer selling %s for %s to buy %s (id %d)", past("d"), XDRAssetSummary(iop.Selling), iop.Price.String(), XDRAssetSummary(iop.Buying), iop.OfferId)
		default:
			return fmt.Sprintf("Update%s offer selling %s for %s to buy %s (id %d)", past("d"), XDRAssetAmountSummary(iop.Amount, iop.Selling), iop.Price.String(), XDRAssetSummary(iop.Buying), iop.OfferId)
		}
	case xdr.OperationTypeCreatePassiveSellOffer:
		iop := op.Body.MustCreatePassiveSellOfferOp()
		if iop.Amount == 0 {
			return fmt.Sprintf("Remove%s passive offer selling %s for %s to buy %s", past("d"), XDRAssetSummary(iop.Selling), iop.Price.String(), XDRAssetSummary(iop.Buying))
		}
		return fmt.Sprintf("Create%s passive offer selling %s for %s to buy %s", past("d"), XDRAssetAmountSummary(iop.Amount, iop.Selling), iop.Price.String(), XDRAssetSummary(iop.Buying))
	case xdr.OperationTypeSetOptions:
		iop := op.Body.MustSetOptionsOp()
		var all []string
		if iop.InflationDest != nil {
			all = append(all, fmt.Sprintf("Set inflation destination to %s", iop.InflationDest.Address()))
		}
		if iop.ClearFlags != nil {
			all = append(all, fmt.Sprintf("Clear%s account flags %b", past("ed"), *iop.ClearFlags))
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
			return fmt.Sprintf("Remove%s trust line to %s", past("d"), XDRAssetSummary(iop.Line))
		}
		const defaultPositiveLimit xdr.Int64 = 9223372036854775807
		if iop.Limit == defaultPositiveLimit {
			return fmt.Sprintf("Establish%s trust line to %s", past("ed"), XDRAssetSummary(iop.Line))
		}
		return fmt.Sprintf("Establish%s trust line to %s with limit %v", past("ed"), XDRAssetSummary(iop.Line), iop.Limit)
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
			return fmt.Sprintf("Authorize%s trustline to %s for %s", past("d"), assetCode, iop.Trustor.Address())
		}
		return fmt.Sprintf("Deauthorize%s trustline to %s for %s", past("d"), assetCode, iop.Trustor.Address())
	case xdr.OperationTypeAccountMerge:
		// oh of cource, MustDestination...why would it possibly match
		// everything else?
		destination := op.Body.MustDestination()
		return fmt.Sprintf("Merge%s account into %s", past("d"), destination.Address())
	case xdr.OperationTypeManageData:
		iop := op.Body.MustManageDataOp()
		if iop.DataValue == nil {
			return fmt.Sprintf("Remove%s data %q", past("d"), iop.DataName)
		}
		return fmt.Sprintf("Add%s data with key %s, hex of binary data %x", past("ed"), iop.DataName, iop.DataValue)
	default:
		return "invalid operation type"
	}
}
