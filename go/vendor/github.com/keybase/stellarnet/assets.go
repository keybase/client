package stellarnet

import (
	"bytes"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/stellar/go/xdr"
)

// AssetBase is an interface that any of the various data
// structures can implement.
type AssetBase interface {
	TypeString() string
	CodeString() string
	IssuerString() string
}

// AssetMinimal is a bare-bones representation of an asset.
type AssetMinimal struct {
	AssetType   string
	AssetCode   string
	AssetIssuer string
}

// NewAssetMinimal makes an AssetMinimal, inferring the asset
// type from the length of the asset code.
func NewAssetMinimal(code, issuer string) (AssetMinimal, error) {
	a := AssetMinimal{
		AssetCode:   code,
		AssetIssuer: issuer,
	}
	if len(code) == 0 && len(issuer) == 0 {
		a.AssetType = "native"
		return a, nil
	}

	var err error
	a.AssetType, err = assetCodeToType(code)
	if err != nil {
		return AssetMinimal{}, err
	}

	return a, nil
}

// TypeString implements AssetBase.
func (a AssetMinimal) TypeString() string {
	return a.AssetType
}

// CodeString implements AssetBase.
func (a AssetMinimal) CodeString() string {
	return a.AssetCode
}

// IssuerString implements AssetBase.
func (a AssetMinimal) IssuerString() string {
	return a.AssetIssuer
}

// AssetSummary summarizes the data returned by horizon for an asset.
// UnverifiedWellKnownLink is a link supplied by the asset issuer that
// needs verification.
type AssetSummary struct {
	UnverifiedWellKnownLink string
	AssetType               string
	AssetCode               string
	AssetIssuer             string
	Amount                  string
	NumAccounts             int
}

// TypeString implements AssetBase.
func (a *AssetSummary) TypeString() string {
	return a.AssetType
}

// CodeString implements AssetBase.
func (a *AssetSummary) CodeString() string {
	return a.AssetCode
}

// IssuerString implements AssetBase.
func (a *AssetSummary) IssuerString() string {
	return a.AssetIssuer
}

// Asset returns details about an asset that matches assetCode
// from issuerID.
func Asset(assetCode string, issuerID AddressStr) (*AssetSummary, error) {
	u, err := url.Parse(Client().URL + "/assets")
	if err != nil {
		return nil, errMap(err)
	}
	q := u.Query()
	q.Set("asset_code", assetCode)
	q.Set("asset_issuer", issuerID.String())
	u.RawQuery = q.Encode()

	var page AssetsPage
	err = getDecodeJSONStrict(u.String(), Client().HTTP.Get, &page)
	if err != nil {
		return nil, errMap(err)
	}

	if len(page.Embedded.Records) == 0 {
		return nil, ErrAssetNotFound
	}

	if len(page.Embedded.Records) > 1 {
		return nil, errors.New("invalid assets response: multiple matches")
	}

	r := page.Embedded.Records[0]

	summary := AssetSummary{
		UnverifiedWellKnownLink: r.Links.WellKnown.Href,
		AssetType:               r.AssetType,
		AssetCode:               r.AssetCode,
		AssetIssuer:             r.AssetIssuer,
		Amount:                  r.Amount,
		NumAccounts:             r.NumAccounts,
	}

	return &summary, nil
}

// AssetsWithCode returns all assets that use assetCode (e.g. 'USD')
// and throws an error if there are none.
func AssetsWithCode(assetCode string) ([]AssetSummary, error) {
	searchArg := AssetSearchArg{
		AssetCode: assetCode,
		IssuerID:  "",
	}
	res, err := AssetSearch(searchArg)
	if len(res) == 0 {
		return nil, ErrAssetNotFound
	}
	return res, err
}

// AssetSearchArg is the argument for passing to AssetSearch
type AssetSearchArg struct {
	AssetCode string // this is case sensitive
	IssuerID  string
}

