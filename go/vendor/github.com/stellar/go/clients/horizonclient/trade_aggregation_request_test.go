package horizonclient

import (
	"fmt"
	"testing"
	"time"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/http/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testTime = time.Unix(int64(1517521726), int64(0))

func TestTradeAggregationRequestBuildUrl(t *testing.T) {
	ta := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         HourResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}
	endpoint, err := ta.BuildURL()

	// It should return valid trade aggregation endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "trade_aggregations?base_asset_type=native&counter_asset_code=SLT&counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP&counter_asset_type=credit_alphanum4&end_time=1517521726000&offset=0&order=desc&resolution=3600000&start_time=1517521726000", endpoint)
}

func ExampleClient_TradeAggregations() {

	client := DefaultPublicNetClient
	// Find trade aggregations
	ta := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         FiveMinuteResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}
	tradeAggs, err := client.TradeAggregations(ta)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(tradeAggs)
}

func TestTradeAggregationsRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	taRequest := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         DayResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}

	hmock.On(
		"GET",
		"https://localhost/trade_aggregations?base_asset_type=native&counter_asset_code=SLT&counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP&counter_asset_type=credit_alphanum4&end_time=1517521726000&offset=0&order=desc&resolution=86400000&start_time=1517521726000",
	).ReturnString(200, tradeAggsResponse)

	tradeAggs, err := client.TradeAggregations(taRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, tradeAggs, hProtocol.TradeAggregationsPage{})
		links := tradeAggs.Links
		assert.Equal(t, links.Self.Href, "https://horizon.stellar.org/trade_aggregations?base_asset_type=native\u0026counter_asset_code=SLT\u0026counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP\u0026counter_asset_type=credit_alphanum4\u0026limit=200\u0026order=asc\u0026resolution=3600000\u0026start_time=1517521726000\u0026end_time=1517532526000")

		assert.Equal(t, links.Next.Href, "https://horizon.stellar.org/trade_aggregations?base_asset_type=native\u0026counter_asset_code=SLT\u0026counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP\u0026counter_asset_type=credit_alphanum4\u0026end_time=1517532526000\u0026limit=200\u0026order=asc\u0026resolution=3600000\u0026start_time=1517529600000")

		record := tradeAggs.Embedded.Records[0]
		assert.IsType(t, record, hProtocol.TradeAggregation{})
		assert.Equal(t, record.Timestamp, int64(1517522400000))
		assert.Equal(t, record.TradeCount, int64(26))
		assert.Equal(t, record.BaseVolume, "27575.0201596")
		assert.Equal(t, record.CounterVolume, "5085.6410385")
	}

	// failure response
	taRequest = TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}

	hmock.On(
		"GET",
		"https://localhost/trade_aggregations?base_asset_type=native&counter_asset_code=SLT&counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP&counter_asset_type=credit_alphanum4&end_time=1517521726000&offset=0&order=desc&resolution=0&start_time=1517521726000",
	).ReturnString(400, badRequestResponse)

	_, err = client.TradeAggregations(taRequest)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "horizon error")
		horizonError, ok := err.(*Error)
		assert.Equal(t, ok, true)
		assert.Equal(t, horizonError.Problem.Title, "Bad Request")
	}
}

func ExampleClient_NextTradeAggregationsPage() {
	client := DefaultPublicNetClient
	// Find trade aggregations
	ta := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         FiveMinuteResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}
	tradeAggs, err := client.TradeAggregations(ta)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(tradeAggs)

	// get next pages.
	recordsFound := false
	if len(tradeAggs.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := tradeAggs
	// get the next page of records if recordsFound is true
	for recordsFound {
		// next page
		nextPage, err := client.NextTradeAggregationsPage(page)
		if err != nil {
			fmt.Println(err)
			return
		}

		page = nextPage
		if len(nextPage.Embedded.Records) == 0 {
			recordsFound = false
		}
		fmt.Println(nextPage)
	}
}

func ExampleClient_PrevTradeAggregationsPage() {
	client := DefaultPublicNetClient
	// Find trade aggregations
	ta := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         FiveMinuteResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}
	tradeAggs, err := client.TradeAggregations(ta)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(tradeAggs)

	// get prev pages.
	recordsFound := false
	if len(tradeAggs.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := tradeAggs
	// get the prev page of records if recordsFound is true
	for recordsFound {
		// prev page
		prevPage, err := client.PrevTradeAggregationsPage(page)
		if err != nil {
			fmt.Println(err)
			return
		}

		page = prevPage
		if len(prevPage.Embedded.Records) == 0 {
			recordsFound = false
		}
		fmt.Println(prevPage)
	}
}

func TestNextTradeAggregationsPage(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	taRequest := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         DayResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}

	hmock.On(
		"GET",
		"https://localhost/trade_aggregations?base_asset_type=native&counter_asset_code=SLT&counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP&counter_asset_type=credit_alphanum4&end_time=1517521726000&offset=0&order=desc&resolution=86400000&start_time=1517521726000",
	).ReturnString(200, firstTradeAggsPage)
	tradeAggs, err := client.TradeAggregations(taRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, len(tradeAggs.Embedded.Records), 2)
	}

	hmock.On(
		"GET",
		"https://horizon-testnet.stellar.org/trade_aggregations?base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&base_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&limit=2&resolution=60000&start_time=0",
	).ReturnString(200, emptyTradeAggsPage)

	nextPage, err := client.NextTradeAggregationsPage(tradeAggs)
	if assert.NoError(t, err) {
		assert.Equal(t, len(nextPage.Embedded.Records), 0)
	}
}

