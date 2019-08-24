package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

func FormatCurrency(mctx libkb.MetaContext, amount string, code stellar1.OutsideCurrencyCode, rounding stellarnet.FmtRoundingBehavior) (string, error) {
	conf, err := mctx.G().GetStellar().GetServerDefinitions(mctx.Ctx())
	if err != nil {
		return "", err
	}
	currency, ok := conf.Currencies[code]
	if !ok {
		return "", fmt.Errorf("FormatCurrency error: cannot find curency code %q", code)
	}

	return stellarnet.FmtCurrency(amount, rounding, currency.Symbol.Symbol, currency.Symbol.Postfix)
}

// FormatCurrencyWithCodeSuffix will return a fiat currency amount formatted with
// its currency code suffix at the end, like "$123.12 CLP"
func FormatCurrencyWithCodeSuffix(mctx libkb.MetaContext, amount string, code stellar1.OutsideCurrencyCode, rounding stellarnet.FmtRoundingBehavior) (string, error) {
	conf, err := mctx.G().GetStellar().GetServerDefinitions(mctx.Ctx())
	if err != nil {
		return "", err
	}
	currency, ok := conf.Currencies[code]
	if !ok {
		return "", fmt.Errorf("FormatCurrencyWithCodeSuffix error: cannot find curency code %q", code)
	}
	return stellarnet.FmtCurrencyWithCodeSuffix(amount, rounding, string(code), currency.Symbol.Symbol, currency.Symbol.Postfix)
}

// Return an error if asset is completely outside of what we understand, like
// asset unknown types or unexpected length.
func assertAssetIsSane(asset stellar1.Asset) error {
	switch asset.Type {
	case "credit_alphanum4", "credit_alphanum12":
	case "alphanum4", "alphanum12": // These prefixes that are missing "credit_" shouldn't show up, but just to be on the safe side.
	default:
		return fmt.Errorf("unrecognized asset type: %v", asset.Type)
	}
	// Sanity check asset code very loosely. We know tighter bounds but there's no need to fail here.
	if len(asset.Code) == 0 || len(asset.Code) >= 20 {
		return fmt.Errorf("invalid asset code: %v", asset.Code)
	}
	return nil
}

// Example: "157.5000000 XLM"
// Example: "12.9000000 USD"
//   (where USD is a non-native asset issued by someone).
// User interfaces should be careful to never give user just amount + asset
// code, but annotate when it's a non-native asset and make Issuer ID and
// Verified Domain visible.
// If you are coming from CLI, FormatAmountDescriptionAssetEx might be a better
// choice which is more verbose about non-native assets.
func FormatAmountDescriptionAsset(mctx libkb.MetaContext, amount string, asset stellar1.Asset) (string, error) {
	if asset.IsNativeXLM() {
		return FormatAmountDescriptionXLM(mctx, amount)
	}
	if err := assertAssetIsSane(asset); err != nil {
		return "", err
	}
	// Sanity check asset issuer.
	if _, err := libkb.ParseStellarAccountID(asset.Issuer); err != nil {
		return "", fmt.Errorf("asset issuer is not account ID: %v", asset.Issuer)
	}
	return FormatAmountWithSuffix(mctx, amount, false /* precisionTwo */, false /* simplify */, asset.Code)
}

// FormatAmountDescriptionAssetEx is a more verbose version of FormatAmountDescriptionAsset.
// In case of non-native asset, it includes issuer domain (or "Unknown") and issuer ID.
// Example: "157.5000000 XLM"
// Example: "1,000.15 CATS/catmoney.example.com (GDWVJEG7CMYKRYGB2MWSRZNSPCWIGGA4FRNFTQBIR6RAEPNEGGEH4XYZ)"
// Example: "1,000.15 BTC/Unknown (GBPEHURSE52GCBRPDWNV2VL3HRLCI42367OGRPBOO3AW6VAYEW5EO5PM)"
func FormatAmountDescriptionAssetEx(mctx libkb.MetaContext, amount string, asset stellar1.Asset) (string, error) {
	if asset.IsNativeXLM() {
		return FormatAmountDescriptionXLM(mctx, amount)
	}
	if err := assertAssetIsSane(asset); err != nil {
		return "", err
	}
	// Sanity check asset issuer.
	issuerAccountID, err := libkb.ParseStellarAccountID(asset.Issuer)
	if err != nil {
		return "", fmt.Errorf("asset issuer is not account ID: %v", asset.Issuer)
	}
	amountFormatted, err := FormatAmount(mctx, amount, false /* precisionTwo */, stellarnet.Round)
	if err != nil {
		return "", err
	}
	var issuerDesc string
	if asset.VerifiedDomain != "" {
		issuerDesc = asset.VerifiedDomain
	} else {
		issuerDesc = "Unknown"
	}
	return fmt.Sprintf("%s %s/%s (%s)", amountFormatted, asset.Code, issuerDesc, issuerAccountID.String()), nil
}

