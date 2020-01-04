package horizonclient

import (
	"fmt"
	"net/http"
	"testing"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/effects"
	"github.com/stellar/go/protocols/horizon/operations"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/support/http/httptest"
	"github.com/stellar/go/txnbuild"
	"github.com/stretchr/testify/assert"
)

func ExampleClient_AccountDetail() {

	client := DefaultPublicNetClient
	accountRequest := AccountRequest{AccountID: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}

	account, err := client.AccountDetail(accountRequest)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Print(account)
}

func ExampleClient_Effects() {

	client := DefaultPublicNetClient
	// effects for an account
	effectRequest := EffectRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	effect, err := client.Effects(effectRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(effect)

	// all effects
	effectRequest = EffectRequest{}
	effect, err = client.Effects(effectRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	records := effect.Embedded.Records
	if records[0].GetType() == "account_created" {
		acc, ok := records[0].(effects.AccountCreated)
		if ok {
			fmt.Print(acc.Account)
			fmt.Print(acc.StartingBalance)
		}
	}
}

func ExampleClient_Assets() {

	client := DefaultPublicNetClient
	// assets for asset issuer
	assetRequest := AssetRequest{ForAssetIssuer: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	asset, err := client.Assets(assetRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(asset)

	// all assets
	assetRequest = AssetRequest{}
	asset, err = client.Assets(assetRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(asset)
}

func ExampleClient_LedgerDetail() {

	client := DefaultPublicNetClient
	// details for a ledger
	sequence := uint32(12345)
	ledger, err := client.LedgerDetail(sequence)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ledger)

}

func ExampleClient_Metrics() {

	client := DefaultPublicNetClient
	// horizon metrics
	metrics, err := client.Metrics()
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(metrics)

}

func ExampleClient_FeeStats() {

	client := DefaultPublicNetClient
	// horizon fees
	fees, err := client.FeeStats()
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(fees)

}

func ExampleClient_Offers() {

	client := DefaultPublicNetClient
	offerRequest := OfferRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", Cursor: "now", Order: OrderDesc}
	offers, err := client.Offers(offerRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(offers)
}

func ExampleClient_Operations() {

	client := DefaultPublicNetClient
	// operations for an account
	opRequest := OperationRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	ops, err := client.Operations(opRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)

	// all operations
	opRequest = OperationRequest{Cursor: "now"}
	ops, err = client.Operations(opRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)
	records := ops.Embedded.Records

	for _, value := range records {
		// prints the type
		fmt.Print(value.GetType())
		// for example if the type is change_trust
		c, ok := value.(operations.ChangeTrust)
		if ok {
			// access ChangeTrust fields
			fmt.Print(c.Trustee)
		}

	}
}

func ExampleClient_OperationDetail() {

	client := DefaultPublicNetClient
	opID := "123456"
	// operation details for an id
	ops, err := client.OperationDetail(opID)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)
}

func ExampleClient_SubmitTransactionXDR() {

	client := DefaultPublicNetClient
	// https://www.stellar.org/laboratory/#xdr-viewer?input=AAAAAOoS%2F5V%2BBiCPXRiVcz8YsnkDdODufq%2Bg7xdqTdIXN8vyAAAE4gFiW0YAAALxAAAAAQAAAAAAAAAAAAAAAFyuBUcAAAABAAAABzIyMjgyNDUAAAAAAQAAAAEAAAAALhsY%2FFdAHXllTmb025DtCVBw06WDSQjq6I9NrCQHOV8AAAABAAAAAHT8zKV7bRQzuGTpk9AO3gjWJ9jVxBXTgguFORkxHVIKAAAAAAAAAAAAOnDwAAAAAAAAAAIkBzlfAAAAQPefqlsOvni6xX1g3AqddvOp1GOM88JYzayGZodbzTfV5toyhxZvL1ZggY3prFsvrereugEpj1kyPJ67z6gcRg0XN8vyAAAAQGwmoTssW49gaze8iQkz%2FUA2E2N%2BBOo%2B6v7YdOSsvIcZnMc37KmXH920nLosKpDLqkNChVztSZFcbVUlHhjbQgA%3D&type=TransactionEnvelope&network=public
	txXdr := `AAAAAOoS/5V+BiCPXRiVcz8YsnkDdODufq+g7xdqTdIXN8vyAAAE4gFiW0YAAALxAAAAAQAAAAAAAAAAAAAAAFyuBUcAAAABAAAABzIyMjgyNDUAAAAAAQAAAAEAAAAALhsY/FdAHXllTmb025DtCVBw06WDSQjq6I9NrCQHOV8AAAABAAAAAHT8zKV7bRQzuGTpk9AO3gjWJ9jVxBXTgguFORkxHVIKAAAAAAAAAAAAOnDwAAAAAAAAAAIkBzlfAAAAQPefqlsOvni6xX1g3AqddvOp1GOM88JYzayGZodbzTfV5toyhxZvL1ZggY3prFsvrereugEpj1kyPJ67z6gcRg0XN8vyAAAAQGwmoTssW49gaze8iQkz/UA2E2N+BOo+6v7YdOSsvIcZnMc37KmXH920nLosKpDLqkNChVztSZFcbVUlHhjbQgA=`

	// submit transaction
	resp, err := client.SubmitTransactionXDR(txXdr)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Print(resp)
	// Output: {{{https://horizon.stellar.org/transactions/f8a09e8a17fc828a1b99814818ddc931876eec0fe9c203f5980d26d92641e1c2 false}} f8a09e8a17fc828a1b99814818ddc931876eec0fe9c203f5980d26d92641e1c2 23350654 AAAAAOoS/5V+BiCPXRiVcz8YsnkDdODufq+g7xdqTdIXN8vyAAAE4gFiW0YAAALxAAAAAQAAAAAAAAAAAAAAAFyuBUcAAAABAAAABzIyMjgyNDUAAAAAAQAAAAEAAAAALhsY/FdAHXllTmb025DtCVBw06WDSQjq6I9NrCQHOV8AAAABAAAAAHT8zKV7bRQzuGTpk9AO3gjWJ9jVxBXTgguFORkxHVIKAAAAAAAAAAAAOnDwAAAAAAAAAAIkBzlfAAAAQPefqlsOvni6xX1g3AqddvOp1GOM88JYzayGZodbzTfV5toyhxZvL1ZggY3prFsvrereugEpj1kyPJ67z6gcRg0XN8vyAAAAQGwmoTssW49gaze8iQkz/UA2E2N+BOo+6v7YdOSsvIcZnMc37KmXH920nLosKpDLqkNChVztSZFcbVUlHhjbQgA= AAAAAAAABOIAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA= AAAAAQAAAAIAAAADAWRNfgAAAAAAAAAA6hL/lX4GII9dGJVzPxiyeQN04O5+r6DvF2pN0hc3y/IAAAAAAuyTvgFiW0YAAALwAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAWRNfgAAAAAAAAAA6hL/lX4GII9dGJVzPxiyeQN04O5+r6DvF2pN0hc3y/IAAAAAAuyTvgFiW0YAAALxAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAABAAAAAMBZE0IAAAAAAAAAAB0/Myle20UM7hk6ZPQDt4I1ifY1cQV04ILhTkZMR1SCgAAAbZToYkOAToKfwAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEBZE1+AAAAAAAAAAB0/Myle20UM7hk6ZPQDt4I1ifY1cQV04ILhTkZMR1SCgAAAbZT2/n+AToKfwAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAMBZE19AAAAAAAAAAAuGxj8V0AdeWVOZvTbkO0JUHDTpYNJCOroj02sJAc5XwAAAACrUfjvARGUKgAApRsAAAAAAAAAAAAAAAAAAAAObnlhbmRldi1pZC5vcmcAAAEAAAAAAAAAAAAAAAAAAAAAAAABAWRNfgAAAAAAAAAALhsY/FdAHXllTmb025DtCVBw06WDSQjq6I9NrCQHOV8AAAAAqxeH/wERlCoAAKUbAAAAAAAAAAAAAAAAAAAADm55YW5kZXYtaWQub3JnAAABAAAAAAAAAAAAAAAAAAAA}
}

func ExampleClient_SetHorizonTimeOut() {

	client := DefaultTestNetClient

	// https://www.stellar.org/laboratory/#xdr-viewer?input=AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM%2BHm2GVuCcAAAAZAAABD0AAuV%2FAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb%2FYRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj%2BcWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw%2F%2BD%2FqJk5QqM5dYeSUGeDQP&type=TransactionEnvelope&network=test
	txXdr := `AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0AAuV/AAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb/YRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj+cWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw/+D/qJk5QqM5dYeSUGeDQP`

	// test user timeout
	client = client.SetHorizonTimeOut(30)
	resp, err := client.SubmitTransactionXDR(txXdr)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Print(resp)
}

func ExampleClient_Transactions() {

	client := DefaultPublicNetClient
	// transactions for an account
	txRequest := TransactionRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	txs, err := client.Transactions(txRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(txs)

	// all transactions
	txRequest = TransactionRequest{Cursor: "now", Order: OrderDesc}
	txs, err = client.Transactions(txRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(txs)
	records := txs.Embedded.Records

	for _, tx := range records {
		fmt.Print(tx)
	}
}

func ExampleClient_OrderBook() {

	client := DefaultPublicNetClient
	// orderbook for an asset pair, e.g XLM/NGN
	obRequest := OrderBookRequest{BuyingAssetType: AssetTypeNative, SellingAssetCode: "USD", SellingAssetType: AssetType4, SellingAssetIssuer: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	obs, err := client.OrderBook(obRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(obs)
}

func ExampleClient_Payments() {

	client := DefaultPublicNetClient
	// payments for an account
	opRequest := OperationRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	ops, err := client.Payments(opRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)

	// all payments
	opRequest = OperationRequest{Cursor: "now"}
	ops, err = client.Payments(opRequest)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(ops)
	records := ops.Embedded.Records

	for _, value := range records {
		// prints the type
		fmt.Print(value.GetType())
		// for example if the type is create_account
		c, ok := value.(operations.CreateAccount)
		if ok {
			// access create_account fields
			fmt.Print(c.StartingBalance)
		}

	}
}

func ExampleClient_Fund() {
	client := DefaultTestNetClient
	// fund an account
	resp, err := client.Fund("GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU")
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Print(resp)
}

func TestFixHTTP(t *testing.T) {
	client := &Client{
		HorizonURL: "https://localhost/",
	}
	// No HTTP client is provided
	assert.Nil(t, client.HTTP, "client HTTP is nil")
	client.Root()
	// When a request is made, default HTTP client is set
	assert.IsType(t, client.HTTP, &http.Client{})
}

func TestClientFund(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	testAccount := "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"

	// not testnet
	hmock.On(
		"GET",
		"https://localhost/friendbot?addr=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(200, txSuccess)

	_, err := client.Fund(testAccount)
	// error case: not testnet
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "can't fund account from friendbot on production network")
	}

	// happy path
	hmock.On(
		"GET",
		"https://localhost/friendbot?addr=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(200, txSuccess)

	client.isTestNet = true
	resp, err := client.Fund(testAccount)

	if assert.NoError(t, err) {
		assert.IsType(t, resp, hProtocol.TransactionSuccess{})
		assert.Equal(t, resp.Links.Transaction.Href, "https://horizon-testnet.stellar.org/transactions/bcc7a97264dca0a51a63f7ea971b5e7458e334489673078bb2a34eb0cce910ca")
		assert.Equal(t, resp.Hash, "bcc7a97264dca0a51a63f7ea971b5e7458e334489673078bb2a34eb0cce910ca")
		assert.Equal(t, resp.Ledger, int32(354811))
		assert.Equal(t, resp.Env, `AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0AAuV/AAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb/YRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj+cWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw/+D/qJk5QqM5dYeSUGeDQP`)
		assert.Equal(t, resp.Result, "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA=")
		assert.Equal(t, resp.Meta, `AAAAAQAAAAIAAAADAAVp+wAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwACBP/TuycHAAABD0AAuV+AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAVp+wAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwACBP/TuycHAAABD0AAuV/AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAMABWn7AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAIE/9O7JwcAAAEPQAC5X8AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABWn7AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAIE+gGdbQcAAAEPQAC5X8AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAABWn7AAAAAAAAAADJMEbE6B9ICmmmxOdv9hGvqA5HxZPQtk2uEuHjLcUKCgAAABdIdugAAAVp+wAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==`)
	}

	// failure response
	hmock.On(
		"GET",
		"https://localhost/friendbot?addr=GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(400, transactionFailure)

	_, err = client.Fund(testAccount)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "horizon error")
		horizonError, ok := errors.Cause(err).(*Error)
		assert.Equal(t, ok, true)
		assert.Equal(t, horizonError.Problem.Title, "Transaction Failed")
		resultString, err := horizonError.ResultString()
		assert.Nil(t, err)
		assert.Equal(t, resultString, "AAAAAAAAAAD////4AAAAAA==")
	}
}

func TestAccountDetail(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// no parameters
	accountRequest := AccountRequest{}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(200, accountResponse)

	_, err := client.AccountDetail(accountRequest)
	// error case: no account id
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "no account ID provided")
	}

	// wrong parameters
	accountRequest = AccountRequest{DataKey: "test"}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(200, accountResponse)

	_, err = client.AccountDetail(accountRequest)
	// error case: no account id
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "no account ID provided")
	}

	accountRequest = AccountRequest{AccountID: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}

	// happy path
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(200, accountResponse)

	account, err := client.AccountDetail(accountRequest)

	if assert.NoError(t, err) {
		assert.Equal(t, account.ID, "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU")
		assert.Equal(t, account.Signers[0].Key, "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU")
		assert.Equal(t, account.Signers[0].Type, "ed25519_public_key")
		assert.Equal(t, account.Data["test"], "dGVzdA==")
		balance, balanceErr := account.GetNativeBalance()
		assert.Nil(t, balanceErr)
		assert.Equal(t, balance, "9999.9999900")
	}

	// failure response
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnString(404, notFoundResponse)

	account, err = client.AccountDetail(accountRequest)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "horizon error")
		horizonError, ok := err.(*Error)
		assert.Equal(t, ok, true)
		assert.Equal(t, horizonError.Problem.Title, "Resource Missing")
	}

	// connection error
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
	).ReturnError("http.Client error")

	_, err = client.AccountDetail(accountRequest)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "http.Client error")
		_, ok := err.(*Error)
		assert.Equal(t, ok, false)
	}
}

