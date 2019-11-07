package horizonclient

import (
	"context"
	"fmt"
	"testing"
	"time"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/http/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOrderBookRequestBuildUrl(t *testing.T) {
	obr := OrderBookRequest{}
	endpoint, err := obr.BuildURL()

	// It should return no errors and orderbook endpoint
	// Horizon will return an error though because there are no parameters
	require.NoError(t, err)
	assert.Equal(t, "order_book", endpoint)

	obr = OrderBookRequest{SellingAssetType: AssetTypeNative, BuyingAssetType: AssetTypeNative}
	endpoint, err = obr.BuildURL()

	// It should return valid assets endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "order_book?buying_asset_type=native&selling_asset_type=native", endpoint)

	obr = OrderBookRequest{SellingAssetType: AssetTypeNative, BuyingAssetType: AssetType4, BuyingAssetCode: "ABC", BuyingAssetIssuer: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	endpoint, err = obr.BuildURL()

	// It should return valid assets endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "order_book?buying_asset_code=ABC&buying_asset_issuer=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU&buying_asset_type=credit_alphanum4&selling_asset_type=native", endpoint)
}

func ExampleClient_StreamOrderBooks() {
	client := DefaultTestNetClient
	orderbookRequest := OrderBookRequest{SellingAssetType: AssetTypeNative, BuyingAssetType: AssetType4, BuyingAssetCode: "ABC", BuyingAssetIssuer: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Stop streaming after 60 seconds.
		time.Sleep(60 * time.Second)
		cancel()
	}()

	printHandler := func(orderbook hProtocol.OrderBookSummary) {
		fmt.Println(orderbook)
	}
	err := client.StreamOrderBooks(ctx, orderbookRequest, printHandler)
	if err != nil {
		fmt.Println(err)
	}
}

func TestOrderBookRequestStreamOrderBooks(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}
	orderbookRequest := OrderBookRequest{SellingAssetType: AssetTypeNative, BuyingAssetType: AssetType4, BuyingAssetCode: "ABC", BuyingAssetIssuer: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	ctx, cancel := context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/order_book?buying_asset_code=ABC&buying_asset_issuer=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU&buying_asset_type=credit_alphanum4&cursor=now&selling_asset_type=native",
	).ReturnString(200, orderbookStreamResponse)

	orderbooks := make([]hProtocol.OrderBookSummary, 1)
	err := client.StreamOrderBooks(ctx, orderbookRequest, func(orderbook hProtocol.OrderBookSummary) {
		orderbooks[0] = orderbook
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, orderbooks[0].Selling.Type, "native")
		assert.Equal(t, orderbooks[0].Buying.Type, "credit_alphanum4")
		assert.Equal(t, orderbooks[0].Buying.Code, "ABC")
		assert.Equal(t, orderbooks[0].Buying.Issuer, "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU")
	}

	// test error
	orderbookRequest = OrderBookRequest{}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/order_book?cursor=now",
	).ReturnString(500, orderbookStreamResponse)

	err = client.StreamOrderBooks(ctx, orderbookRequest, func(orderbook hProtocol.OrderBookSummary) {
		cancel()
	})

	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "got bad HTTP status code 500")
	}
}

var orderbookStreamResponse = `data: {"bids":[{"price_r":{"n":10000000,"d":416041},"price":"24.0360926","amount":"64.5477778"},{"price_r":{"n":1250000,"d":52009},"price":"24.0343018","amount":"69.0955580"},{"price_r":{"n":10000000,"d":416173},"price":"24.0284689","amount":"48.0957175"},{"price_r":{"n":10000000,"d":416293},"price":"24.0215425","amount":"85.2955923"},{"price_r":{"n":2000000,"d":83261},"price":"24.0208501","amount":"95.0060029"},{"price_r":{"n":10000000,"d":416359},"price":"24.0177347","amount":"21.0996208"},{"price_r":{"n":2000000,"d":83317},"price":"24.0047049","amount":"58.5071234"},{"price_r":{"n":5000000,"d":208313},"price":"24.0023426","amount":"2.6124606"},{"price_r":{"n":10000000,"d":416703},"price":"23.9979074","amount":"75.2954767"},{"price_r":{"n":10000000,"d":416799},"price":"23.9923800","amount":"90.8729460"},{"price_r":{"n":1250000,"d":52113},"price":"23.9863374","amount":"98.1852777"},{"price_r":{"n":10000000,"d":417043},"price":"23.9783428","amount":"87.1819093"},{"price_r":{"n":1250000,"d":52237},"price":"23.9293987","amount":"46.2976363"},{"price_r":{"n":10000000,"d":418173},"price":"23.9135477","amount":"30.5438228"},{"price_r":{"n":5000000,"d":209337},"price":"23.8849320","amount":"92.2168107"},{"price_r":{"n":1600,"d":67},"price":"23.8805970","amount":"34.1880836"},{"price_r":{"n":25000,"d":1047},"price":"23.8777459","amount":"1.5260053"},{"price_r":{"n":2500000,"d":104701},"price":"23.8775179","amount":"28.8883583"},{"price_r":{"n":10000000,"d":418889},"price":"23.8726727","amount":"32.5403317"},{"price_r":{"n":5000000,"d":209463},"price":"23.8705643","amount":"68.7506816"}],"asks":[{"price_r":{"n":60099621,"d":2500000},"price":"24.0398484","amount":"114240.9695894"},{"price_r":{"n":2000,"d":83},"price":"24.0963855","amount":"10.6240000"},{"price_r":{"n":243902439,"d":10000000},"price":"24.3902439","amount":"5098.5158704"},{"price_r":{"n":247581003,"d":10000000},"price":"24.7581003","amount":"48.7365083"},{"price_r":{"n":247622939,"d":10000000},"price":"24.7622939","amount":"85.4807258"},{"price_r":{"n":30954891,"d":1250000},"price":"24.7639128","amount":"73.3863524"},{"price_r":{"n":248116049,"d":10000000},"price":"24.8116049","amount":"10.8025861"},{"price_r":{"n":124071407,"d":5000000},"price":"24.8142814","amount":"40.5349552"},{"price_r":{"n":124089177,"d":5000000},"price":"24.8178354","amount":"98.5958629"},{"price_r":{"n":248207821,"d":10000000},"price":"24.8207821","amount":"35.9280393"},{"price_r":{"n":62052967,"d":2500000},"price":"24.8211868","amount":"27.1415841"},{"price_r":{"n":248326957,"d":10000000},"price":"24.8326957","amount":"64.7660814"},{"price_r":{"n":248453671,"d":10000000},"price":"24.8453671","amount":"52.3970380"},{"price_r":{"n":248913989,"d":10000000},"price":"24.8913989","amount":"98.5221362"},{"price_r":{"n":31129641,"d":1250000},"price":"24.9037128","amount":"40.6966868"},{"price_r":{"n":249076933,"d":10000000},"price":"24.9076933","amount":"86.4499134"},{"price_r":{"n":249136251,"d":10000000},"price":"24.9136251","amount":"53.6600249"},{"price_r":{"n":249189189,"d":10000000},"price":"24.9189189","amount":"76.1849984"},{"price_r":{"n":249391503,"d":10000000},"price":"24.9391503","amount":"35.8199766"},{"price_r":{"n":15590707,"d":625000},"price":"24.9451312","amount":"51.2253042"}],"base":{"asset_type":"native"},"counter":{"asset_type":"credit_alphanum4","asset_code":"ABC","asset_issuer":"GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}}
`
