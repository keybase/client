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

func TestTransactionRequestBuildUrl(t *testing.T) {
	tr := TransactionRequest{}
	endpoint, err := tr.BuildURL()

	// It should return valid all transactions endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "transactions", endpoint)

	tr = TransactionRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	endpoint, err = tr.BuildURL()

	// It should return valid account transactions endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/transactions", endpoint)

	tr = TransactionRequest{ForLedger: 123}
	endpoint, err = tr.BuildURL()

	// It should return valid ledger transactions endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "ledgers/123/transactions", endpoint)

	tr = TransactionRequest{forTransactionHash: "123"}
	endpoint, err = tr.BuildURL()

	// It should return valid operation transactions endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "transactions/123", endpoint)

	tr = TransactionRequest{ForLedger: 123, forTransactionHash: "789"}
	_, err = tr.BuildURL()

	// error case: too many parameters for building any operation endpoint
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "invalid request: too many parameters")
	}

	tr = TransactionRequest{Cursor: "123456", Limit: 30, Order: OrderAsc, IncludeFailed: true}
	endpoint, err = tr.BuildURL()
	// It should return valid all transactions endpoint with query params and no errors
	require.NoError(t, err)
	assert.Equal(t, "transactions?cursor=123456&include_failed=true&limit=30&order=asc", endpoint)

}

func ExampleClient_StreamTransactions() {
	client := DefaultTestNetClient
	// all transactions
	transactionRequest := TransactionRequest{Cursor: "760209215489"}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// Stop streaming after 60 seconds.
		time.Sleep(60 * time.Second)
		cancel()
	}()

	printHandler := func(tr hProtocol.Transaction) {
		fmt.Println(tr)
	}
	err := client.StreamTransactions(ctx, transactionRequest, printHandler)
	if err != nil {
		fmt.Println(err)
	}
}