func TestAccountData(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// no parameters
	accountRequest := AccountRequest{}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/data/test",
	).ReturnString(200, accountResponse)

	_, err := client.AccountData(accountRequest)
	// error case: few parameters
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "too few parameters")
	}

	// wrong parameters
	accountRequest = AccountRequest{AccountID: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/data/test",
	).ReturnString(200, accountResponse)

	_, err = client.AccountData(accountRequest)
	// error case: few parameters
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "too few parameters")
	}

	accountRequest = AccountRequest{AccountID: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", DataKey: "test"}

	// happy path
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/data/test",
	).ReturnString(200, accountData)

	data, err := client.AccountData(accountRequest)
	if assert.NoError(t, err) {
		assert.Equal(t, data.Value, "dGVzdA==")
	}

}

func TestEffectsRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	effectRequest := EffectRequest{}

	// all effects
	hmock.On(
		"GET",
		"https://localhost/effects",
	).ReturnString(200, effectsResponse)

	effs, err := client.Effects(effectRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, effs, effects.EffectsPage{})
		links := effs.Links
		assert.Equal(t, links.Self.Href, "https://horizon-testnet.stellar.org/operations/43989725060534273/effects?cursor=&limit=10&order=asc")

		assert.Equal(t, links.Next.Href, "https://horizon-testnet.stellar.org/operations/43989725060534273/effects?cursor=43989725060534273-3&limit=10&order=asc")

		assert.Equal(t, links.Prev.Href, "https://horizon-testnet.stellar.org/operations/43989725060534273/effects?cursor=43989725060534273-1&limit=10&order=desc")

		adEffect := effs.Embedded.Records[0]
		acEffect := effs.Embedded.Records[1]
		arEffect := effs.Embedded.Records[2]
		assert.IsType(t, adEffect, effects.AccountDebited{})
		assert.IsType(t, acEffect, effects.AccountCredited{})
		// account_removed effect does not have a struct. Defaults to effects.Base
		assert.IsType(t, arEffect, effects.Base{})

		c, ok := acEffect.(effects.AccountCredited)
		assert.Equal(t, ok, true)
		assert.Equal(t, c.ID, "0043989725060534273-0000000002")
		assert.Equal(t, c.Amount, "9999.9999900")
		assert.Equal(t, c.Account, "GBO7LQUWCC7M237TU2PAXVPOLLYNHYCYYFCLVMX3RBJCML4WA742X3UB")
		assert.Equal(t, c.Asset.Type, "native")
	}

	effectRequest = EffectRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/effects",
	).ReturnString(200, effectsResponse)

	effs, err = client.Effects(effectRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, effs, effects.EffectsPage{})
	}

	// too many parameters
	effectRequest = EffectRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", ForLedger: "123"}
	hmock.On(
		"GET",
		"https://localhost/effects",
	).ReturnString(200, effectsResponse)

	_, err = client.Effects(effectRequest)
	// error case
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "too many parameters")
	}
}

func TestAssetsRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	assetRequest := AssetRequest{}

	// all assets
	hmock.On(
		"GET",
		"https://localhost/assets",
	).ReturnString(200, assetsResponse)

	assets, err := client.Assets(assetRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, assets, hProtocol.AssetsPage{})
		record := assets.Embedded.Records[0]
		assert.Equal(t, record.Asset.Code, "ABC")
		assert.Equal(t, record.Asset.Issuer, "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU")
		assert.Equal(t, record.PT, "1")
		assert.Equal(t, record.NumAccounts, int32(3))
		assert.Equal(t, record.Amount, "105.0000000")
		assert.Equal(t, record.Flags.AuthRevocable, false)
		assert.Equal(t, record.Flags.AuthRequired, true)
		assert.Equal(t, record.Flags.AuthImmutable, false)
	}

}

