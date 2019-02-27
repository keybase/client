package stellarnet

import (
	"errors"
	"net/url"
)

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
