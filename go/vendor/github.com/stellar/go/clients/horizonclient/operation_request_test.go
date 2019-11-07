package horizonclient

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stellar/go/protocols/horizon/operations"
	"github.com/stellar/go/support/http/httptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOperationRequestBuildUrl(t *testing.T) {
	op := OperationRequest{endpoint: "operations"}
	endpoint, err := op.BuildURL()

	// It should return valid all operations endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "operations", endpoint)

	op = OperationRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", endpoint: "operations"}
	endpoint, err = op.BuildURL()

	// It should return valid account operations endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/operations", endpoint)

	op = OperationRequest{ForLedger: 123, endpoint: "operations"}
	endpoint, err = op.BuildURL()

	// It should return valid ledger operations endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "ledgers/123/operations", endpoint)

	op = OperationRequest{forOperationID: "123", endpoint: "operations"}
	endpoint, err = op.BuildURL()

	// It should return valid operation operations endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "operations/123", endpoint)

	op = OperationRequest{ForTransaction: "123", endpoint: "payments"}
	endpoint, err = op.BuildURL()

	// It should return valid transaction payments endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "transactions/123/payments", endpoint)

	op = OperationRequest{ForLedger: 123, forOperationID: "789", endpoint: "operations"}
	_, err = op.BuildURL()

	// error case: too many parameters for building any operation endpoint
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "invalid request: too many parameters")
	}

	op = OperationRequest{Cursor: "123456", Limit: 30, Order: OrderAsc, endpoint: "operations", Join: "transactions"}
	endpoint, err = op.BuildURL()
	// It should return valid all operations endpoint with query params and no errors
	require.NoError(t, err)
	assert.Equal(t, "operations?cursor=123456&join=transactions&limit=30&order=asc", endpoint)

	op = OperationRequest{Cursor: "123456", Limit: 30, Order: OrderAsc, endpoint: "payments", Join: "transactions"}
	endpoint, err = op.BuildURL()
	// It should return valid all operations endpoint with query params and no errors
	require.NoError(t, err)
	assert.Equal(t, "payments?cursor=123456&join=transactions&limit=30&order=asc", endpoint)

	op = OperationRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", endpoint: "payments", Join: "transactions"}
	endpoint, err = op.BuildURL()
	// It should return valid all operations endpoint with query params and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/payments?join=transactions", endpoint)

	op = OperationRequest{forOperationID: "1234", endpoint: "payments", Join: "transactions"}
	endpoint, err = op.BuildURL()
	// It should return valid all operations endpoint with query params and no errors
	require.NoError(t, err)
	assert.Equal(t, "operations/1234?join=transactions", endpoint)
}

func ExampleClient_StreamOperations() {
	client := DefaultTestNetClient
	// operations for an account
	opRequest := OperationRequest{ForAccount: "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR", Cursor: "760209215489"}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Stop streaming after 60 seconds.
		time.Sleep(60 * time.Second)
		cancel()
	}()

	printHandler := func(op operations.Operation) {
		fmt.Println(op)
	}
	err := client.StreamOperations(ctx, opRequest, printHandler)
	if err != nil {
		fmt.Println(err)
	}
}

func ExampleClient_StreamPayments() {
	client := DefaultTestNetClient
	// all payments
	opRequest := OperationRequest{Cursor: "760209215489"}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Stop streaming after 60 seconds.
		time.Sleep(60 * time.Second)
		cancel()
	}()

	printHandler := func(op operations.Operation) {
		fmt.Println(op)
	}
	err := client.StreamPayments(ctx, opRequest, printHandler)
	if err != nil {
		fmt.Println(err)
	}
}

