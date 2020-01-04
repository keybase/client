package horizonclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/errors"
)

// BuildURL creates the endpoint to be queried based on the data in the TradeRequest struct.
// If no data is set, it defaults to the build the URL for all trades
func (tr TradeRequest) BuildURL() (endpoint string, err error) {
	nParams := countParams(tr.ForAccount, tr.ForOfferID)

	if nParams > 1 {
		return endpoint, errors.New("invalid request: too many parameters")
	}

	endpoint = "trades"
	if tr.ForAccount != "" {
		endpoint = fmt.Sprintf("accounts/%s/trades", tr.ForAccount)
	}

	// Note[Peter - 28/03/2019]: querying an "all trades" endpoint that has the query parameter
	// for offer_id is the same as querying the url for trades of a particular offer. The results
	// returned will be the same. So, I am opting to build the endpoint for trades per offer when
	// `ForOfferID` is set
	if tr.ForOfferID != "" {
		endpoint = fmt.Sprintf("offers/%s/trades", tr.ForOfferID)
	}

	var queryParams string

	if endpoint != "trades" {
		queryParams = addQueryParams(cursor(tr.Cursor), limit(tr.Limit), tr.Order)
	} else {
		// add the parameters for all trades endpoint
		paramMap := make(map[string]string)
		paramMap["base_asset_type"] = string(tr.BaseAssetType)
		paramMap["base_asset_code"] = tr.BaseAssetCode
		paramMap["base_asset_issuer"] = tr.BaseAssetIssuer
		paramMap["counter_asset_type"] = string(tr.CounterAssetType)
		paramMap["counter_asset_code"] = tr.CounterAssetCode
		paramMap["counter_asset_issuer"] = tr.CounterAssetIssuer
		paramMap["offer_id"] = tr.ForOfferID

		queryParams = addQueryParams(paramMap, cursor(tr.Cursor), limit(tr.Limit), tr.Order)
	}

	if queryParams != "" {
		endpoint = fmt.Sprintf("%s?%s", endpoint, queryParams)
	}

	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
	}

	return endpoint, err
}

// TradeHandler is a function that is called when a new trade is received
type TradeHandler func(hProtocol.Trade)

// StreamTrades streams executed trades. It can be used to stream all trades, trades for an account and
// trades for an offer. Use context.WithCancel to stop streaming or context.Background() if you want
// to stream indefinitely. TradeHandler is a user-supplied function that is executed for each streamed trade received.
func (tr TradeRequest) StreamTrades(ctx context.Context, client *Client,
	handler TradeHandler) (err error) {
	endpoint, err := tr.BuildURL()
	if err != nil {
		return errors.Wrap(err, "unable to build endpoint")
	}

	url := fmt.Sprintf("%s%s", client.fixHorizonURL(), endpoint)

	return client.stream(ctx, url, func(data []byte) error {
		var trade hProtocol.Trade
		err = json.Unmarshal(data, &trade)
		if err != nil {
			return errors.Wrap(err, "error unmarshaling data")
		}
		handler(trade)
		return nil
	})
}
