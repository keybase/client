package horizonclient

import (
	"fmt"
	"testing"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/http/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPathsRequestBuildUrl(t *testing.T) {
	pr := PathsRequest{}
	endpoint, err := pr.BuildURL()

	// It should return no errors and orderbook endpoint
	// Horizon will return an error though because there are no parameters
	require.NoError(t, err)
	assert.Equal(t, "paths", endpoint)

	pr = PathsRequest{
		DestinationAccount:     "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
		DestinationAmount:      "100",
		DestinationAssetCode:   "NGN",
		DestinationAssetIssuer: "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
		DestinationAssetType:   AssetType4,
		SourceAccount:          "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
	}

	endpoint, err = pr.BuildURL()

	// It should return valid assets endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "paths?destination_account=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU&destination_amount=100&destination_asset_code=NGN&destination_asset_issuer=GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM&destination_asset_type=credit_alphanum4&source_account=GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM", endpoint)

}

func ExampleClient_Paths() {

	client := DefaultPublicNetClient
	// Find paths for XLM->NGN
	pr := PathsRequest{
		DestinationAccount:     "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
		DestinationAmount:      "100",
		DestinationAssetCode:   "NGN",
		DestinationAssetIssuer: "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
		DestinationAssetType:   AssetType4,
		SourceAccount:          "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
	}
	paths, err := client.Paths(pr)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(paths)
}

func TestPathsRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	pr := PathsRequest{
		DestinationAccount:     "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
		DestinationAmount:      "100",
		DestinationAssetCode:   "NGN",
		DestinationAssetIssuer: "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
		DestinationAssetType:   AssetType4,
		SourceAccount:          "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
	}

	// orderbook for XLM/USD
	hmock.On(
		"GET",
		"https://localhost/paths?destination_account=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU&destination_amount=100&destination_asset_code=NGN&destination_asset_issuer=GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM&destination_asset_type=credit_alphanum4&source_account=GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
	).ReturnString(200, pathsResponse)

	paths, err := client.Paths(pr)
	if assert.NoError(t, err) {
		assert.IsType(t, paths, hProtocol.PathsPage{})
		record := paths.Embedded.Records[0]
		assert.Equal(t, record.DestinationAmount, "20.0000000")
		assert.Equal(t, record.DestinationAssetCode, "EUR")
		assert.Equal(t, record.SourceAmount, "30.0000000")
	}

	// failure response
	pr = PathsRequest{}
	hmock.On(
		"GET",
		"https://localhost/paths",
	).ReturnString(400, badRequestResponse)

	_, err = client.Paths(pr)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "horizon error")
		horizonError, ok := err.(*Error)
		assert.Equal(t, ok, true)
		assert.Equal(t, horizonError.Problem.Title, "Bad Request")
	}

}

var badRequestResponse = `{
  "type": "https://stellar.org/horizon-errors/bad_request",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request you sent was invalid in some way",
  "extras": {
    "invalid_field": "destination_amount",
    "reason": "Value must be positive"
  }
}`

var pathsResponse = `{
  "_embedded": {
    "records": [
      {
        "destination_amount": "20.0000000",
        "destination_asset_code": "EUR",
        "destination_asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
        "destination_asset_type": "credit_alphanum4",
        "path": [],
        "source_amount": "30.0000000",
        "source_asset_code": "USD",
        "source_asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
        "source_asset_type": "credit_alphanum4"
      },
      {
        "destination_amount": "20.0000000",
        "destination_asset_code": "EUR",
        "destination_asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
        "destination_asset_type": "credit_alphanum4",
        "path": [
          {
            "asset_code": "1",
            "asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
            "asset_type": "credit_alphanum4"
          }
        ],
        "source_amount": "20.0000000",
        "source_asset_code": "USD",
        "source_asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
        "source_asset_type": "credit_alphanum4"
      },
      {
        "destination_amount": "20.0000000",
        "destination_asset_code": "EUR",
        "destination_asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
        "destination_asset_type": "credit_alphanum4",
        "path": [
          {
            "asset_code": "21",
            "asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
            "asset_type": "credit_alphanum4"
          },
          {
            "asset_code": "22",
            "asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
            "asset_type": "credit_alphanum4"
          }
        ],
        "source_amount": "20.0000000",
        "source_asset_code": "USD",
        "source_asset_issuer": "GDSBCQO34HWPGUGQSP3QBFEXVTSR2PW46UIGTHVWGWJGQKH3AFNHXHXN",
        "source_asset_type": "credit_alphanum4"
      }
    ]
  },
  "_links": {
    "self": {
      "href": "/paths"
    }
  }
}`