// FormatAmountDescriptionAssetEx2 is like FormatAmountDescriptionAssetEx,
// except that it only shows one of issuer domain and issuer account ID. When
// issuer domain is available, the domain is shown. Otherwise account ID is
// used.
// Example: "157.5000000 XLM"
// Example: "1,000.15 CATS/catmoney.example.com
// Example: "1,000.15 BTC/GBPEHURSE52GCBRPDWNV2VL3HRLCI42367OGRPBOO3AW6VAYEW5EO5PM"
func FormatAmountDescriptionAssetEx2(mctx libkb.MetaContext, amount string, asset stellar1.Asset) (string, error) {
	if asset.IsNativeXLM() {
		return FormatAmountDescriptionXLM(mctx, amount)
	}
	if err := assertAssetIsSane(asset); err != nil {
		return "", err
	}
	// Sanity check asset issuer.
	issuerAccountID, err := libkb.ParseStellarAccountID(asset.Issuer)
	if err != nil {
		return "", fmt.Errorf("asset issuer is not account ID: %v", asset.Issuer)
	}
	amountFormatted, err := FormatAmount(mctx, amount, false /* precisionTwo */, stellarnet.Round)
	if err != nil {
		return "", err
	}
	var issuerDesc string
	if asset.VerifiedDomain != "" {
		issuerDesc = asset.VerifiedDomain
	} else {
		issuerDesc = issuerAccountID.String()
	}
	return fmt.Sprintf("%s %s/%s", amountFormatted, asset.Code, issuerDesc), nil
}

// FormatAssetIssuerString returns "Unknown issuer" if asset does not have a
// verified domain, or returns asset verified domain if it does (e.g.
// "example.com").
func FormatAssetIssuerString(asset stellar1.Asset) string {
	if asset.VerifiedDomain != "" {
		return asset.VerifiedDomain
	}
	iaid := asset.IssuerString()
	iaidLen := len(iaid)
	switch {
	case iaidLen > 16:
		return iaid[:8] + "..." + iaid[iaidLen-8:]
	case iaidLen > 0:
		return iaid
	default:
		return "Unknown issuer"
	}
}

// Example: "157.5000000 XLM"
func FormatAmountDescriptionXLM(mctx libkb.MetaContext, amount string) (string, error) {
	// Do not simplify XLM amounts, all zeroes are important because
	// that's the exact number of digits that Stellar protocol
	// supports.
	return FormatAmountWithSuffix(mctx, amount, false /* precisionTwo */, false /* simplify */, "XLM")
}

func FormatAmountWithSuffix(mctx libkb.MetaContext, amount string, precisionTwo bool, simplify bool, suffix string) (string, error) {
	formatted, err := FormatAmount(mctx, amount, precisionTwo, stellarnet.Round)
	if err != nil {
		return "", err
	}
	if simplify {
		formatted = libkb.StellarSimplifyAmount(formatted)
	}
	return fmt.Sprintf("%s %s", formatted, suffix), nil
}

func FormatAmount(mctx libkb.MetaContext, amount string, precisionTwo bool, rounding stellarnet.FmtRoundingBehavior) (string, error) {
	if amount == "" {
		EmptyAmountStack(mctx)
		return "", fmt.Errorf("empty amount")
	}
	return stellarnet.FmtAmount(amount, precisionTwo, rounding)
}
