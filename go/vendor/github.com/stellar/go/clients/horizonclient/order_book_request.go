package horizonclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/errors"
)

// BuildURL creates the endpoint to be queried based on the data in the OrderBookRequest struct.
func (obr OrderBookRequest) BuildURL() (endpoint string, err error) {
	endpoint = "order_book"

	// add the parameters to a map here so it is easier for addQueryParams to populate the parameter list
	// We can't use assetCode and assetIssuer types here because the paremeter names are different
	paramMap := make(map[string]string)
	paramMap["selling_asset_type"] = string(obr.SellingAssetType)
	paramMap["selling_asset_code"] = obr.SellingAssetCode
	paramMap["selling_asset_issuer"] = obr.SellingAssetIssuer
	paramMap["buying_asset_type"] = string(obr.BuyingAssetType)
	paramMap["buying_asset_code"] = obr.BuyingAssetCode
	paramMap["buying_asset_issuer"] = obr.BuyingAssetIssuer

	queryParams := addQueryParams(paramMap, limit(obr.Limit))
	if queryParams != "" {
		endpoint = fmt.Sprintf("%s?%s", endpoint, queryParams)
	}

	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
	}

	return endpoint, err
}

// OrderBookHandler is a function that is called when a new order summary is received
type OrderBookHandler func(hProtocol.OrderBookSummary)

// StreamOrderBooks streams the orderbook for a given asset pair. Use context.WithCancel
// to stop streaming or context.Background() if you want to stream indefinitely.
// OrderBookHandler is a user-supplied function that is executed for each streamed order received.
func (obr OrderBookRequest) StreamOrderBooks(ctx context.Context, client *Client, handler OrderBookHandler) error {
	endpoint, err := obr.BuildURL()
	if err != nil {
		return errors.Wrap(err, "unable to build endpoint for orderbook request")
	}

	url := fmt.Sprintf("%s%s", client.fixHorizonURL(), endpoint)
	return client.stream(ctx, url, func(data []byte) error {
		var orderbook hProtocol.OrderBookSummary
		err = json.Unmarshal(data, &orderbook)
		if err != nil {
			return errors.Wrap(err, "error unmarshaling data for orderbook request")
		}
		handler(orderbook)
		return nil
	})
}