// AssetSearch returns assets from horizon that match either an
// asset code or an issuerID or both. It will not throw an error
// if there are no valid matches.
func AssetSearch(arg AssetSearchArg) (res []AssetSummary, err error) {
	if arg.AssetCode == "" && arg.IssuerID == "" {
		// bail on an empty search
		return res, nil
	}

	u, err := url.Parse(Client().URL + "/assets")
	if err != nil {
		return nil, errMap(err)
	}
	q := u.Query()
	if len(arg.AssetCode) > 0 {
		q.Set("asset_code", arg.AssetCode)
	}
	if len(arg.IssuerID) > 0 {
		q.Set("asset_issuer", arg.IssuerID)
	}
	u.RawQuery = q.Encode()

	var page AssetsPage
	err = getDecodeJSONStrict(u.String(), Client().HTTP.Get, &page)
	if err != nil {
		return nil, errMap(err)
	}

	summaries := make([]AssetSummary, len(page.Embedded.Records))
	for i, r := range page.Embedded.Records {
		summaries[i] = AssetSummary{
			UnverifiedWellKnownLink: r.Links.WellKnown.Href,
			AssetType:               r.AssetType,
			AssetCode:               r.AssetCode,
			AssetIssuer:             r.AssetIssuer,
			Amount:                  r.Amount,
			NumAccounts:             r.NumAccounts,
		}
	}

	return summaries, nil
}

// AssetList returns a list of assets from horizon (max 200 at a time). Order should be asc or desc. Continue
// calling this with the same order and the previous cursor to fetch all of them.
func AssetList(cursor string, limit int, order string) (res []AssetSummary, nextCursor string, err error) {
	if limit < 1 || limit > 200 {
		limit = 200
	}
	u, err := url.Parse(Client().URL + "/assets")
	if err != nil {
		return nil, "", errMap(err)
	}
	q := u.Query()
	q.Set("limit", fmt.Sprintf("%d", limit))
	q.Set("order", order)
	q.Set("cursor", cursor)
	u.RawQuery = q.Encode()

	var page AssetsPage
	err = getDecodeJSONStrict(u.String(), Client().HTTP.Get, &page)
	if err != nil {
		return nil, "", errMap(err)
	}

	parsedNextLink, err := url.Parse(page.Links.Next.Href)
	if err != nil {
		return nil, "", errMap(err)
	}
	queryParams, err := url.ParseQuery(parsedNextLink.RawQuery)
	if err != nil {
		return nil, "", errMap(err)
	}
	cursorParam, ok := queryParams["cursor"]
	if !ok {
		err = errors.New("no next cursor in asset list")
		return nil, "", errMap(err)
	}
	nextCursor = cursorParam[0]

	assets := make([]AssetSummary, len(page.Embedded.Records))
	for i, r := range page.Embedded.Records {
		assets[i] = AssetSummary{
			UnverifiedWellKnownLink: r.Links.WellKnown.Href,
			AssetType:               r.AssetType,
			AssetCode:               r.AssetCode,
			AssetIssuer:             r.AssetIssuer,
			Amount:                  r.Amount,
			NumAccounts:             r.NumAccounts,
		}
	}

	return assets, nextCursor, nil
}

func makeXDRAsset(assetCode string, issuerID AddressStr) (xdr.Asset, error) {
	if len(assetCode) == 0 && len(issuerID) == 0 {
		return xdr.NewAsset(xdr.AssetTypeAssetTypeNative, nil)
	}

	issuer, err := issuerID.AccountID()
	if err != nil {
		return xdr.Asset{}, err
	}
	x := len(assetCode)
	switch {
	case x >= 1 && x <= 4:
		asset := xdr.AssetAlphaNum4{Issuer: issuer}
		copy(asset.AssetCode[:], []byte(assetCode[0:x]))
		return xdr.NewAsset(xdr.AssetTypeAssetTypeCreditAlphanum4, asset)
	case x >= 5 && x <= 12:
		asset := xdr.AssetAlphaNum12{Issuer: issuer}
		copy(asset.AssetCode[:], []byte(assetCode[0:x]))
		return xdr.NewAsset(xdr.AssetTypeAssetTypeCreditAlphanum12, asset)
	default:
		return xdr.Asset{}, errors.New("invalid assetCode length")
	}
}

