package horizonclient

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stellar/go/protocols/horizon/effects"
	"github.com/stellar/go/support/http/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEffectRequestBuildUrl(t *testing.T) {
	er := EffectRequest{}
	endpoint, err := er.BuildURL()

	// It should return valid all effects endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "effects", endpoint)

	er = EffectRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	endpoint, err = er.BuildURL()

	// It should return valid account effects endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/effects", endpoint)

	er = EffectRequest{ForLedger: "123"}
	endpoint, err = er.BuildURL()

	// It should return valid ledger effects endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "ledgers/123/effects", endpoint)

	er = EffectRequest{ForOperation: "123"}
	endpoint, err = er.BuildURL()

	// It should return valid operation effects endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "operations/123/effects", endpoint)

	er = EffectRequest{ForTransaction: "123"}
	endpoint, err = er.BuildURL()

	// It should return valid transaction effects endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "transactions/123/effects", endpoint)

	er = EffectRequest{ForLedger: "123", ForOperation: "789"}
	_, err = er.BuildURL()

	// error case: too many parameters for building any effect endpoint
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "invalid request: too many parameters")
	}

	er = EffectRequest{Cursor: "123456", Limit: 30, Order: OrderAsc}
	endpoint, err = er.BuildURL()
	// It should return valid all effects endpoint with query params and no errors
	require.NoError(t, err)
	assert.Equal(t, "effects?cursor=123456&limit=30&order=asc", endpoint)

}

func ExampleClient_NextEffectsPage() {
	client := DefaultPublicNetClient
	// all effects
	effectRequest := EffectRequest{Limit: 20}
	efp, err := client.Effects(effectRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(efp)

	// get next pages.
	recordsFound := false
	if len(efp.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := efp
	// get the next page of records if recordsFound is true
	for recordsFound {
		// next page
		nextPage, err := client.NextEffectsPage(page)
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

func ExampleClient_PrevEffectsPage() {
	client := DefaultPublicNetClient
	// all effects
	effectRequest := EffectRequest{Limit: 20}
	efp, err := client.Effects(effectRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(efp)

	// get prev pages.
	recordsFound := false
	if len(efp.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := efp
	// get the prev page of records if recordsFound is true
	for recordsFound {
		// prev page
		prevPage, err := client.PrevEffectsPage(page)
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
func ExampleClient_StreamEffects() {
	client := DefaultTestNetClient
	// all effects
	effectRequest := EffectRequest{Cursor: "760209215489"}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Stop streaming after 60 seconds.
		time.Sleep(60 * time.Second)
		cancel()
	}()

	printHandler := func(e effects.Effect) {
		fmt.Println(e)
	}
	err := client.StreamEffects(ctx, effectRequest, printHandler)
	if err != nil {
		fmt.Println(err)
	}
}
func TestEffectRequestStreamEffects(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// All effects
	effectRequest := EffectRequest{}
	ctx, cancel := context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/effects?cursor=now",
	).ReturnString(200, effectStreamResponse)

	effectStream := make([]effects.Effect, 1)
	err := client.StreamEffects(ctx, effectRequest, func(effect effects.Effect) {
		effectStream[0] = effect
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, effectStream[0].GetType(), "account_credited")
	}

	// Account effects
	effectRequest = EffectRequest{ForAccount: "GBNZN27NAOHRJRCMHQF2ZN2F6TAPVEWKJIGZIRNKIADWIS2HDENIS6CI"}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/accounts/GBNZN27NAOHRJRCMHQF2ZN2F6TAPVEWKJIGZIRNKIADWIS2HDENIS6CI/effects?cursor=now",
	).ReturnString(200, effectStreamResponse)

	err = client.StreamEffects(ctx, effectRequest, func(effect effects.Effect) {
		effectStream[0] = effect
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, effectStream[0].GetAccount(), "GBNZN27NAOHRJRCMHQF2ZN2F6TAPVEWKJIGZIRNKIADWIS2HDENIS6CI")
	}

	// test error
	effectRequest = EffectRequest{}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/effects?cursor=now",
	).ReturnString(500, effectStreamResponse)

	err = client.StreamEffects(ctx, effectRequest, func(effect effects.Effect) {
		effectStream[0] = effect
		cancel()
	})

	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "got bad HTTP status code 500")
	}
}

func TestNextEffectsPage(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// Account effects
	effectRequest := EffectRequest{ForAccount: "GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD"}

	hmock.On(
		"GET",
		"https://localhost/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects",
	).ReturnString(200, firstEffectsPage)

	efp, err := client.Effects(effectRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, len(efp.Embedded.Records), 2)
	}

	hmock.On(
		"GET",
		"https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=1557363731492865-3&limit=10&order=asc",
	).ReturnString(200, emptyEffectsPage)

	nextPage, err := client.NextEffectsPage(efp)
	if assert.NoError(t, err) {
		assert.Equal(t, len(nextPage.Embedded.Records), 0)
	}
}

var effectStreamResponse = `data: {"_links":{"operation":{"href":"https://horizon-testnet.stellar.org/operations/2531135896703017"},"succeeds":{"href":"https://horizon-testnet.stellar.org/effects?order=desc\u0026cursor=2531135896703017-1"},"precedes":{"href":"https://horizon-testnet.stellar.org/effects?order=asc\u0026cursor=2531135896703017-1"}},"id":"0002531135896703017-0000000001","paging_token":"2531135896703017-1","account":"GBNZN27NAOHRJRCMHQF2ZN2F6TAPVEWKJIGZIRNKIADWIS2HDENIS6CI","type":"account_credited","type_i":2,"created_at":"2019-04-03T10:14:17Z","asset_type":"credit_alphanum4","asset_code":"qwop","asset_issuer":"GBM4HXXNDBWWQBXOL4QCTZIUQAP6XFUI3FPINUGUPBMULMTEHJPIKX6T","amount":"0.0460000"}
`

var firstEffectsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=&limit=10&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=1557363731492865-3&limit=10&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=1557363731492865-1&limit=10&order=desc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "operation": {
            "href": "https://horizon-testnet.stellar.org/operations/1557363731492865"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=1557363731492865-1"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=1557363731492865-1"
          }
        },
        "id": "0001557363731492865-0000000001",
        "paging_token": "1557363731492865-1",
        "account": "GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD",
        "type": "account_created",
        "type_i": 0,
        "created_at": "2019-05-16T07:13:25Z",
        "starting_balance": "10000.0000000"
      },
      {
        "_links": {
          "operation": {
            "href": "https://horizon-testnet.stellar.org/operations/1557363731492865"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=1557363731492865-3"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=1557363731492865-3"
          }
        },
        "id": "0001557363731492865-0000000003",
        "paging_token": "1557363731492865-3",
        "account": "GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD",
        "type": "signer_created",
        "type_i": 10,
        "created_at": "2019-05-16T07:13:25Z",
        "weight": 1,
        "public_key": "GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD",
        "key": ""
      }
    ]
  }
}`

var emptyEffectsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=1557363731492865-3&limit=10&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=1557363731492865-3&limit=10&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCDIZFWLOTBWHTPODXCBH6XNXPFMSQFRVIDRP3JLEKQZN66G7NF3ANOD/effects?cursor=1557363731492865-3&limit=10&order=desc"
    }
  },
  "_embedded": {
    "records": []
  }
}`