func TestMetrics(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// happy path
	hmock.On(
		"GET",
		"https://localhost/metrics",
	).ReturnString(200, metricsResponse)

	metrics, err := client.Metrics()

	if assert.NoError(t, err) {
		assert.Equal(t, metrics.GoRoutines.Value, 1893)
		assert.Equal(t, metrics.HistoryElderLedger.Value, 1)
		assert.Equal(t, metrics.HistoryLatestLedger.Value, 22826153)
		assert.Equal(t, metrics.IngesterClearLedger.Median, float64(0))
		assert.Equal(t, metrics.IngesterIngestLedger.Percent99_9, 185115016.58600014)
		assert.Equal(t, metrics.LoggingDebug.Count, 0)
		assert.Equal(t, metrics.LoggingError.Rate15m, float64(0))
		assert.Equal(t, metrics.LoggingInfo.MeanRate, 227.30356525388274)
		assert.Equal(t, metrics.LoggingPanic.Rate1m, float64(0))
		assert.Equal(t, metrics.LoggingWarning.Rate5m, 3.714334583072108e-10)
		assert.Equal(t, metrics.RequestsFailed.Rate5m, 47.132925275045295)
		assert.Equal(t, metrics.RequestsSucceeded.MeanRate, 68.31190342961553)
		assert.Equal(t, metrics.RequestsTotal.Percent99, 55004856745.49)
		assert.Equal(t, metrics.CoreLatestLedger.Value, 22826156)
		assert.Equal(t, metrics.CoreOpenConnections.Value, 94)
		assert.Equal(t, metrics.TxsubBuffered.Value, 1)
		assert.Equal(t, metrics.TxsubFailed.Count, 13977)
		assert.Equal(t, metrics.TxsubSucceeded.Rate15m, 0.3684477520175787)
		assert.Equal(t, metrics.TxsubOpen.Value, 0)
		assert.Equal(t, metrics.TxsubTotal.Rate5m, 0.3935864740456858)

	}

	// connection error
	hmock.On(
		"GET",
		"https://localhost/metrics",
	).ReturnError("http.Client error")

	_, err = client.Metrics()
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "http.Client error")
		_, ok := err.(*Error)
		assert.Equal(t, ok, false)
	}
}

func TestFeeStats(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// happy path
	hmock.On(
		"GET",
		"https://localhost/fee_stats",
	).ReturnString(200, feesResponse)

	fees, err := client.FeeStats()

	if assert.NoError(t, err) {
		assert.Equal(t, fees.LastLedger, 22606298)
		assert.Equal(t, fees.LastLedgerBaseFee, 100)
		assert.Equal(t, fees.LedgerCapacityUsage, 0.97)
		assert.Equal(t, fees.MinAcceptedFee, 130)
		assert.Equal(t, fees.ModeAcceptedFee, 250)
		assert.Equal(t, fees.P10AcceptedFee, 150)
		assert.Equal(t, fees.P20AcceptedFee, 200)
		assert.Equal(t, fees.P30AcceptedFee, 300)
		assert.Equal(t, fees.P40AcceptedFee, 400)
		assert.Equal(t, fees.P50AcceptedFee, 500)
		assert.Equal(t, fees.P60AcceptedFee, 1000)
		assert.Equal(t, fees.P70AcceptedFee, 2000)
		assert.Equal(t, fees.P80AcceptedFee, 3000)
		assert.Equal(t, fees.P90AcceptedFee, 4000)
		assert.Equal(t, fees.P95AcceptedFee, 5000)
		assert.Equal(t, fees.P99AcceptedFee, 8000)
	}

	// connection error
	hmock.On(
		"GET",
		"https://localhost/metrics",
	).ReturnError("http.Client error")

	_, err = client.Metrics()
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "http.Client error")
		_, ok := err.(*Error)
		assert.Equal(t, ok, false)
	}
}

func TestOfferRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	offersRequest := OfferRequest{ForAccount: "GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F"}

	// account offers
	hmock.On(
		"GET",
		"https://localhost/accounts/GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F/offers",
	).ReturnString(200, offersResponse)

	offers, err := client.Offers(offersRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, offers, hProtocol.OffersPage{})
		record := offers.Embedded.Records[0]
		assert.Equal(t, record.ID, int64(432323))
		assert.Equal(t, record.Seller, "GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F")
		assert.Equal(t, record.PT, "432323")
		assert.Equal(t, record.Selling.Code, "ABC")
		assert.Equal(t, record.Amount, "1999979.8700000")
		assert.Equal(t, record.LastModifiedLedger, int32(103307))
	}
}

func TestOperationsRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	operationRequest := OperationRequest{Join: "transactions"}

	// all operations
	hmock.On(
		"GET",
		"https://localhost/operations?join=transactions",
	).ReturnString(200, multipleOpsResponse)

	ops, err := client.Operations(operationRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, ops, operations.OperationsPage{})
		links := ops.Links
		assert.Equal(t, links.Self.Href, "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53/operations?cursor=&limit=10&order=asc")

		assert.Equal(t, links.Next.Href, "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53/operations?cursor=98447788659970049&limit=10&order=asc")

		assert.Equal(t, links.Prev.Href, "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53/operations?cursor=98447788659970049&limit=10&order=desc")

		paymentOp := ops.Embedded.Records[0]
		mangageOfferOp := ops.Embedded.Records[1]
		createAccountOp := ops.Embedded.Records[2]
		assert.IsType(t, paymentOp, operations.Payment{})
		assert.IsType(t, mangageOfferOp, operations.ManageSellOffer{})
		assert.IsType(t, createAccountOp, operations.CreateAccount{})

		c, ok := createAccountOp.(operations.CreateAccount)
		assert.Equal(t, ok, true)
		assert.Equal(t, c.ID, "98455906148208641")
		assert.Equal(t, c.StartingBalance, "2.0000000")
		assert.Equal(t, c.TransactionHash, "ade3c60f1b581e8744596673d95bffbdb8f68f199e0e2f7d63b7c3af9fd8d868")
	}

	// all payments
	hmock.On(
		"GET",
		"https://localhost/payments?join=transactions",
	).ReturnString(200, paymentsResponse)

	ops, err = client.Payments(operationRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, ops, operations.OperationsPage{})
		links := ops.Links
		assert.Equal(t, links.Self.Href, "https://horizon-testnet.stellar.org/payments?cursor=&limit=2&order=desc")

		assert.Equal(t, links.Next.Href, "https://horizon-testnet.stellar.org/payments?cursor=2024660468248577&limit=2&order=desc")

		assert.Equal(t, links.Prev.Href, "https://horizon-testnet.stellar.org/payments?cursor=2024660468256769&limit=2&order=asc")

		createAccountOp := ops.Embedded.Records[0]
		paymentOp := ops.Embedded.Records[1]

		assert.IsType(t, paymentOp, operations.Payment{})
		assert.IsType(t, createAccountOp, operations.CreateAccount{})

		p, ok := paymentOp.(operations.Payment)
		assert.Equal(t, ok, true)
		assert.Equal(t, p.ID, "2024660468248577")
		assert.Equal(t, p.Amount, "177.0000000")
		assert.Equal(t, p.TransactionHash, "87d7a29539e7902b14a6c720094856f74a77128ab332d8629432c5a176a9fe7b")
	}

	// operations for account
	operationRequest = OperationRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/operations",
	).ReturnString(200, multipleOpsResponse)

	ops, err = client.Operations(operationRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, ops, operations.OperationsPage{})
	}

	// too many parameters
	operationRequest = OperationRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", ForLedger: 123}
	hmock.On(
		"GET",
		"https://localhost/operations",
	).ReturnString(200, multipleOpsResponse)

	_, err = client.Operations(operationRequest)
	// error case
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "too many parameters")
	}

	// operation detail
	opID := "1103965508866049"
	hmock.On(
		"GET",
		"https://localhost/operations/1103965508866049",
	).ReturnString(200, opsResponse)

	record, err := client.OperationDetail(opID)
	if assert.NoError(t, err) {
		assert.Equal(t, record.GetType(), "change_trust")
		c, ok := record.(operations.ChangeTrust)
		assert.Equal(t, ok, true)
		assert.Equal(t, c.ID, "1103965508866049")
		assert.Equal(t, c.TransactionSuccessful, true)
		assert.Equal(t, c.TransactionHash, "93c2755ec61c8b01ac11daa4d8d7a012f56be172bdfcaf77a6efd683319ca96d")
		assert.Equal(t, c.Asset.Code, "UAHd")
		assert.Equal(t, c.Asset.Issuer, "GDDETPGV4OJVNBTB6GQICCPGH5DZRYYB7XQCSAZO2ZQH6HO7SWXHKKJN")
		assert.Equal(t, c.Limit, "922337203685.4775807")
		assert.Equal(t, c.Trustee, "GDDETPGV4OJVNBTB6GQICCPGH5DZRYYB7XQCSAZO2ZQH6HO7SWXHKKJN")
		assert.Equal(t, c.Trustor, "GBMVGXJXJ7ZBHIWMXHKR6IVPDTYKHJPXC2DHZDPJBEZWZYAC7NKII7IB")
		assert.Equal(t, c.Links.Self.Href, "https://horizon-testnet.stellar.org/operations/1103965508866049")
		assert.Equal(t, c.Links.Effects.Href, "https://horizon-testnet.stellar.org/operations/1103965508866049/effects")
		assert.Equal(t, c.Links.Transaction.Href, "https://horizon-testnet.stellar.org/transactions/93c2755ec61c8b01ac11daa4d8d7a012f56be172bdfcaf77a6efd683319ca96d")

		assert.Equal(t, c.Links.Succeeds.Href, "https://horizon-testnet.stellar.org/effects?order=desc\u0026cursor=1103965508866049")

		assert.Equal(t, c.Links.Precedes.Href, "https://horizon-testnet.stellar.org/effects?order=asc\u0026cursor=1103965508866049")
	}

}

func TestSubmitRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	txXdr := `AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0AAuV/AAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb/YRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj+cWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw/+D/qJk5QqM5dYeSUGeDQP`

	// failure response
	hmock.
		On("POST", "https://localhost/transactions").
		ReturnString(400, transactionFailure)

	_, err := client.SubmitTransactionXDR(txXdr)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "horizon error")
		horizonError, ok := errors.Cause(err).(*Error)
		assert.Equal(t, ok, true)
		assert.Equal(t, horizonError.Problem.Title, "Transaction Failed")
	}

	// connection error
	hmock.
		On("POST", "https://localhost/transactions").
		ReturnError("http.Client error")

	_, err = client.SubmitTransactionXDR(txXdr)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "http.Client error")
		_, ok := err.(*Error)
		assert.Equal(t, ok, false)
	}

	// successful tx
	hmock.On(
		"POST",
		"https://localhost/transactions?tx=AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM%2BHm2GVuCcAAAAZAAABD0AAuV%2FAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb%2FYRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj%2BcWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw%2F%2BD%2FqJk5QqM5dYeSUGeDQP",
	).ReturnString(200, txSuccess)

	resp, err := client.SubmitTransactionXDR(txXdr)
	if assert.NoError(t, err) {
		assert.IsType(t, resp, hProtocol.TransactionSuccess{})
		assert.Equal(t, resp.Links.Transaction.Href, "https://horizon-testnet.stellar.org/transactions/bcc7a97264dca0a51a63f7ea971b5e7458e334489673078bb2a34eb0cce910ca")
		assert.Equal(t, resp.Hash, "bcc7a97264dca0a51a63f7ea971b5e7458e334489673078bb2a34eb0cce910ca")
		assert.Equal(t, resp.Ledger, int32(354811))
		assert.Equal(t, resp.Env, `AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0AAuV/AAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb/YRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj+cWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw/+D/qJk5QqM5dYeSUGeDQP`)
		assert.Equal(t, resp.Result, "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA=")
		assert.Equal(t, resp.Meta, `AAAAAQAAAAIAAAADAAVp+wAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwACBP/TuycHAAABD0AAuV+AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAVp+wAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwACBP/TuycHAAABD0AAuV/AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAMABWn7AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAIE/9O7JwcAAAEPQAC5X8AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABWn7AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAIE+gGdbQcAAAEPQAC5X8AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAABWn7AAAAAAAAAADJMEbE6B9ICmmmxOdv9hGvqA5HxZPQtk2uEuHjLcUKCgAAABdIdugAAAVp+wAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==`)
	}
}

func TestTransactionsRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	transactionRequest := TransactionRequest{}

	// all transactions
	hmock.On(
		"GET",
		"https://localhost/transactions",
	).ReturnString(200, txPageResponse)

	txs, err := client.Transactions(transactionRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, txs, hProtocol.TransactionsPage{})
		links := txs.Links
		assert.Equal(t, links.Self.Href, "https://horizon-testnet.stellar.org/transactions?cursor=&limit=10&order=desc")

		assert.Equal(t, links.Next.Href, "https://horizon-testnet.stellar.org/transactions?cursor=1881762611335168&limit=10&order=desc")

		assert.Equal(t, links.Prev.Href, "https://horizon-testnet.stellar.org/transactions?cursor=1881771201286144&limit=10&order=asc")

		tx := txs.Embedded.Records[0]
		assert.IsType(t, tx, hProtocol.Transaction{})
		assert.Equal(t, tx.ID, "3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599")
		assert.Equal(t, tx.Ledger, int32(438134))
		assert.Equal(t, tx.FeePaid, int32(100))
		assert.Equal(t, tx.Hash, "3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599")
	}

	transactionRequest = TransactionRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"}
	hmock.On(
		"GET",
		"https://localhost/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/transactions",
	).ReturnString(200, txPageResponse)

	txs, err = client.Transactions(transactionRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, txs, hProtocol.TransactionsPage{})
	}

	// too many parameters
	transactionRequest = TransactionRequest{ForAccount: "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", ForLedger: 123}
	hmock.On(
		"GET",
		"https://localhost/transactions",
	).ReturnString(200, txPageResponse)

	_, err = client.Transactions(transactionRequest)
	// error case
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "too many parameters")
	}

	// transaction detail
	txHash := "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c"
	hmock.On(
		"GET",
		"https://localhost/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c",
	).ReturnString(200, txDetailResponse)

	record, err := client.TransactionDetail(txHash)
	if assert.NoError(t, err) {
		assert.Equal(t, record.ID, "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c")
		assert.Equal(t, record.Successful, true)
		assert.Equal(t, record.Hash, "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c")
		assert.Equal(t, record.Memo, "2A1V6J5703G47XHY")
	}
}

func TestOrderBookRequest(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	orderBookRequest := OrderBookRequest{BuyingAssetType: AssetTypeNative, SellingAssetCode: "USD", SellingAssetType: AssetType4, SellingAssetIssuer: "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5"}

	// orderbook for XLM/USD
	hmock.On(
		"GET",
		"https://localhost/order_book?buying_asset_type=native&selling_asset_code=USD&selling_asset_issuer=GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5&selling_asset_type=credit_alphanum4",
	).ReturnString(200, orderbookResponse)

	obs, err := client.OrderBook(orderBookRequest)
	if assert.NoError(t, err) {
		assert.IsType(t, obs, hProtocol.OrderBookSummary{})
		bids := obs.Bids
		asks := obs.Asks
		assert.Equal(t, bids[0].Price, "0.0000251")
		assert.Equal(t, asks[0].Price, "0.0000256")
		assert.Equal(t, obs.Selling.Type, "native")
		assert.Equal(t, obs.Buying.Type, "credit_alphanum4")
	}

	// failure response
	orderBookRequest = OrderBookRequest{}
	hmock.On(
		"GET",
		"https://localhost/order_book",
	).ReturnString(400, orderBookNotFound)

	_, err = client.OrderBook(orderBookRequest)
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "horizon error")
		horizonError, ok := err.(*Error)
		assert.Equal(t, ok, true)
		assert.Equal(t, horizonError.Problem.Title, "Invalid Order Book Parameters")
	}

}

func TestFetchTimebounds(t *testing.T) {
	hmock := httptest.NewClient()
	client := &Client{
		HorizonURL: "https://localhost/",
		HTTP:       hmock,
	}

	// mock currentUniversalTime
	client.SetCurrentUniversalTime(func() int64 {
		return int64(1560947096)
	})

	// When no saved server time, return local time
	st, err := client.FetchTimebounds(100)
	if assert.NoError(t, err) {
		assert.IsType(t, ServerTimeMap["localhost"], ServerTimeRecord{})
		assert.Equal(t, st.MinTime, int64(0))
	}

	// server time is saved on requests to horizon
	header := http.Header{}
	header.Add("Date", "Wed, 19 Jun 2019 12:24:56 GMT") //unix time: 1560947096
	hmock.On(
		"GET",
		"https://localhost/metrics",
	).ReturnStringWithHeader(200, metricsResponse, header)
	_, err = client.Metrics()
	assert.NoError(t, err)

	// get saved server time
	st, err = client.FetchTimebounds(100)
	if assert.NoError(t, err) {
		assert.IsType(t, ServerTimeMap["localhost"], ServerTimeRecord{})
		assert.Equal(t, st.MinTime, int64(0))
		// serverTime + 100seconds
		assert.Equal(t, st.MaxTime, int64(1560947196))
	}

	// mock server time
	newRecord := ServerTimeRecord{ServerTime: 100, LocalTimeRecorded: client.currentUniversalTime()}
	ServerTimeMap["localhost"] = newRecord
	st, err = client.FetchTimebounds(100)
	assert.NoError(t, err)
	assert.IsType(t, st, txnbuild.Timebounds{})
	assert.Equal(t, st.MinTime, int64(0))
	// time should be 200, serverTime + 100seconds
	assert.Equal(t, st.MaxTime, int64(200))
}

var accountResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"
    },
    "transactions": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/transactions{?cursor,limit,order}",
      "templated": true
    },
    "operations": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/operations{?cursor,limit,order}",
      "templated": true
    },
    "payments": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/payments{?cursor,limit,order}",
      "templated": true
    },
    "effects": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/effects{?cursor,limit,order}",
      "templated": true
    },
    "offers": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/offers{?cursor,limit,order}",
      "templated": true
    },
    "trades": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/trades{?cursor,limit,order}",
      "templated": true
    },
    "data": {
      "href": "https://horizon-testnet.stellar.org/accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/data/{key}",
      "templated": true
    }
  },
  "id": "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
  "paging_token": "1",
  "account_id": "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
  "sequence": "9865509814140929",
  "subentry_count": 1,
  "thresholds": {
    "low_threshold": 0,
    "med_threshold": 0,
    "high_threshold": 0
  },
  "flags": {
    "auth_required": false,
    "auth_revocable": false,
    "auth_immutable": false
  },
  "balances": [
    {
      "balance": "9999.9999900",
      "buying_liabilities": "0.0000000",
      "selling_liabilities": "0.0000000",
      "asset_type": "native"
    }
  ],
  "signers": [
    {
      "public_key": "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
      "weight": 1,
      "key": "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
      "type": "ed25519_public_key"
    }
  ],
  "data": {
    "test": "dGVzdA=="
  }
}`

var notFoundResponse = `{
  "type": "https://stellar.org/horizon-errors/not_found",
  "title": "Resource Missing",
  "status": 404,
  "detail": "The resource at the url requested was not found.  This is usually occurs for one of two reasons:  The url requested is not valid, or no data in our database could be found with the parameters provided.",
  "instance": "horizon-live-001/61KdRW8tKi-18408110"
}`

var accountData = `{
  "value": "dGVzdA=="
}`

var effectsResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/operations/43989725060534273/effects?cursor=&limit=10&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/operations/43989725060534273/effects?cursor=43989725060534273-3&limit=10&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/operations/43989725060534273/effects?cursor=43989725060534273-1&limit=10&order=desc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "operation": {
            "href": "https://horizon-testnet.stellar.org/operations/43989725060534273"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=43989725060534273-1"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=43989725060534273-1"
          }
        },
        "id": "0043989725060534273-0000000001",
        "paging_token": "43989725060534273-1",
        "account": "GANHAS5OMPLKD6VYU4LK7MBHSHB2Q37ZHAYWOBJRUXGDHMPJF3XNT45Y",
        "type": "account_debited",
        "type_i": 3,
        "created_at": "2018-07-27T21:00:12Z",
        "asset_type": "native",
        "amount": "9999.9999900"
      },
      {
        "_links": {
          "operation": {
            "href": "https://horizon-testnet.stellar.org/operations/43989725060534273"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=43989725060534273-2"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=43989725060534273-2"
          }
        },
        "id": "0043989725060534273-0000000002",
        "paging_token": "43989725060534273-2",
        "account": "GBO7LQUWCC7M237TU2PAXVPOLLYNHYCYYFCLVMX3RBJCML4WA742X3UB",
        "type": "account_credited",
        "type_i": 2,
        "created_at": "2018-07-27T21:00:12Z",
        "asset_type": "native",
        "amount": "9999.9999900"
      },
      {
        "_links": {
          "operation": {
            "href": "https://horizon-testnet.stellar.org/operations/43989725060534273"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=43989725060534273-3"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=43989725060534273-3"
          }
        },
        "id": "0043989725060534273-0000000003",
        "paging_token": "43989725060534273-3",
        "account": "GANHAS5OMPLKD6VYU4LK7MBHSHB2Q37ZHAYWOBJRUXGDHMPJF3XNT45Y",
        "type": "account_removed",
        "type_i": 1,
        "created_at": "2018-07-27T21:00:12Z"
      }
    ]
  }
}`

var assetsResponse = `{
    "_links": {
        "self": {
            "href": "https://horizon-testnet.stellar.org/assets?cursor=&limit=1&order=desc"
        },
        "next": {
            "href": "https://horizon-testnet.stellar.org/assets?cursor=ABC_GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU_credit_alphanum12&limit=1&order=desc"
        },
        "prev": {
            "href": "https://horizon-testnet.stellar.org/assets?cursor=ABC_GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU_credit_alphanum12&limit=1&order=asc"
        }
    },
    "_embedded": {
        "records": [
            {
                "_links": {
                    "toml": {
                        "href": ""
                    }
                },
                "asset_type": "credit_alphanum12",
                "asset_code": "ABC",
                "asset_issuer": "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU",
                "paging_token": "1",
                "amount": "105.0000000",
                "num_accounts": 3,
                "flags": {
                    "auth_required": true,
                    "auth_revocable": false,
                    "auth_immutable": false
                }
            }
        ]
    }
}`

var ledgerResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/ledgers/69859"
    },
    "transactions": {
      "href": "https://horizon-testnet.stellar.org/ledgers/69859/transactions{?cursor,limit,order}",
      "templated": true
    },
    "operations": {
      "href": "https://horizon-testnet.stellar.org/ledgers/69859/operations{?cursor,limit,order}",
      "templated": true
    },
    "payments": {
      "href": "https://horizon-testnet.stellar.org/ledgers/69859/payments{?cursor,limit,order}",
      "templated": true
    },
    "effects": {
      "href": "https://horizon-testnet.stellar.org/ledgers/69859/effects{?cursor,limit,order}",
      "templated": true
    }
  },
  "id": "71a40c0581d8d7c1158e1d9368024c5f9fd70de17a8d277cdd96781590cc10fb",
  "paging_token": "300042120331264",
  "hash": "71a40c0581d8d7c1158e1d9368024c5f9fd70de17a8d277cdd96781590cc10fb",
  "prev_hash": "78979bed15463bfc3b0c1915acc6aec866565d360ba6565d26ffbb3dc484f18c",
  "sequence": 69859,
  "successful_transaction_count": 0,
  "failed_transaction_count": 1,
  "operation_count": 0,
  "closed_at": "2019-03-03T13:38:16Z",
  "total_coins": "100000000000.0000000",
  "fee_pool": "10.7338093",
  "base_fee_in_stroops": 100,
  "base_reserve_in_stroops": 5000000,
  "max_tx_set_size": 100,
  "protocol_version": 10,
  "header_xdr": "AAAACniXm+0VRjv8OwwZFazGrshmVl02C6ZWXSb/uz3EhPGMLuFhI0sVqAG57WnGMUKmOUk/J8TAktUB97VgrgEsZuEAAAAAXHvYyAAAAAAAAAAAcvWzXsmT72oXZ7QPC1nZLJei+lFwYRXF4FIz/PQguubMDKGRJrT/0ofTHlZjWAMWjABeGgup7zhfZkm0xrthCAABEOMN4Lazp2QAAAAAAAAGZdltAAAAAAAAAAAABOqvAAAAZABMS0AAAABk4Vse3u3dDM9UWfoH9ooQLLSXYEee8xiHu/k9p6YLlWR2KT4hYGehoHGmp04rhMRMAEp+GHE+KXv0UUxAPmmNmwGYK2HFCnl5a931YmTQYrHQzEeCHx+aI4+TLjTlFjMqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
}`

var metricsResponse = `{
  "_links": {
    "self": {
      "href": "/metrics"
    }
  },
  "goroutines": {
    "value": 1893
  },
  "history.elder_ledger": {
    "value": 1
  },
  "history.latest_ledger": {
    "value": 22826153
  },
  "history.open_connections": {
    "value": 27
	},
	 "ingester.clear_ledger": {
    "15m.rate": 0,
    "1m.rate": 0,
    "5m.rate": 0,
    "75%": 0,
    "95%": 0,
    "99%": 0,
    "99.9%": 0,
    "count": 0,
    "max": 0,
    "mean": 0,
    "mean.rate": 0,
    "median": 0,
    "min": 0,
    "stddev": 0
  },
  "ingester.ingest_ledger": {
    "15m.rate": 0.19938341023530404,
    "1m.rate": 0.19999701234910322,
    "5m.rate": 0.1995375686820368,
    "75%": 4269214,
    "95%": 108334280.2,
    "99%": 127591193.57000005,
    "99.9%": 185115016.58600014,
    "count": 14554,
    "max": 186210682,
    "mean": 13162584.692607004,
    "mean.rate": 0.19725951740668984,
    "median": 344771,
    "min": 15636,
    "stddev": 32661253.395383343
  },
  "logging.debug": {
    "15m.rate": 0,
    "1m.rate": 0,
    "5m.rate": 0,
    "count": 0,
    "mean.rate": 0
  },
  "logging.error": {
    "15m.rate": 0,
    "1m.rate": 0,
    "5m.rate": 0,
    "count": 0,
    "mean.rate": 0
  },
  "logging.info": {
    "15m.rate": 232.85916859415772,
    "1m.rate": 242.7785273104503,
    "5m.rate": 237.74161591995696,
    "count": 133049195,
    "mean.rate": 227.30356525388274
  },
  "logging.panic": {
    "15m.rate": 0,
    "1m.rate": 0,
    "5m.rate": 0,
    "count": 0,
    "mean.rate": 0
  },
  "logging.warning": {
    "15m.rate": 0.00002864686194423444,
    "1m.rate": 4.5629799451093754e-41,
    "5m.rate": 3.714334583072108e-10,
    "count": 6995,
    "mean.rate": 0.011950421578867764
  },
  "requests.failed": {
    "15m.rate": 46.27434280564861,
    "1m.rate": 48.559342299629265,
    "5m.rate": 47.132925275045295,
    "count": 26002133,
    "mean.rate": 44.42250383043155
  },
  "requests.succeeded": {
    "15m.rate": 69.36681910982539,
    "1m.rate": 72.38504433912904,
    "5m.rate": 71.00293298710338,
    "count": 39985482,
    "mean.rate": 68.31190342961553
  },
  "requests.total": {
    "15m.rate": 115.64116191547402,
    "1m.rate": 120.94438663875829,
    "5m.rate": 118.13585826214866,
    "75%": 4628801.75,
    "95%": 55000011530.4,
    "99%": 55004856745.49,
    "99.9%": 55023166974.193,
    "count": 65987615,
    "max": 55023405838,
    "mean": 3513634813.836576,
    "mean.rate": 112.73440653824905,
    "median": 1937564.5,
    "min": 20411,
    "stddev": 13264750988.737148
  },
  "stellar_core.latest_ledger": {
    "value": 22826156
  },
  "stellar_core.open_connections": {
    "value": 94
  },
  "txsub.buffered": {
    "value": 1
  },
  "txsub.failed": {
    "15m.rate": 0.02479237361888591,
    "1m.rate": 0.03262394685483348,
    "5m.rate": 0.026600772194616953,
    "count": 13977,
    "mean.rate": 0.02387863835950965
  },
  "txsub.open": {
    "value": 0
  },
  "txsub.succeeded": {
    "15m.rate": 0.3684477520175787,
    "1m.rate": 0.3620036969560598,
    "5m.rate": 0.3669857018510689,
    "count": 253242,
    "mean.rate": 0.43264464015537746
  },
  "txsub.total": {
    "15m.rate": 0.3932401256364647,
    "1m.rate": 0.3946276438108932,
    "5m.rate": 0.3935864740456858,
    "75%": 30483683.25,
    "95%": 88524119.3999999,
    "99%": 320773244.6300014,
    "99.9%": 1582447912.6680026,
    "count": 267219,
    "max": 1602906917,
    "mean": 34469463.39785992,
    "mean.rate": 0.45652327851684915,
    "median": 18950996.5,
    "min": 3156355,
    "stddev": 79193338.90936844
  }
}`

var feesResponse = `{
  "last_ledger": "22606298",
  "last_ledger_base_fee": "100",
  "ledger_capacity_usage": "0.97",
  "min_accepted_fee": "130",
  "mode_accepted_fee": "250",
  "p10_accepted_fee": "150",
  "p20_accepted_fee": "200",
  "p30_accepted_fee": "300",
  "p40_accepted_fee": "400",
  "p50_accepted_fee": "500",
  "p60_accepted_fee": "1000",
  "p70_accepted_fee": "2000",
  "p80_accepted_fee": "3000",
  "p90_accepted_fee": "4000",
  "p95_accepted_fee": "5000",
  "p99_accepted_fee": "8000"
}`

var offersResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/accounts/GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F/offers?cursor=&limit=10&order=asc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/accounts/GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F/offers?cursor=432323&limit=10&order=asc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/accounts/GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F/offers?cursor=432323&limit=10&order=desc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/offers/432323"
          },
          "offer_maker": {
            "href": "https://horizon-testnet.stellar.org/accounts/GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F"
          }
        },
        "id": 432323,
        "paging_token": "432323",
        "seller": "GDOJCPYIB66RY4XNDLRRHQQXB27YLNNAGAYV5HMHEYNYY4KUNV5FDV2F",
        "selling": {
          "asset_type": "credit_alphanum4",
          "asset_code": "ABC",
          "asset_issuer": "GDP6QEA4A5CRNGUIGYHHFETDPNEESIZFW53RVISXGSALI7KXNUC4YBWD"
        },
        "buying": {
          "asset_type": "native"
        },
        "amount": "1999979.8700000",
        "price_r": {
          "n": 100,
          "d": 1
        },
        "price": "100.0000000",
        "last_modified_ledger": 103307,
        "last_modified_time": "2019-03-05T13:23:50Z"
      }
    ]
  }
}`

var multipleOpsResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53/operations?cursor=&limit=10&order=asc"
    },
    "next": {
      "href": "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53/operations?cursor=98447788659970049&limit=10&order=asc"
    },
    "prev": {
      "href": "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53/operations?cursor=98447788659970049&limit=10&order=desc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "self": {
            "href": "https://horizon.stellar.org/operations/98447788659970049"
          },
          "transaction": {
            "href": "https://horizon.stellar.org/transactions/b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53"
          },
          "effects": {
            "href": "https://horizon.stellar.org/operations/98447788659970049/effects"
          },
          "succeeds": {
            "href": "https://horizon.stellar.org/effects?order=desc&cursor=98447788659970049"
          },
          "precedes": {
            "href": "https://horizon.stellar.org/effects?order=asc&cursor=98447788659970049"
          }
        },
        "id": "98447788659970049",
        "paging_token": "98447788659970049",
        "transaction_successful": true,
        "source_account": "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
        "type": "payment",
        "type_i": 1,
        "created_at": "2019-03-14T09:44:26Z",
        "transaction_hash": "b63307ef92bb253df13361a72095156d19fc0713798bc2e6c3bd9ee63cc3ca53",
        "asset_type": "credit_alphanum4",
        "asset_code": "DRA",
        "asset_issuer": "GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53",
        "from": "GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM",
        "to": "GDTCW47BX2ELQ76KAZIA5Z6V4IEHUUD44ABJ66JTRZRMINEJY3OUCNEO",
        "amount": "1.1200000"
      },
      {
        "_links": {
          "self": {
            "href": "https://horizon.stellar.org/operations/98448467264811009"
          },
          "transaction": {
            "href": "https://horizon.stellar.org/transactions/af68055329e570bf461f384e2cd40db023be32f1c38a756ba2db08b6baf66148"
          },
          "effects": {
            "href": "https://horizon.stellar.org/operations/98448467264811009/effects"
          },
          "succeeds": {
            "href": "https://horizon.stellar.org/effects?order=desc&cursor=98448467264811009"
          },
          "precedes": {
            "href": "https://horizon.stellar.org/effects?order=asc&cursor=98448467264811009"
          }
        },
        "id": "98448467264811009",
        "paging_token": "98448467264811009",
        "transaction_successful": true,
        "source_account": "GDD7ABRF7BCK76W33RXDQG5Q3WXVSQYVLGEMXSOWRGZ6Z3G3M2EM2TCP",
        "type": "manage_offer",
        "type_i": 3,
        "created_at": "2019-03-14T09:58:33Z",
        "transaction_hash": "af68055329e570bf461f384e2cd40db023be32f1c38a756ba2db08b6baf66148",
        "amount": "7775.0657728",
        "price": "3.0058511",
        "price_r": {
          "n": 30058511,
          "d": 10000000
        },
        "buying_asset_type": "native",
        "selling_asset_type": "credit_alphanum4",
        "selling_asset_code": "XRP",
        "selling_asset_issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5",
        "offer_id": 73938565
      },  
      {
        "_links": {
          "self": {
            "href": "http://horizon-mon.stellar-ops.com/operations/98455906148208641"
          },
          "transaction": {
            "href": "http://horizon-mon.stellar-ops.com/transactions/ade3c60f1b581e8744596673d95bffbdb8f68f199e0e2f7d63b7c3af9fd8d868"
          },
          "effects": {
            "href": "http://horizon-mon.stellar-ops.com/operations/98455906148208641/effects"
          },
          "succeeds": {
            "href": "http://horizon-mon.stellar-ops.com/effects?order=desc\u0026cursor=98455906148208641"
          },
          "precedes": {
            "href": "http://horizon-mon.stellar-ops.com/effects?order=asc\u0026cursor=98455906148208641"
          }
        },
        "id": "98455906148208641",
        "paging_token": "98455906148208641",
        "transaction_successful": true,
        "source_account": "GD7C4MQJDM3AHXKO2Z2OF7BK3FYL6QMNBGVEO4H2DHM65B7JMHD2IU2E",
        "type": "create_account",
        "type_i": 0,
        "created_at": "2019-03-14T12:30:40Z",
        "transaction_hash": "ade3c60f1b581e8744596673d95bffbdb8f68f199e0e2f7d63b7c3af9fd8d868",
        "starting_balance": "2.0000000",
        "funder": "GD7C4MQJDM3AHXKO2Z2OF7BK3FYL6QMNBGVEO4H2DHM65B7JMHD2IU2E",
        "account": "GD6LCN37TNJZW3JF2R7N5EYGQGVWRPMSGQHR6RZD4X4NATEQLP7RFAMA"
      }          
    ]
  }
}`

var opsResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/operations/1103965508866049"
    },
    "transaction": {
      "href": "https://horizon-testnet.stellar.org/transactions/93c2755ec61c8b01ac11daa4d8d7a012f56be172bdfcaf77a6efd683319ca96d"
    },
    "effects": {
      "href": "https://horizon-testnet.stellar.org/operations/1103965508866049/effects"
    },
    "succeeds": {
      "href": "https://horizon-testnet.stellar.org/effects?order=desc\u0026cursor=1103965508866049"
    },
    "precedes": {
      "href": "https://horizon-testnet.stellar.org/effects?order=asc\u0026cursor=1103965508866049"
    }
  },
  "id": "1103965508866049",
  "paging_token": "1103965508866049",
  "transaction_successful": true,
  "source_account": "GBMVGXJXJ7ZBHIWMXHKR6IVPDTYKHJPXC2DHZDPJBEZWZYAC7NKII7IB",
  "type": "change_trust",
  "type_i": 6,
  "created_at": "2019-03-14T15:58:57Z",
  "transaction_hash": "93c2755ec61c8b01ac11daa4d8d7a012f56be172bdfcaf77a6efd683319ca96d",
  "asset_type": "credit_alphanum4",
  "asset_code": "UAHd",
  "asset_issuer": "GDDETPGV4OJVNBTB6GQICCPGH5DZRYYB7XQCSAZO2ZQH6HO7SWXHKKJN",
  "limit": "922337203685.4775807",
  "trustee": "GDDETPGV4OJVNBTB6GQICCPGH5DZRYYB7XQCSAZO2ZQH6HO7SWXHKKJN",
  "trustor": "GBMVGXJXJ7ZBHIWMXHKR6IVPDTYKHJPXC2DHZDPJBEZWZYAC7NKII7IB"
}`