func ExampleClient_NextOperationsPage() {
	client := DefaultPublicNetClient
	// all operations
	operationRequest := OperationRequest{Limit: 20}
	ops, err := client.Operations(operationRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)

	// get next pages.
	recordsFound := false
	if len(ops.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := ops
	// get the next page of records if recordsFound is true
	for recordsFound {
		// next page
		nextPage, err := client.NextOperationsPage(page)
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

func ExampleClient_PrevOperationsPage() {
	client := DefaultPublicNetClient
	// all operations
	operationRequest := OperationRequest{Limit: 20}
	ops, err := client.Operations(operationRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)

	// get prev pages.
	recordsFound := false
	if len(ops.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := ops
	// get the prev page of records if recordsFound is true
	for recordsFound {
		// prev page
		prevPage, err := client.PrevOperationsPage(page)
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

func TestNextOperationsPage(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	operationRequest := OperationRequest{Limit: 2}

	hmock.On(
		"GET",
		"https://localhost/operations?limit=2",
	).ReturnString(200, firstOperationsPage)

	ops, err := client.Operations(operationRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, len(ops.Embedded.Records), 2)
	}

	hmock.On(
		"GET",
		"https://horizon-testnet.stellar.org/operations?cursor=661424967682&limit=2&order=asc",
	).ReturnString(200, emptyOperationsPage)

	nextPage, err := client.NextOperationsPage(ops)
	if assert.NoError(t, err) {
		assert.Equal(t, len(nextPage.Embedded.Records), 0)
	}
}

func TestOperationRequestStreamOperations(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// All operations
	operationRequest := OperationRequest{}
	ctx, cancel := context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/operations?cursor=now",
	).ReturnString(200, operationStreamResponse)

	operationStream := make([]operations.Operation, 1)
	err := client.StreamOperations(ctx, operationRequest, func(op operations.Operation) {
		operationStream[0] = op
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, operationStream[0].GetType(), "create_account")
	}

	// Account payments
	operationRequest = OperationRequest{ForAccount: "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/accounts/GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR/payments?cursor=now",
	).ReturnString(200, operationStreamResponse)

	err = client.StreamPayments(ctx, operationRequest, func(op operations.Operation) {
		operationStream[0] = op
		cancel()
	})

	if assert.NoError(t, err) {
		payment, ok := operationStream[0].(operations.CreateAccount)
		assert.Equal(t, ok, true)
		assert.Equal(t, payment.Funder, "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR")
	}

	// test connection error
	operationRequest = OperationRequest{}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/operations?cursor=now",
	).ReturnString(500, operationStreamResponse)

	err = client.StreamOperations(ctx, operationRequest, func(op operations.Operation) {
		operationStream[0] = op
		cancel()
	})

	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "got bad HTTP status code 500")
	}
}

var operationStreamResponse = `data: {"_links":{"self":{"href":"https://horizon-testnet.stellar.org/operations/4934917427201"},"transaction":{"href":"https://horizon-testnet.stellar.org/transactions/1c1449106a54cccd8a2ec2094815ad9db30ae54c69c3309dd08d13fdb8c749de"},"effects":{"href":"https://horizon-testnet.stellar.org/operations/4934917427201/effects"},"succeeds":{"href":"https://horizon-testnet.stellar.org/effects?order=desc\u0026cursor=4934917427201"},"precedes":{"href":"https://horizon-testnet.stellar.org/effects?order=asc\u0026cursor=4934917427201"}},"id":"4934917427201","paging_token":"4934917427201","transaction_successful":true,"source_account":"GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR","type":"create_account","type_i":0,"created_at":"2019-02-27T11:32:39Z","transaction_hash":"1c1449106a54cccd8a2ec2094815ad9db30ae54c69c3309dd08d13fdb8c749de","starting_balance":"10000.0000000","funder":"GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR","account":"GDBLBBDIUULY3HGIKXNK6WVBISY7DCNCDA45EL7NTXWX5R4UZ26HGMGS"}
`

var firstOperationsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/operations?cursor=&limit=2&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/operations?cursor=661424967682&limit=2&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/operations?cursor=661424967681&limit=2&order=desc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/operations/661424967681"
          },
          "transaction": {
            "href": "https://horizon-testnet.stellar.org/transactions/749e4f8933221b9942ef38a02856803f379789ec8d971f1f60535db70135673e"
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/operations/661424967681/effects"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=661424967681"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=661424967681"
          }
        },
        "id": "661424967681",
        "paging_token": "661424967681",
        "transaction_successful": true,
        "source_account": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
        "type": "create_account",
        "type_i": 0,
        "created_at": "2019-04-24T09:16:14Z",
        "transaction_hash": "749e4f8933221b9942ef38a02856803f379789ec8d971f1f60535db70135673e",
        "starting_balance": "10000000000.0000000",
        "funder": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
        "account": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"
      },
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/operations/661424967682"
          },
          "transaction": {
            "href": "https://horizon-testnet.stellar.org/transactions/749e4f8933221b9942ef38a02856803f379789ec8d971f1f60535db70135673e"
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/operations/661424967682/effects"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=661424967682"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=661424967682"
          }
        },
        "id": "661424967682",
        "paging_token": "661424967682",
        "transaction_successful": true,
        "source_account": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
        "type": "create_account",
        "type_i": 0,
        "created_at": "2019-04-24T09:16:14Z",
        "transaction_hash": "749e4f8933221b9942ef38a02856803f379789ec8d971f1f60535db70135673e",
        "starting_balance": "10000.0000000",
        "funder": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
        "account": "GDO34SQXVOSNODK7JCTAXLZUPSAF3JIH4ADQELVIKOQJUWQ3U4BMSCSH"
      }
    ]
  }
}`

var emptyOperationsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/operations?cursor=661424967682&limit=2&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/operations?cursor=661424967684&limit=2&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/operations?cursor=661424967683&limit=2&order=desc"
    }
  },
  "_embedded": {
    "records": []
  }
}`
