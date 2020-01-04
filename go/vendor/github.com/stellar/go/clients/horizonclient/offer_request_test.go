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

func TestOfferRequestBuildUrl(t *testing.T) {

	er := OfferRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	endpoint, err := er.BuildURL()

	// It should return valid offers endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/offers", endpoint)

	er = OfferRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", Cursor: "now", Order: OrderDesc}
	endpoint, err = er.BuildURL()

	// It should return valid offers endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/offers?cursor=now&order=desc", endpoint)
}

func ExampleClient_StreamOffers() {
	client := DefaultTestNetClient
	// offers for account
	offerRequest := OfferRequest{ForAccount: "GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C", Cursor: "1"}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Stop streaming after 60 seconds.
		time.Sleep(60 * time.Second)
		cancel()
	}()

	printHandler := func(offer hProtocol.Offer) {
		fmt.Println(offer)
	}
	err := client.StreamOffers(ctx, offerRequest, printHandler)
	if err != nil {
		fmt.Println(err)
	}
}

func ExampleClient_NextOffersPage() {
	client := DefaultPublicNetClient
	// all offers
	offerRequest := OfferRequest{ForAccount: "GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C", Limit: 20}
	offers, err := client.Offers(offerRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(offers)

	// get next pages.
	recordsFound := false
	if len(offers.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := offers
	// get the next page of records if recordsFound is true
	for recordsFound {
		// next page
		nextPage, err := client.NextOffersPage(page)
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

func ExampleClient_PrevOffersPage() {
	client := DefaultPublicNetClient
	// all offers
	offerRequest := OfferRequest{ForAccount: "GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C", Limit: 20}
	offers, err := client.Offers(offerRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(offers)

	// get prev pages.
	recordsFound := false
	if len(offers.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := offers
	// get the prev page of records if recordsFound is true
	for recordsFound {
		// prev page
		prevPage, err := client.PrevOffersPage(page)
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

func TestNextOffersPage(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	offerRequest := OfferRequest{ForAccount: "GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG", Limit: 2}

	hmock.On(
		"GET",
		"https://localhost/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?limit=2",
	).ReturnString(200, firstOffersPage)

	offers, err := client.Offers(offerRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, len(offers.Embedded.Records), 2)
	}

	hmock.On(
		"GET",
		"https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=2946581&limit=2&order=asc",
	).ReturnString(200, emptyOffersPage)

	nextPage, err := client.NextOffersPage(offers)
	if assert.NoError(t, err) {
		assert.Equal(t, len(nextPage.Embedded.Records), 0)
	}
}

func TestOfferRequestStreamOffers(t *testing.T) {

	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// offers for account
	orRequest := OfferRequest{ForAccount: "GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C"}
	ctx, cancel := context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/accounts/GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C/offers?cursor=now",
	).ReturnString(200, offerStreamResponse)

	offers := make([]hProtocol.Offer, 1)
	err := client.StreamOffers(ctx, orRequest, func(offer hProtocol.Offer) {
		offers[0] = offer
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, offers[0].Amount, "20.4266087")
		assert.Equal(t, offers[0].Seller, "GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C")
	}

	// test error
	orRequest = OfferRequest{ForAccount: "GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C"}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/accounts/GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C/offers?cursor=now",
	).ReturnString(500, offerStreamResponse)

	offers = make([]hProtocol.Offer, 1)
	err = client.StreamOffers(ctx, orRequest, func(offer hProtocol.Offer) {
		cancel()
	})

	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "got bad HTTP status code 500")
	}
}

var offerStreamResponse = `data: {"_links":{"self":{"href":"https://horizon-testnet.stellar.org/offers/5269100"},"offer_maker":{"href":"https://horizon-testnet.stellar.org/accounts/GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C"}},"id":5269100,"paging_token":"5269100","seller":"GAQHWQYBBW272OOXNQMMLCA5WY2XAZPODGB7Q3S5OKKIXVESKO55ZQ7C","selling":{"asset_type":"credit_alphanum4","asset_code":"DSQ","asset_issuer":"GBDQPTQJDATT7Z7EO4COS4IMYXH44RDLLI6N6WIL5BZABGMUOVMLWMQF"},"buying":{"asset_type":"credit_alphanum4","asset_code":"XCS6","asset_issuer":"GBH2V47NOZRC56QAYCPV5JUBG5NVFJQF5AQTUNFNWNDHSWWTKH2MWR2L"},"amount":"20.4266087","price_r":{"n":24819,"d":10000000},"price":"0.0024819","last_modified_ledger":674449,"last_modified_time":"2019-04-08T11:56:41Z"}
`

var firstOffersPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=&limit=2&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=2946581&limit=2&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=2946580&limit=2&order=desc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/offers/2946580"
          },
          "offer_maker": {
            "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG"
          }
        },
        "id": 2946580,
        "paging_token": "2946580",
        "seller": "GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG",
        "selling": {
          "asset_type": "credit_alphanum4",
          "asset_code": "HT",
          "asset_issuer": "GCNSGHUCG5VMGLT5RIYYZSO7VQULQKAJ62QA33DBC5PPBSO57LFWVV6P"
        },
        "buying": {
          "asset_type": "credit_alphanum4",
          "asset_code": "BTC",
          "asset_issuer": "GCNSGHUCG5VMGLT5RIYYZSO7VQULQKAJ62QA33DBC5PPBSO57LFWVV6P"
        },
        "amount": "33.7252478",
        "price_r": {
          "n": 15477,
          "d": 43975000
        },
        "price": "0.0003519",
        "last_modified_ledger": 363492,
        "last_modified_time": "2019-05-16T08:35:22Z"
      },
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/offers/2946581"
          },
          "offer_maker": {
            "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG"
          }
        },
        "id": 2946581,
        "paging_token": "2946581",
        "seller": "GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG",
        "selling": {
          "asset_type": "credit_alphanum4",
          "asset_code": "HT",
          "asset_issuer": "GCNSGHUCG5VMGLT5RIYYZSO7VQULQKAJ62QA33DBC5PPBSO57LFWVV6P"
        },
        "buying": {
          "asset_type": "credit_alphanum4",
          "asset_code": "BTC",
          "asset_issuer": "GCNSGHUCG5VMGLT5RIYYZSO7VQULQKAJ62QA33DBC5PPBSO57LFWVV6P"
        },
        "amount": "20.0242956",
        "price_r": {
          "n": 3157,
          "d": 8795000
        },
        "price": "0.0003590",
        "last_modified_ledger": 363492,
        "last_modified_time": "2019-05-16T08:35:22Z"
      }
    ]
  }
}`

var emptyOffersPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=2946581&limit=2&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=2946583&limit=2&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/accounts/GBZ5OD56VRTRQKMNADD6VUZUG3FCILMAMYQY5ZSC3AW3GBXNEPIK76IG/offers?cursor=2946582&limit=2&order=desc"
    }
  },
  "_embedded": {
    "records": []
  }
}`