func assetCodeToType(code string) (string, error) {
	x := len(code)
	switch {
	case x == 0:
		return "native", nil
	case x >= 1 && x <= 4:
		return "credit_alphanum4", nil
	case x >= 5 && x <= 12:
		return "credit_alphanum12", nil
	default:
		return "", errors.New("invalid assetCode length")
	}
}

func assetBaseIssuer(a AssetBase) (AddressStr, error) {
	return NewAddressStr(a.IssuerString())
}

func assetBaseToXDR(a AssetBase) (xdr.Asset, error) {
	if len(a.CodeString()) == 0 && len(a.IssuerString()) == 0 {
		return xdr.NewAsset(xdr.AssetTypeAssetTypeNative, nil)
	}

	issuerAddress, err := assetBaseIssuer(a)
	if err != nil {
		return xdr.Asset{}, err
	}
	issuerID, err := issuerAddress.AccountID()
	if err != nil {
		return xdr.Asset{}, err
	}

	x := len(a.CodeString())
	switch {
	case x >= 1 && x <= 4:
		asset := xdr.AssetAlphaNum4{Issuer: issuerID}
		copy(asset.AssetCode[:], []byte(a.CodeString()[0:x]))
		return xdr.NewAsset(xdr.AssetTypeAssetTypeCreditAlphanum4, asset)
	case x >= 5 && x <= 12:
		asset := xdr.AssetAlphaNum12{Issuer: issuerID}
		copy(asset.AssetCode[:], []byte(a.CodeString()[0:x]))
		return xdr.NewAsset(xdr.AssetTypeAssetTypeCreditAlphanum12, asset)
	default:
		return xdr.Asset{}, errors.New("invalid asset code length")
	}
}

// XDRToAssetMinimal transforms xdr.Asset to AssetMinimal.
func XDRToAssetMinimal(x xdr.Asset) (AssetMinimal, error) {
	switch x.Type {
	case xdr.AssetTypeAssetTypeNative:
		return AssetMinimal{}, nil
	case xdr.AssetTypeAssetTypeCreditAlphanum4:
		a := x.MustAlphaNum4()
		n := bytes.IndexByte(a.AssetCode[:], 0)
		if n == -1 {
			n = 4
		}
		return AssetMinimal{AssetCode: string(a.AssetCode[:n]), AssetIssuer: a.Issuer.Address()}, nil
	case xdr.AssetTypeAssetTypeCreditAlphanum12:
		a := x.MustAlphaNum12()
		n := bytes.IndexByte(a.AssetCode[:], 0)
		if n == -1 {
			n = 12
		}
		return AssetMinimal{AssetCode: string(a.AssetCode[:n]), AssetIssuer: a.Issuer.Address()}, nil
	default:
		return AssetMinimal{}, errors.New("invalid xdr asset type")
	}
}

// AssetBaseSummary returns a string summary of an asset.
func AssetBaseSummary(a AssetBase) string {
	if a.TypeString() == "native" {
		return "XLM"
	}
	if a.CodeString() == "" && a.IssuerString() == "" {
		return "XLM"
	}
	return strings.TrimSpace(a.CodeString()) + "/" + strings.TrimSpace(a.IssuerString())
}

// XDRAssetSummary returns a string summary of an xdr.Asset.
func XDRAssetSummary(x xdr.Asset) string {
	a, err := XDRToAssetMinimal(x)
	if err != nil {
		return "invalid asset"
	}
	return AssetBaseSummary(a)
}

// XDRAssetAmountSummary returns a summary of an amount and an asset.
func XDRAssetAmountSummary(amt xdr.Int64, asset xdr.Asset) string {
	return StringFromStellarXdrAmount(amt) + " " + XDRAssetSummary(asset)
}
