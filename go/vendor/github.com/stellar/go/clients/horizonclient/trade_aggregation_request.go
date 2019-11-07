package horizonclient

import (
	"fmt"
	"net/url"
	"strconv"

	"github.com/stellar/go/support/errors"
)

// BuildURL creates the endpoint to be queried based on the data in the TradeAggregationRequest struct.
func (ta TradeAggregationRequest) BuildURL() (endpoint string, err error) {
	endpoint = "trade_aggregations"
	// add the parameters for trade aggregations endpoint
	paramMap := make(map[string]string)
	paramMap["start_time"] = strconv.FormatInt((ta.StartTime.UnixNano() / 1e6), 10)
	paramMap["end_time"] = strconv.FormatInt((ta.EndTime.UnixNano() / 1e6), 10)
	paramMap["resolution"] = strconv.FormatInt((ta.Resolution.Nanoseconds() / 1e6), 10)
	paramMap["offset"] = strconv.FormatInt((ta.Offset.Nanoseconds() / 1e6), 10)
	paramMap["base_asset_type"] = string(ta.BaseAssetType)
	paramMap["base_asset_code"] = ta.BaseAssetCode
	paramMap["base_asset_issuer"] = ta.BaseAssetIssuer
	paramMap["counter_asset_type"] = string(ta.CounterAssetType)
	paramMap["counter_asset_code"] = ta.CounterAssetCode
	paramMap["counter_asset_issuer"] = ta.CounterAssetIssuer

	queryParams := addQueryParams(paramMap, limit(ta.Limit), ta.Order)
	if queryParams != "" {
		endpoint = fmt.Sprintf("%s?%s", endpoint, queryParams)
	}

	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
	}

	return endpoint, err
}