func TestPrevTradeAggregationsPage(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	taRequest := TradeAggregationRequest{
		StartTime:          testTime,
		EndTime:            testTime,
		Resolution:         DayResolution,
		BaseAssetType:      AssetTypeNative,
		CounterAssetType:   AssetType4,
		CounterAssetCode:   "SLT",
		CounterAssetIssuer: "GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP",
		Order:              OrderDesc,
	}

	hmock.On(
		"GET",
		"https://localhost/trade_aggregations?base_asset_type=native&counter_asset_code=SLT&counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP&counter_asset_type=credit_alphanum4&end_time=1517521726000&offset=0&order=desc&resolution=86400000&start_time=1517521726000",
	).ReturnString(200, emptyTradeAggsPage)
	tradeAggs, err := client.TradeAggregations(taRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, len(tradeAggs.Embedded.Records), 0)
	}

	hmock.On(
		"GET",
		"https://horizon-testnet.stellar.org/trade_aggregations?base_asset_type=credit_alphanum4&base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&start_time=1565132904&resolution=60000&limit=2",
	).ReturnString(200, firstTradeAggsPage)

	prevPage, err := client.PrevTradeAggregationsPage(tradeAggs)
	if assert.NoError(t, err) {
		assert.Equal(t, len(prevPage.Embedded.Records), 2)
	}
}

var tradeAggsResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon.stellar.org/trade_aggregations?base_asset_type=native\u0026counter_asset_code=SLT\u0026counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP\u0026counter_asset_type=credit_alphanum4\u0026limit=200\u0026order=asc\u0026resolution=3600000\u0026start_time=1517521726000\u0026end_time=1517532526000"
    },
    "next": {
      "href": "https://horizon.stellar.org/trade_aggregations?base_asset_type=native\u0026counter_asset_code=SLT\u0026counter_asset_issuer=GCKA6K5PCQ6PNF5RQBF7PQDJWRHO6UOGFMRLK3DYHDOI244V47XKQ4GP\u0026counter_asset_type=credit_alphanum4\u0026end_time=1517532526000\u0026limit=200\u0026order=asc\u0026resolution=3600000\u0026start_time=1517529600000"
    }
  },
  "_embedded": {
    "records": [
      {
        "timestamp": 1517522400000,
        "trade_count": 26,
        "base_volume": "27575.0201596",
        "counter_volume": "5085.6410385",
        "avg": "0.1844293",
        "high": "0.1915709",
        "high_r": {
          "N": 50,
          "D": 261
        },
        "low": "0.1506024",
        "low_r": {
          "N": 25,
          "D": 166
        },
        "open": "0.1724138",
        "open_r": {
          "N": 5,
          "D": 29
        },
        "close": "0.1506024",
        "close_r": {
          "N": 25,
          "D": 166
        }
      },
      {
        "timestamp": 1517526000000,
        "trade_count": 15,
        "base_volume": "3913.8224543",
        "counter_volume": "719.4993608",
        "avg": "0.1838355",
        "high": "0.1960784",
        "high_r": {
          "N": 10,
          "D": 51
        },
        "low": "0.1506024",
        "low_r": {
          "N": 25,
          "D": 166
        },
        "open": "0.1869159",
        "open_r": {
          "N": 20,
          "D": 107
        },
        "close": "0.1515152",
        "close_r": {
          "N": 5,
          "D": 33
        }
      }
    ]
  }
}`

var firstTradeAggsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/trade_aggregations?base_asset_type=credit_alphanum4&base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&resolution=60000&limit=2"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/trade_aggregations?base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&base_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&limit=2&resolution=60000&start_time=0"
    },
    "prev": {
      "href": ""
    }
  },
  "_embedded": {
    "records": [
      {
        "timestamp": 1565026860000,
        "trade_count": 3,
        "base_volume": "23781.2128418",
        "counter_volume": "2.0000000",
        "avg": "0.0000841",
        "high": "0.0000841",
        "high_r": {
          "N": 841,
          "D": 10000000
        },
        "low": "0.0000841",
        "low_r": {
          "N": 841,
          "D": 10000000
        },
        "open": "0.0000841",
        "open_r": {
          "N": 841,
          "D": 10000000
        },
        "close": "0.0000841",
        "close_r": {
          "N": 841,
          "D": 10000000
        }
      },
      {
        "timestamp": 1565026920000,
        "trade_count": 1,
        "base_volume": "11890.6052319",
        "counter_volume": "0.9999999",
        "avg": "0.0000841",
        "high": "0.0000841",
        "high_r": {
          "N": 841,
          "D": 10000000
        },
        "low": "0.0000841",
        "low_r": {
          "N": 841,
          "D": 10000000
        },
        "open": "0.0000841",
        "open_r": {
          "N": 841,
          "D": 10000000
        },
        "close": "0.0000841",
        "close_r": {
          "N": 841,
          "D": 10000000
        }
      }
    ]
  }
}`

var emptyTradeAggsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/trade_aggregations?base_asset_type=credit_alphanum4&base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&resolution=60000&limit=2"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/trade_aggregations?base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&base_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&limit=2&resolution=60000&start_time=0"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/trade_aggregations?base_asset_type=credit_alphanum4&base_asset_code=USD&base_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&counter_asset_type=credit_alphanum4&counter_asset_code=BTC&counter_asset_issuer=GDLEUZYDSFMWA5ZLQIOCYS7DMLYDKFS2KWJ5M3RQ3P3WS4L75ZTWKELP&start_time=1565132904&resolution=60000&limit=2"
    }
  },
  "_embedded": {
    "records": []
  }
}`