var txSuccess = `{
    "_links": {
        "transaction": {
            "href": "https://horizon-testnet.stellar.org/transactions/bcc7a97264dca0a51a63f7ea971b5e7458e334489673078bb2a34eb0cce910ca"
        }
    },
    "hash": "bcc7a97264dca0a51a63f7ea971b5e7458e334489673078bb2a34eb0cce910ca",
    "ledger": 354811,
    "envelope_xdr": "AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0AAuV/AAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAyTBGxOgfSApppsTnb/YRr6gOR8WT0LZNrhLh4y3FCgoAAAAXSHboAAAAAAAAAAABhlbgnAAAAEAivKe977CQCxMOKTuj+cWTFqc2OOJU8qGr9afrgu2zDmQaX5Q0cNshc3PiBwe0qw/+D/qJk5QqM5dYeSUGeDQP",
    "result_xdr": "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA=",
    "result_meta_xdr": "AAAAAQAAAAIAAAADAAVp+wAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwACBP/TuycHAAABD0AAuV+AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAVp+wAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwACBP/TuycHAAABD0AAuV/AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAMABWn7AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAIE/9O7JwcAAAEPQAC5X8AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABWn7AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAIE+gGdbQcAAAEPQAC5X8AAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAABWn7AAAAAAAAAADJMEbE6B9ICmmmxOdv9hGvqA5HxZPQtk2uEuHjLcUKCgAAABdIdugAAAVp+wAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA=="
}`

var transactionFailure = `{
  "type": "https://stellar.org/horizon-errors/transaction_failed",
  "title": "Transaction Failed",
  "status": 400,
  "detail": "The transaction failed when submitted to the stellar network. The extras.result_codes field on this response contains further details.  Descriptions of each code can be found at: https://www.stellar.org/developers/learn/concepts/list-of-operations.html",
  "instance": "horizon-testnet-001.prd.stellar001.internal.stellar-ops.com/4elYz2fHhC-528285",
  "extras": {
    "envelope_xdr": "AAAAAKpmDL6Z4hvZmkTBkYpHftan4ogzTaO4XTB7joLgQnYYAAAAZAAAAAAABeoyAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAD3sEVVGZGi/NoC3ta/8f/YZKMzyi9ZJpOi0H47x7IqYAAAAAAAAAAAF9eEAAAAAAAAAAAA=",
    "result_codes": {
      "transaction": "tx_no_source_account"
    },
    "result_xdr": "AAAAAAAAAAD////4AAAAAA=="
  }
}`

var txPageResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=&limit=10&order=desc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1881762611335168&limit=10&order=desc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/transactions?cursor=1881771201286144&limit=10&order=asc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/transactions/3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599"
          },
          "account": {
            "href": "https://horizon-testnet.stellar.org/accounts/GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"
          },
          "ledger": {
            "href": "https://horizon-testnet.stellar.org/ledgers/438134"
          },
          "operations": {
            "href": "https://horizon-testnet.stellar.org/transactions/3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599/operations{?cursor,limit,order}",
            "templated": true
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/transactions/3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599/effects{?cursor,limit,order}",
            "templated": true
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=asc&cursor=1881771201286144"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=desc&cursor=1881771201286144"
          }
        },
        "id": "3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599",
        "paging_token": "1881771201286144",
        "successful": true,
        "hash": "3274f131af56ecb6d8668acf6eb0b31b5f8faeca785cbce0a911a5a81308a599",
        "ledger": 438134,
        "created_at": "2019-03-25T10:27:53Z",
        "source_account": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR",
        "source_account_sequence": "4660039787356",
        "fee_paid": 100,
        "operation_count": 1,
        "envelope_xdr": "AAAAABB90WssODNIgi6BHveqzxTRmIpvAFRyVNM+Hm2GVuCcAAAAZAAABD0ABCNcAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAzvbakxhsAWYE0gRDf2pfXaYUCnH8vEwyQiNOJYLmNRIAAAAXSHboAAAAAAAAAAABhlbgnAAAAEBw2qecm0C4q7xi8+43NjuExfspCtA1ki2Jq2lWuNSLArJ0qcOhz/HnszFppaCBHkFf/37557MbF4NbFZXlVv4P",
        "result_xdr": "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA=",
        "result_meta_xdr": "AAAAAQAAAAIAAAADAAavdgAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwAHtF2q1bgcAAABD0ABCNbAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAavdgAAAAAAAAAAEH3Rayw4M0iCLoEe96rPFNGYim8AVHJU0z4ebYZW4JwAHtF2q1bgcAAABD0ABCNcAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAMABq92AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAe0XarVuBwAAAEPQAEI1wAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAe0V9i3/hwAAAEPQAEI1wAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAABq92AAAAAAAAAADO9tqTGGwBZgTSBEN/al9dphQKcfy8TDJCI04lguY1EgAAABdIdugAAAavdgAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "fee_meta_xdr": "AAAAAgAAAAMABq92AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAe0Y3zzcjUAAAEPQAEI1oAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAAAQfdFrLDgzSIIugR73qs8U0ZiKbwBUclTTPh5thlbgnAAe0Y3zzchwAAAEPQAEI1oAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "memo_type": "none",
        "signatures": [
          "cNqnnJtAuKu8YvPuNzY7hMX7KQrQNZItiatpVrjUiwKydKnDoc/x57MxaaWggR5BX/9++eezGxeDWxWV5Vb+Dw=="
        ]
      },
      {
        "memo": "2A1V6J5703G47XHY",
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c"
          },
          "account": {
            "href": "https://horizon-testnet.stellar.org/accounts/GC3IMK2BSHNZZ4WAC3AXQYA7HQTZKUUDJ7UYSA2HTNCIX5S5A5NVD3FD"
          },
          "ledger": {
            "href": "https://horizon-testnet.stellar.org/ledgers/438134"
          },
          "operations": {
            "href": "https://horizon-testnet.stellar.org/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c/operations{?cursor,limit,order}",
            "templated": true
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c/effects{?cursor,limit,order}",
            "templated": true
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=asc&cursor=1881771201282048"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/transactions?order=desc&cursor=1881771201282048"
          }
        },
        "id": "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c",
        "paging_token": "1881771201282048",
        "successful": true,
        "hash": "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c",
        "ledger": 438134,
        "created_at": "2019-03-25T10:27:53Z",
        "source_account": "GC3IMK2BSHNZZ4WAC3AXQYA7HQTZKUUDJ7UYSA2HTNCIX5S5A5NVD3FD",
        "source_account_sequence": "1881766906298369",
        "fee_paid": 100,
        "operation_count": 1,
        "envelope_xdr": "AAAAALaGK0GR25zywBbBeGAfPCeVUoNP6YkDR5tEi/ZdB1tRAAAAZAAGr3UAAAABAAAAAAAAAAEAAAAQMkExVjZKNTcwM0c0N1hIWQAAAAEAAAABAAAAALaGK0GR25zywBbBeGAfPCeVUoNP6YkDR5tEi/ZdB1tRAAAAAQAAAADMSEvcRKXsaUNna++Hy7gWm/CfqTjEA7xoGypfrFGUHAAAAAAAAAACBo93AAAAAAAAAAABXQdbUQAAAECQ5m6ZHsv8/Gd/aRJ2EMLurJMxFynT7KbD51T7gD91Gqp/fzsRHilSGoVSw5ztmtJb2LP7o3bQbiZynQiJPl8C",
        "result_xdr": "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=",
        "result_meta_xdr": "AAAAAQAAAAIAAAADAAavdgAAAAAAAAAAtoYrQZHbnPLAFsF4YB88J5VSg0/piQNHm0SL9l0HW1EAAAAXSHbnnAAGr3UAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAavdgAAAAAAAAAAtoYrQZHbnPLAFsF4YB88J5VSg0/piQNHm0SL9l0HW1EAAAAXSHbnnAAGr3UAAAABAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAABAAAAAMABq9zAAAAAAAAAADMSEvcRKXsaUNna++Hy7gWm/CfqTjEA7xoGypfrFGUHAAAAAUQ/z+cAABeBgAASuQAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAADMSEvcRKXsaUNna++Hy7gWm/CfqTjEA7xoGypfrFGUHAAAAAcXjracAABeBgAASuQAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAMABq92AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABdIduecAAavdQAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABVB53CcAAavdQAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "fee_meta_xdr": "AAAAAgAAAAMABq91AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABdIdugAAAavdQAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABdIduecAAavdQAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
        "memo_type": "text",
        "signatures": [
          "kOZumR7L/Pxnf2kSdhDC7qyTMRcp0+ymw+dU+4A/dRqqf387ER4pUhqFUsOc7ZrSW9iz+6N20G4mcp0IiT5fAg=="
        ]
			}
		]
	}
}`

var txDetailResponse = `{
  "memo": "2A1V6J5703G47XHY",
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c"
    },
    "account": {
      "href": "https://horizon-testnet.stellar.org/accounts/GC3IMK2BSHNZZ4WAC3AXQYA7HQTZKUUDJ7UYSA2HTNCIX5S5A5NVD3FD"
    },
    "ledger": {
      "href": "https://horizon-testnet.stellar.org/ledgers/438134"
    },
    "operations": {
      "href": "https://horizon-testnet.stellar.org/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c/operations{?cursor,limit,order}",
      "templated": true
    },
    "effects": {
      "href": "https://horizon-testnet.stellar.org/transactions/5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c/effects{?cursor,limit,order}",
      "templated": true
    },
    "precedes": {
      "href": "https://horizon-testnet.stellar.org/transactions?order=asc&cursor=1881771201282048"
    },
    "succeeds": {
      "href": "https://horizon-testnet.stellar.org/transactions?order=desc&cursor=1881771201282048"
    }
  },
  "id": "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c",
  "paging_token": "1881771201282048",
  "successful": true,
  "hash": "5131aed266a639a6eb4802a92fba310454e711ded830ed899745b9e777d7110c",
  "ledger": 438134,
  "created_at": "2019-03-25T10:27:53Z",
  "source_account": "GC3IMK2BSHNZZ4WAC3AXQYA7HQTZKUUDJ7UYSA2HTNCIX5S5A5NVD3FD",
  "source_account_sequence": "1881766906298369",
  "fee_paid": 100,
  "operation_count": 1,
  "envelope_xdr": "AAAAALaGK0GR25zywBbBeGAfPCeVUoNP6YkDR5tEi/ZdB1tRAAAAZAAGr3UAAAABAAAAAAAAAAEAAAAQMkExVjZKNTcwM0c0N1hIWQAAAAEAAAABAAAAALaGK0GR25zywBbBeGAfPCeVUoNP6YkDR5tEi/ZdB1tRAAAAAQAAAADMSEvcRKXsaUNna++Hy7gWm/CfqTjEA7xoGypfrFGUHAAAAAAAAAACBo93AAAAAAAAAAABXQdbUQAAAECQ5m6ZHsv8/Gd/aRJ2EMLurJMxFynT7KbD51T7gD91Gqp/fzsRHilSGoVSw5ztmtJb2LP7o3bQbiZynQiJPl8C",
  "result_xdr": "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=",
  "result_meta_xdr": "AAAAAQAAAAIAAAADAAavdgAAAAAAAAAAtoYrQZHbnPLAFsF4YB88J5VSg0/piQNHm0SL9l0HW1EAAAAXSHbnnAAGr3UAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAavdgAAAAAAAAAAtoYrQZHbnPLAFsF4YB88J5VSg0/piQNHm0SL9l0HW1EAAAAXSHbnnAAGr3UAAAABAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAABAAAABAAAAAMABq9zAAAAAAAAAADMSEvcRKXsaUNna++Hy7gWm/CfqTjEA7xoGypfrFGUHAAAAAUQ/z+cAABeBgAASuQAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAADMSEvcRKXsaUNna++Hy7gWm/CfqTjEA7xoGypfrFGUHAAAAAcXjracAABeBgAASuQAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAMABq92AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABdIduecAAavdQAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABVB53CcAAavdQAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
  "fee_meta_xdr": "AAAAAgAAAAMABq91AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABdIdugAAAavdQAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEABq92AAAAAAAAAAC2hitBkduc8sAWwXhgHzwnlVKDT+mJA0ebRIv2XQdbUQAAABdIduecAAavdQAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA==",
  "memo_type": "text",
  "signatures": [
    "kOZumR7L/Pxnf2kSdhDC7qyTMRcp0+ymw+dU+4A/dRqqf387ER4pUhqFUsOc7ZrSW9iz+6N20G4mcp0IiT5fAg=="
  ]
}`

var orderbookResponse = `{
  "bids": [
    {
      "price_r": {
        "n": 48904,
        "d": 1949839975
      },
      "price": "0.0000251",
      "amount": "0.0841405"
    },
    {
      "price_r": {
        "n": 273,
        "d": 10917280
      },
      "price": "0.0000250",
      "amount": "0.0005749"
    }
  ],
  "asks": [
    {
      "price_r": {
        "n": 2,
        "d": 78125
      },
      "price": "0.0000256",
      "amount": "3354.7460938"
    },
    {
      "price_r": {
        "n": 10178,
        "d": 394234000
      },
      "price": "0.0000258",
      "amount": "1.7314070"
    }
  ],
  "base": {
    "asset_type": "native"
  },
  "counter": {
    "asset_type": "credit_alphanum4",
    "asset_code": "BTC",
    "asset_issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5"
  }
}`

var orderBookNotFound = `{
  "type": "https://stellar.org/horizon-errors/invalid_order_book",
  "title": "Invalid Order Book Parameters",
  "status": 400,
  "detail": "The parameters that specify what order book to view are invalid in some way. Please ensure that your type parameters (selling_asset_type and buying_asset_type) are one the following valid values: native, credit_alphanum4, credit_alphanum12.  Also ensure that you have specified selling_asset_code and selling_asset_issuer if selling_asset_type is not 'native', as well as buying_asset_code and buying_asset_issuer if buying_asset_type is not 'native'"
}`

var paymentsResponse = `{
  "_links": {
    "self": {
      "href": "https://horizon-testnet.stellar.org/payments?cursor=&limit=2&order=desc"
    },
    "next": {
      "href": "https://horizon-testnet.stellar.org/payments?cursor=2024660468248577&limit=2&order=desc"
    },
    "prev": {
      "href": "https://horizon-testnet.stellar.org/payments?cursor=2024660468256769&limit=2&order=asc"
    }
  },
  "_embedded": {
    "records": [
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/operations/2024660468256769"
          },
          "transaction": {
            "href": "https://horizon-testnet.stellar.org/transactions/a0207513c372146bae8cdb299975047216cb1ffb393074b2015b39496e8767c2"
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/operations/2024660468256769/effects"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=2024660468256769"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=2024660468256769"
          }
        },
        "id": "2024660468256769",
        "paging_token": "2024660468256769",
        "transaction_successful": true,
        "source_account": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR",
        "type": "create_account",
        "type_i": 0,
        "created_at": "2019-03-27T09:55:41Z",
        "transaction_hash": "a0207513c372146bae8cdb299975047216cb1ffb393074b2015b39496e8767c2",
        "starting_balance": "10000.0000000",
        "funder": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR",
        "account": "GB4OHVQE7OZH4HLCHFNR7OHDMZVNKOJT3RCRAXRNGGCNUHFRVGUGKW36"
      },
      {
        "_links": {
          "self": {
            "href": "https://horizon-testnet.stellar.org/operations/2024660468248577"
          },
          "transaction": {
            "href": "https://horizon-testnet.stellar.org/transactions/87d7a29539e7902b14a6c720094856f74a77128ab332d8629432c5a176a9fe7b"
          },
          "effects": {
            "href": "https://horizon-testnet.stellar.org/operations/2024660468248577/effects"
          },
          "succeeds": {
            "href": "https://horizon-testnet.stellar.org/effects?order=desc&cursor=2024660468248577"
          },
          "precedes": {
            "href": "https://horizon-testnet.stellar.org/effects?order=asc&cursor=2024660468248577"
          }
        },
        "id": "2024660468248577",
        "paging_token": "2024660468248577",
        "transaction_successful": true,
        "source_account": "GAL6CXEVI3Y4O4J3FIX3KCRF7HSUG5RW2IRQRUUFC6XHZOLNV3NU35TL",
        "type": "payment",
        "type_i": 1,
        "created_at": "2019-03-27T09:55:41Z",
        "transaction_hash": "87d7a29539e7902b14a6c720094856f74a77128ab332d8629432c5a176a9fe7b",
        "asset_type": "native",
        "from": "GAL6CXEVI3Y4O4J3FIX3KCRF7HSUG5RW2IRQRUUFC6XHZOLNV3NU35TL",
        "to": "GDGEQS64ISS6Y2KDM5V67B6LXALJX4E7VE4MIA54NANSUX5MKGKBZM5G",
        "amount": "177.0000000"
      }
    ]
  }
}`