func ExampleClient_NextTransactionsPage() {
	client := DefaultPublicNetClient
	// all transactions
	transactionRequest := TransactionRequest{Limit: 20}
	transactions, err := client.Transactions(transactionRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(transactions)

	// get next pages.
	recordsFound := false
	if len(transactions.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := transactions
	// get the next page of records if recordsFound is true
	for recordsFound {
		// next page
		nextPage, err := client.NextTransactionsPage(page)
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

func ExampleClient_PrevTransactionsPage() {
	client := DefaultPublicNetClient
	// all transactions
	transactionRequest := TransactionRequest{Limit: 20}
	transactions, err := client.Transactions(transactionRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(transactions)

	// get prev pages.
	recordsFound := false
	if len(transactions.Embedded.Records) > 0 {
		recordsFound = true
	}
	page := transactions
	// get the prev page of records if recordsFound is true
	for recordsFound {
		// prev page
		prevPage, err := client.PrevTransactionsPage(page)
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

func TestNextTransactionsPage(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	transactionRequest := TransactionRequest{Limit: 2}

	hmock.On(
		"GET",
		"https://localhost/transactions?limit=2",
	).ReturnString(200, firstTransactionsPage)

	transactions, err := client.Transactions(transactionRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, len(transactions.Embedded.Records), 2)
	}

	hmock.On(
		"GET",
		"https://horizon-testnet.stellar.org/transactions?cursor=1566052450312192&limit=2&order=desc",
	).ReturnString(200, emptyTransactionsPage)

	nextPage, err := client.NextTransactionsPage(transactions)
	if assert.NoError(t, err) {
		assert.Equal(t, len(nextPage.Embedded.Records), 0)
	}
}

func TestTransactionRequestStreamTransactions(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// all transactions
	trRequest := TransactionRequest{}
	ctx, cancel := context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/transactions?cursor=now",
	).ReturnString(200, txStreamResponse)

	transactions := make([]hProtocol.Transaction, 1)
	err := client.StreamTransactions(ctx, trRequest, func(tr hProtocol.Transaction) {
		transactions[0] = tr
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, transactions[0].Hash, "1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e")
		assert.Equal(t, transactions[0].Account, "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR")
	}

	// transactions for accounts
	trRequest = TransactionRequest{ForAccount: "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/accounts/GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR/transactions?cursor=now",
	).ReturnString(200, txStreamResponse)

	transactions = make([]hProtocol.Transaction, 1)
	err = client.StreamTransactions(ctx, trRequest, func(tr hProtocol.Transaction) {
		transactions[0] = tr
		cancel()
	})

	if assert.NoError(t, err) {
		assert.Equal(t, transactions[0].Hash, "1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e")
		assert.Equal(t, transactions[0].Account, "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR")
	}

	// test error
	trRequest = TransactionRequest{}
	ctx, cancel = context.WithCancel(context.Background())

	hmock.On(
		"GET",
		"https://localhost/transactions?cursor=now",
	).ReturnString(500, txStreamResponse)

	transactions = make([]hProtocol.Transaction, 1)
	err = client.StreamTransactions(ctx, trRequest, func(tr hProtocol.Transaction) {
		cancel()
	})

	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "got bad HTTP status code 500")
	}
}

var txStreamResponse = `data: {"_links":{"self":{"href":"https://horizon-testnet.stellar.org/transactions/1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e"},"account":{"href":"https://horizon-testnet.stellar.org/accounts/GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"},"ledger":{"href":"https://horizon-testnet.stellar.org/ledgers/607387"},"operations":{"href":"https://horizon-testnet.stellar.org/transactions/1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e/operations{?cursor,limit,order}","templated":true},"effects":{"href":"https://horizon-testnet.stellar.org/transactions/1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e/effects{?cursor,limit,order}","templated":true},"precedes":{"href":"https://horizon-testnet.stellar.org/transactions?order=asc\u0026cursor=2608707301036032"},"succeeds":{"href":"https://horizon-testnet.stellar.org/transactions?order=desc\u0026cursor=2608707301036032"}},"id":"1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e","paging_token":"2608707301036032","successful":true,"hash":"1534f6507420c6871b557cc2fc800c29fb1ed1e012e694993ffe7a39c824056e","ledger":607387,"created_at":"2019-04-04T12:07:03Z","source_account":"GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR","source_account_sequence":"4660039930473","fee_paid":100,"operation_count":1,"envelope_xdr":"AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0ABlJpAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAmLuzasXDMqsqgFK4xkbLxJLzmQQzkiCF2SnKPD+b1TsAAAAXSHboAAAAAAAAAAABhlbgnAAAAECqxhXduvtzs65keKuTzMtk76cts2WeVB2pZKYdlxlOb1EIbOpFhYizDSXVfQlAvvg18qV6oNRr7ls4nnEm2YIK","result_xdr":"AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA=","result_meta_xdr":"AAAAAQAAAAIAAAADAAlEmwAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwBT3aiixBA2AAABD0ABlJoAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAlEmwAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwBT3aiixBA2AAABD0ABlJpAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAMACUSbAAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAFPdqKLEEDYAAAEPQAGUmkAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEACUSbAAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAFPdotCmVjYAAAEPQAGUmkAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAACUSbAAAAAAAAAACYu7NqxcMyqyqAUrjGRsvEkvOZBDOSIIXZKco8P5vVOwAAABdIdugAAAlEmwAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==","fee_meta_xdr":"AAAAAgAAAAMACUSaAAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAFPdqKLEEE8AAAEPQAGUmgAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEACUSbAAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAFPdqKLEEDYAAAEPQAGUmgAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==","memo_type":"none","signatures":["qsYV3br7c7OuZHirk8zLZO+nLbNlnlQdqWSmHZcZTm9RCGzqRYWIsw0l1X0JQL74NfKleqDUa+5bOJ5xJtmCCg=="]}
`

var firstTransactionsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=&limit=2&order=desc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1566052450312192&limit=2&order=desc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1566052450316288&limit=2&order=asc"
    }
  },
  "_embedded": {
    "records": [
      {
        "memo": "3232096465",
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/transactions/a748158973896c2b0a4fc32a2ae1c96954e4a52e3385f942832a1852fce6d775"
          },
          "account": {
            "href": "https://horizon-testnet.stellar.org/accounts/GDRZVYB5QI6UFR4NR4RXQ3HR5IH4KL2ECR4IUZXGHOUMPGLN2OGCSAOK"
          },
          "ledger": {
            "href": "https://horizon-testnet.stellar.org/ledgers/364625"
          },
          "operations": {
            "href": "https://horizon-testnet.stellar.org/transactions/a748158973896c2b0a4fc32a2ae1c96954e4a52e3385f942832a1852fce6d775/operations{?cursor,limit,order}",
            "templated": true
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/transactions/a748158973896c2b0a4fc32a2ae1c96954e4a52e3385f942832a1852fce6d775/effects{?cursor,limit,order}",
            "templated": true
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=asc&cursor=1566052450316288"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=desc&cursor=1566052450316288"
          }
        },
        "id": "a748158973896c2b0a4fc32a2ae1c96954e4a52e3385f942832a1852fce6d775",
        "paging_token": "1566052450316288",
        "successful": true,
        "hash": "a748158973896c2b0a4fc32a2ae1c96954e4a52e3385f942832a1852fce6d775",
        "ledger": 364625,
        "created_at": "2019-05-16T10:17:44Z",
        "source_account": "GDRZVYB5QI6UFR4NR4RXQ3HR5IH4KL2ECR4IUZXGHOUMPGLN2OGCSAOK",
        "source_account_sequence": "1566048155336705",
        "fee_paid": 100,
        "operation_count": 1,
        "envelope_xdr": "AAAAAOOa4D2CPULHjY8jeGzx6g/FL0QUeIpm5juox5lt04wpAAAAZAAFkFAAAAABAAAAAAAAAAEAAAAKMzIzMjA5NjQ2NQAAAAAAAQAAAAEAAAAA45rgPYI9QseNjyN4bPHqD8UvRBR4imbmO6jHmW3TjCkAAAABAAAAAE3j7m7lhZ39noA3ToXWDjJ9QuMmmp/1UaIg0chYzRSlAAAAAAAAAAJMTD+AAAAAAAAAAAFt04wpAAAAQAxFRWcepbQoisfiZ0PG7XhPIBl2ssiD9ymMVpsDyLoHyWXboJLaqibNbiPUHk/KEToTVg7G/JCZ06Mfj0daVAc=",
        "result_xdr": "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=",
        "result_meta_xdr": "AAAAAQAAAAIAAAADAAWQUQAAAAAAAAAA45rgPYI9QseNjyN4bPHqD8UvRBR4imbmO6jHmW3TjCkAAAAXSHbnnAAFkFAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAWQUQAAAAAAAAAA45rgPYI9QseNjyN4bPHqD8UvRBR4imbmO6jHmW3TjCkAAAAXSHbnnAAFkFAAAAABAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAABAAAAAMABZBQAAAAAAAAAABN4+5u5YWd/Z6AN06F1g4yfULjJpqf9VGiINHIWM0UpQAAQkzJKzWcAAF79QAAP30AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABZBRAAAAAAAAAABN4+5u5YWd/Z6AN06F1g4yfULjJpqf9VGiINHIWM0UpQAAQk8Vd3UcAAF79QAAP30AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAMABZBRAAAAAAAAAADjmuA9gj1Cx42PI3hs8eoPxS9EFHiKZuY7qMeZbdOMKQAAABdIduecAAWQUAAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABZBRAAAAAAAAAADjmuA9gj1Cx42PI3hs8eoPxS9EFHiKZuY7qMeZbdOMKQAAABT8KqgcAAWQUAAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "fee_meta_xdr": "AAAAAgAAAAMABZBQAAAAAAAAAADjmuA9gj1Cx42PI3hs8eoPxS9EFHiKZuY7qMeZbdOMKQAAABdIdugAAAWQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABZBRAAAAAAAAAADjmuA9gj1Cx42PI3hs8eoPxS9EFHiKZuY7qMeZbdOMKQAAABdIduecAAWQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "memo_type": "text",
        "signatures": [
          "DEVFZx6ltCiKx+JnQ8bteE8gGXayyIP3KYxWmwPIugfJZdugktqqJs1uI9QeT8oROhNWDsb8kJnTox+PR1pUBw=="
        ]
      },
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/transactions/80af95a8aeb49bd19eeb2c89fbdd18c691fe80d1a0609fd20c8418fdde0ea943"
          },
          "account": {
            "href": "https://horizon-testnet.stellar.org/accounts/GCYN7MI6VXVRP74KR6MKBAW2ELLCXL6QCY5H4YQ62HVWZWMCE6Y232UC"
          },
          "ledger": {
            "href": "https://horizon-testnet.stellar.org/ledgers/364625"
          },
          "operations": {
            "href": "https://horizon-testnet.stellar.org/transactions/80af95a8aeb49bd19eeb2c89fbdd18c691fe80d1a0609fd20c8418fdde0ea943/operations{?cursor,limit,order}",
            "templated": true
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/transactions/80af95a8aeb49bd19eeb2c89fbdd18c691fe80d1a0609fd20c8418fdde0ea943/effects{?cursor,limit,order}",
            "templated": true
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=asc&cursor=1566052450312192"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=desc&cursor=1566052450312192"
          }
        },
        "id": "80af95a8aeb49bd19eeb2c89fbdd18c691fe80d1a0609fd20c8418fdde0ea943",
        "paging_token": "1566052450312192",
        "successful": true,
        "hash": "80af95a8aeb49bd19eeb2c89fbdd18c691fe80d1a0609fd20c8418fdde0ea943",
        "ledger": 364625,
        "created_at": "2019-05-16T10:17:44Z",
        "source_account": "GCYN7MI6VXVRP74KR6MKBAW2ELLCXL6QCY5H4YQ62HVWZWMCE6Y232UC",
        "source_account_sequence": "132761734108361",
        "fee_paid": 5000,
        "operation_count": 50,
        "envelope_xdr": "AAAAALDfsR6t6xf/io...",
        "result_xdr": "AAAAALDfsR6t6xf/io...",
        "fee_meta_xdr": "AAAAAgAAAAMABZBQAAAAAAAAAACw37EeresX/4qPmKCC2iLWK6/QFjp+Yh7R62zZgiexrQAAABdB/2doAAB4vwAAVMgAAACLAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABZBRAAAAAAAAAACw37EeresX/4qPmKCC2iLWK6/QFjp+Yh7R62zZgiexrQAAABdB/1PgAAB4vwAAVMgAAACLAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "memo_type": "none",
        "signatures": [
          "y3niLNdTDYEmLv9n13RAm58VBy0zTexh5IsbM/ajTDOA00ozphxymabRayRL8xHQZRWFka9kh+zlyLfnIB4JBw=="
        ]
      }
    ]
  }
}`

var emptyTransactionsPage = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1566052450312192&limit=2&order=desc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1566048155353088&limit=2&order=desc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1566052450308096&limit=2&order=asc"
    }
  },
  "_embedded": {
    "records": []
  }
}`
