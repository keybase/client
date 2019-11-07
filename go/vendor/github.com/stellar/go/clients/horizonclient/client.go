package horizonclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/stellar/go/txnbuild"

	"github.com/manucorporat/sse"
	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/protocols/horizon/effects"
	"github.com/stellar/go/protocols/horizon/operations"
	"github.com/stellar/go/support/errors"
)

// sendRequest builds the URL for the given horizon request and sends the url to a horizon server
func (c *Client) sendRequest(hr HorizonRequest, resp interface{}) (err error) {
	endpoint, err := hr.BuildURL()
	if err != nil {
		return
	}

	c.HorizonURL = c.fixHorizonURL()
	_, ok := hr.(submitRequest)
	if ok {
		return c.sendRequestURL(c.HorizonURL+endpoint, "post", resp)
	}

	return c.sendRequestURL(c.HorizonURL+endpoint, "get", resp)
}

// sendRequestURL sends a url to a horizon server.
// It can be used for requests that do not implement the HorizonRequest interface.
func (c *Client) sendRequestURL(requestURL string, method string, a interface{}) (err error) {
	var req *http.Request

	if method == "post" || method == "POST" {
		req, err = http.NewRequest("POST", requestURL, nil)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded; param=value")
	} else {
		req, err = http.NewRequest("GET", requestURL, nil)
	}

	if err != nil {
		return errors.Wrap(err, "error creating HTTP request")
	}
	c.setClientAppHeaders(req)
	c.setDefaultClient()
	if c.horizonTimeOut == 0 {
		c.horizonTimeOut = HorizonTimeOut
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*c.horizonTimeOut)
	resp, err := c.HTTP.Do(req.WithContext(ctx))
	if err != nil {
		cancel()
		return
	}

	err = decodeResponse(resp, &a, c)
	cancel()
	return
}

// stream handles connections to endpoints that support streaming on a horizon server
func (c *Client) stream(
	ctx context.Context,
	streamURL string,
	handler func(data []byte) error,
) error {
	su, err := url.Parse(streamURL)
	if err != nil {
		return errors.Wrap(err, "error parsing stream url")
	}

	query := su.Query()
	if query.Get("cursor") == "" {
		query.Set("cursor", "now")
	}

	for {
		// updates the url with new cursor
		su.RawQuery = query.Encode()
		req, err := http.NewRequest("GET", su.String(), nil)
		if err != nil {
			return errors.Wrap(err, "error creating HTTP request")
		}
		req.Header.Set("Accept", "text/event-stream")
		c.setDefaultClient()
		c.setClientAppHeaders(req)

		// We can use c.HTTP here because we set Timeout per request not on the client. See sendRequest()
		resp, err := c.HTTP.Do(req)
		if err != nil {
			return errors.Wrap(err, "error sending HTTP request")
		}

		// Expected statusCode are 200-299
		if !(resp.StatusCode >= 200 && resp.StatusCode < 300) {
			return fmt.Errorf("got bad HTTP status code %d", resp.StatusCode)
		}
		defer resp.Body.Close()

		reader := bufio.NewReader(resp.Body)

		// Read events one by one. Break this loop when there is no more data to be
		// read from resp.Body (io.EOF).
	Events:
		for {
			// Read until empty line = event delimiter. The perfect solution would be to read
			// as many bytes as possible and forward them to sse.Decode. However this
			// requires much more complicated code.
			// We could also write our own `sse` package that works fine with streams directly
			// (github.com/manucorporat/sse is just using io/ioutils.ReadAll).
			var buffer bytes.Buffer
			nonEmptylinesRead := 0
			for {
				// Check if ctx is not cancelled
				select {
				case <-ctx.Done():
					return nil
				default:
					// Continue
				}

				line, err := reader.ReadString('\n')
				if err != nil {
					if err == io.EOF || err == io.ErrUnexpectedEOF {
						// We catch EOF errors to handle two possible situations:
						// - The last line before closing the stream was not empty. This should never
						//   happen in Horizon as it always sends an empty line after each event.
						// - The stream was closed by the server/proxy because the connection was idle.
						//
						// In the former case, that (again) should never happen in Horizon, we need to
						// check if there are any events we need to decode. We do this in the `if`
						// statement below just in case if Horizon behaviour changes in a future.
						//
						// From spec:
						// > Once the end of the file is reached, the user agent must dispatch the
						// > event one final time, as defined below.
						if nonEmptylinesRead == 0 {
							break Events
						}
					} else {
						return errors.Wrap(err, "error reading line")
					}
				}
				buffer.WriteString(line)

				if strings.TrimRight(line, "\n\r") == "" {
					break
				}

				nonEmptylinesRead++
			}

			events, err := sse.Decode(strings.NewReader(buffer.String()))
			if err != nil {
				return errors.Wrap(err, "error decoding event")
			}

			// Right now len(events) should always be 1. This loop will be helpful after writing
			// new SSE decoder that can handle io.Reader without using ioutils.ReadAll().
			for _, event := range events {
				if event.Event != "message" {
					continue
				}

				// Update cursor with event ID
				if event.Id != "" {
					query.Set("cursor", event.Id)
				}

				switch data := event.Data.(type) {
				case string:
					err = handler([]byte(data))
					err = errors.Wrap(err, "handler error")
				case []byte:
					err = handler(data)
					err = errors.Wrap(err, "handler error")
				default:
					err = errors.New("invalid event.Data type")
				}
				if err != nil {
					return err
				}
			}
		}
	}
}

func (c *Client) setClientAppHeaders(req *http.Request) {
	req.Header.Set("X-Client-Name", "go-stellar-sdk")
	req.Header.Set("X-Client-Version", c.Version())
	req.Header.Set("X-App-Name", c.AppName)
	req.Header.Set("X-App-Version", c.AppVersion)
}

// setDefaultClient sets the default HTTP client when none is provided.
func (c *Client) setDefaultClient() {
	if c.HTTP == nil {
		c.HTTP = http.DefaultClient
	}
}

// fixHorizonURL strips all slashes(/) at the end of HorizonURL if any, then adds a single slash
func (c *Client) fixHorizonURL() string {
	return strings.TrimRight(c.HorizonURL, "/") + "/"
}

// SetHorizonTimeOut allows users to set the number of seconds before a horizon request is cancelled.
func (c *Client) SetHorizonTimeOut(t uint) *Client {
	c.horizonTimeOut = time.Duration(t)
	return c
}

// HorizonTimeOut returns the current timeout for a horizon client
func (c *Client) HorizonTimeOut() time.Duration {
	return c.horizonTimeOut
}

// AccountDetail returns information for a single account.
// See https://www.stellar.org/developers/horizon/reference/endpoints/accounts-single.html
func (c *Client) AccountDetail(request AccountRequest) (account hProtocol.Account, err error) {
	if request.AccountID == "" {
		err = errors.New("no account ID provided")
	}

	if err != nil {
		return
	}

	err = c.sendRequest(request, &account)
	return
}

// AccountData returns a single data associated with a given account
// See https://www.stellar.org/developers/horizon/reference/endpoints/data-for-account.html
func (c *Client) AccountData(request AccountRequest) (accountData hProtocol.AccountData, err error) {
	if request.AccountID == "" || request.DataKey == "" {
		err = errors.New("too few parameters")
	}

	if err != nil {
		return
	}

	err = c.sendRequest(request, &accountData)
	return
}

// Effects returns effects(https://www.stellar.org/developers/horizon/reference/resources/effect.html)
// It can be used to return effects for an account, a ledger, an operation, a transaction and all effects on the network.
func (c *Client) Effects(request EffectRequest) (effects effects.EffectsPage, err error) {
	err = c.sendRequest(request, &effects)
	return
}

// Assets returns asset information.
// See https://www.stellar.org/developers/horizon/reference/endpoints/assets-all.html
func (c *Client) Assets(request AssetRequest) (assets hProtocol.AssetsPage, err error) {
	err = c.sendRequest(request, &assets)
	return
}

// Ledgers returns information about all ledgers.
// See https://www.stellar.org/developers/horizon/reference/endpoints/ledgers-all.html
func (c *Client) Ledgers(request LedgerRequest) (ledgers hProtocol.LedgersPage, err error) {
	err = c.sendRequest(request, &ledgers)
	return
}

// LedgerDetail returns information about a particular ledger for a given sequence number
// See https://www.stellar.org/developers/horizon/reference/endpoints/ledgers-single.html
func (c *Client) LedgerDetail(sequence uint32) (ledger hProtocol.Ledger, err error) {
	if sequence == 0 {
		err = errors.New("invalid sequence number provided")
	}

	if err != nil {
		return
	}

	request := LedgerRequest{forSequence: sequence}
	err = c.sendRequest(request, &ledger)
	return
}

// Metrics returns monitoring information about a horizon server
// See https://www.stellar.org/developers/horizon/reference/endpoints/metrics.html
func (c *Client) Metrics() (metrics hProtocol.Metrics, err error) {
	request := metricsRequest{endpoint: "metrics"}
	err = c.sendRequest(request, &metrics)
	return
}

// FeeStats returns information about fees in the last 5 ledgers.
// See https://www.stellar.org/developers/horizon/reference/endpoints/fee-stats.html
func (c *Client) FeeStats() (feestats hProtocol.FeeStats, err error) {
	request := feeStatsRequest{endpoint: "fee_stats"}
	err = c.sendRequest(request, &feestats)
	return
}

// Offers returns information about offers made on the SDEX.
// See https://www.stellar.org/developers/horizon/reference/endpoints/offers-for-account.html
func (c *Client) Offers(request OfferRequest) (offers hProtocol.OffersPage, err error) {
	err = c.sendRequest(request, &offers)
	return
}

// Operations returns stellar operations (https://www.stellar.org/developers/horizon/reference/resources/operation.html)
// It can be used to return operations for an account, a ledger, a transaction and all operations on the network.
func (c *Client) Operations(request OperationRequest) (ops operations.OperationsPage, err error) {
	err = c.sendRequest(request.SetOperationsEndpoint(), &ops)
	return
}

// OperationDetail returns a single stellar operations (https://www.stellar.org/developers/horizon/reference/resources/operation.html)
// for a given operation id
func (c *Client) OperationDetail(id string) (ops operations.Operation, err error) {
	if id == "" {
		return ops, errors.New("invalid operation id provided")
	}

	request := OperationRequest{forOperationID: id, endpoint: "operations"}

	var record interface{}

	err = c.sendRequest(request, &record)
	if err != nil {
		return ops, errors.Wrap(err, "sending request to horizon")
	}

	var baseRecord operations.Base
	dataString, err := json.Marshal(record)
	if err != nil {
		return ops, errors.Wrap(err, "marshaling json")
	}
	if err = json.Unmarshal(dataString, &baseRecord); err != nil {
		return ops, errors.Wrap(err, "unmarshaling json")
	}

	ops, err = operations.UnmarshalOperation(baseRecord.GetTypeI(), dataString)
	if err != nil {
		return ops, errors.Wrap(err, "unmarshaling to the correct operation type")
	}
	return ops, nil
}

// SubmitTransactionXDR submits a transaction represented as a base64 XDR string to the network. err can be either error object or horizon.Error object.
// See https://www.stellar.org/developers/horizon/reference/endpoints/transactions-create.html
func (c *Client) SubmitTransactionXDR(transactionXdr string) (txSuccess hProtocol.TransactionSuccess,
	err error) {
	request := submitRequest{endpoint: "transactions", transactionXdr: transactionXdr}
	err = c.sendRequest(request, &txSuccess)
	return
}

// SubmitTransaction submits a transaction to the network. err can be either error object or horizon.Error object.
// See https://www.stellar.org/developers/horizon/reference/endpoints/transactions-create.html
func (c *Client) SubmitTransaction(transaction txnbuild.Transaction) (txSuccess hProtocol.TransactionSuccess,
	err error) {
	txeBase64, err := transaction.Base64()
	if err != nil {
		err = errors.Wrap(err, "Unable to convert transaction object to base64 string")
		return
	}

	return c.SubmitTransactionXDR(txeBase64)
}

// Transactions returns stellar transactions (https://www.stellar.org/developers/horizon/reference/resources/transaction.html)
// It can be used to return transactions for an account, a ledger,and all transactions on the network.
func (c *Client) Transactions(request TransactionRequest) (txs hProtocol.TransactionsPage, err error) {
	err = c.sendRequest(request, &txs)
	return
}

// TransactionDetail returns information about a particular transaction for a given transaction hash
// See https://www.stellar.org/developers/horizon/reference/endpoints/transactions-single.html
func (c *Client) TransactionDetail(txHash string) (tx hProtocol.Transaction, err error) {
	if txHash == "" {
		return tx, errors.New("no transaction hash provided")
	}

	request := TransactionRequest{forTransactionHash: txHash}
	err = c.sendRequest(request, &tx)
	return
}

// OrderBook returns the orderbook for an asset pair (https://www.stellar.org/developers/horizon/reference/resources/orderbook.html)
func (c *Client) OrderBook(request OrderBookRequest) (obs hProtocol.OrderBookSummary, err error) {
	err = c.sendRequest(request, &obs)
	return
}

// Paths returns the available paths to make a payment. See https://www.stellar.org/developers/horizon/reference/endpoints/path-finding.html
func (c *Client) Paths(request PathsRequest) (paths hProtocol.PathsPage, err error) {
	err = c.sendRequest(request, &paths)
	return
}

// Payments returns stellar account_merge, create_account, path payment and payment operations.
// It can be used to return payments for an account, a ledger, a transaction and all payments on the network.
func (c *Client) Payments(request OperationRequest) (ops operations.OperationsPage, err error) {
	err = c.sendRequest(request.SetPaymentsEndpoint(), &ops)
	return
}

// Trades returns stellar trades (https://www.stellar.org/developers/horizon/reference/resources/trade.html)
// It can be used to return trades for an account, an offer and all trades on the network.
func (c *Client) Trades(request TradeRequest) (tds hProtocol.TradesPage, err error) {
	err = c.sendRequest(request, &tds)
	return
}

// Fund creates a new account funded from friendbot. It only works on test networks. See
// https://www.stellar.org/developers/guides/get-started/create-account.html for more information.
func (c *Client) Fund(addr string) (txSuccess hProtocol.TransactionSuccess, err error) {
	if !c.isTestNet {
		return txSuccess, errors.New("can't fund account from friendbot on production network")
	}
	friendbotURL := fmt.Sprintf("%sfriendbot?addr=%s", c.fixHorizonURL(), addr)
	err = c.sendRequestURL(friendbotURL, "get", &txSuccess)
	return
}

// StreamTrades streams executed trades. It can be used to stream all trades, trades for an account and
// trades for an offer. Use context.WithCancel to stop streaming or context.Background() if you want
// to stream indefinitely. TradeHandler is a user-supplied function that is executed for each streamed trade received.
func (c *Client) StreamTrades(ctx context.Context, request TradeRequest, handler TradeHandler) (err error) {
	err = request.StreamTrades(ctx, c, handler)
	return
}

// TradeAggregations returns stellar trade aggregations (https://www.stellar.org/developers/horizon/reference/resources/trade_aggregation.html)
func (c *Client) TradeAggregations(request TradeAggregationRequest) (tds hProtocol.TradeAggregationsPage, err error) {
	err = c.sendRequest(request, &tds)
	return
}

// StreamTransactions streams processed transactions. It can be used to stream all transactions and
// transactions for an account. Use context.WithCancel to stop streaming or context.Background()
// if you want to stream indefinitely. TransactionHandler is a user-supplied function that is executed for each streamed transaction received.
func (c *Client) StreamTransactions(ctx context.Context, request TransactionRequest, handler TransactionHandler) error {
	return request.StreamTransactions(ctx, c, handler)
}

// StreamEffects streams horizon effects. It can be used to stream all effects or account specific effects.
// Use context.WithCancel to stop streaming or context.Background() if you want to stream indefinitely.
// EffectHandler is a user-supplied function that is executed for each streamed transaction received.
func (c *Client) StreamEffects(ctx context.Context, request EffectRequest, handler EffectHandler) error {
	return request.StreamEffects(ctx, c, handler)
}

// StreamOperations streams stellar operations. It can be used to stream all operations or operations
// for an account. Use context.WithCancel to stop streaming or context.Background() if you want to
// stream indefinitely. OperationHandler is a user-supplied function that is executed for each streamed
//  operation received.
func (c *Client) StreamOperations(ctx context.Context, request OperationRequest, handler OperationHandler) error {
	return request.SetOperationsEndpoint().StreamOperations(ctx, c, handler)
}

// StreamPayments streams stellar payments. It can be used to stream all payments or payments
// for an account. Payments include create_account, payment, path_payment and account_merge operations.
// Use context.WithCancel to stop streaming or context.Background() if you want to
// stream indefinitely. OperationHandler is a user-supplied function that is executed for each streamed
//  operation received.
func (c *Client) StreamPayments(ctx context.Context, request OperationRequest, handler OperationHandler) error {
	return request.SetPaymentsEndpoint().StreamOperations(ctx, c, handler)
}

// StreamOffers streams offers processed by the Stellar network for an account. Use context.WithCancel
// to stop streaming or context.Background() if you want to stream indefinitely.
// OfferHandler is a user-supplied function that is executed for each streamed offer received.
func (c *Client) StreamOffers(ctx context.Context, request OfferRequest, handler OfferHandler) error {
	return request.StreamOffers(ctx, c, handler)
}

// StreamLedgers streams stellar ledgers. It can be used to stream all ledgers. Use context.WithCancel
// to stop streaming or context.Background() if you want to stream indefinitely.
// LedgerHandler is a user-supplied function that is executed for each streamed ledger received.
func (c *Client) StreamLedgers(ctx context.Context, request LedgerRequest, handler LedgerHandler) error {
	return request.StreamLedgers(ctx, c, handler)
}

// StreamOrderBooks streams the orderbook for a given asset pair. Use context.WithCancel
// to stop streaming or context.Background() if you want to stream indefinitely.
// OrderBookHandler is a user-supplied function that is executed for each streamed order received.
func (c *Client) StreamOrderBooks(ctx context.Context, request OrderBookRequest, handler OrderBookHandler) error {
	return request.StreamOrderBooks(ctx, c, handler)
}

// FetchTimebounds provides timebounds for N seconds from now using the server time of the horizon instance.
// It defaults to localtime when the server time is not available.
// Note that this will generate your timebounds when you init the transaction, not when you build or submit
// the transaction! So give yourself enough time to get the transaction built and signed before submitting.
func (c *Client) FetchTimebounds(seconds int64) (txnbuild.Timebounds, error) {
	serverURL, err := url.Parse(c.HorizonURL)
	if err != nil {
		return txnbuild.Timebounds{}, errors.Wrap(err, "unable to parse horizon url")
	}
	c.setDefaultCurrentUniversalTime()
	currentTime := currentServerTime(serverURL.Hostname(), c.currentUniversalTime())
	if currentTime != 0 {
		return txnbuild.NewTimebounds(0, currentTime+seconds), nil
	}

	// return a timebounds based on local time if no server time has been recorded
	// to do: query an endpoint to get the most current time. Implement this after we add retry logic to client.
	return txnbuild.NewTimeout(seconds), nil
}

// Root loads the root endpoint of horizon
func (c *Client) Root() (root hProtocol.Root, err error) {
	err = c.sendRequestURL(c.fixHorizonURL(), "get", &root)
	return
}

// Version returns the current version.
func (c *Client) Version() string {
	return version
}

// NextAssetsPage returns the next page of assets.
func (c *Client) NextAssetsPage(page hProtocol.AssetsPage) (assets hProtocol.AssetsPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &assets)
	return
}

// PrevAssetsPage returns the previous page of assets.
func (c *Client) PrevAssetsPage(page hProtocol.AssetsPage) (assets hProtocol.AssetsPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &assets)
	return
}

// NextLedgersPage returns the next page of ledgers.
func (c *Client) NextLedgersPage(page hProtocol.LedgersPage) (ledgers hProtocol.LedgersPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &ledgers)
	return
}

// PrevLedgersPage returns the previous page of ledgers.
func (c *Client) PrevLedgersPage(page hProtocol.LedgersPage) (ledgers hProtocol.LedgersPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &ledgers)
	return
}

// NextEffectsPage returns the next page of effects.
func (c *Client) NextEffectsPage(page effects.EffectsPage) (efp effects.EffectsPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &efp)
	return
}

// PrevEffectsPage returns the previous page of effects.
func (c *Client) PrevEffectsPage(page effects.EffectsPage) (efp effects.EffectsPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &efp)
	return
}

// NextTransactionsPage returns the next page of transactions.
func (c *Client) NextTransactionsPage(page hProtocol.TransactionsPage) (transactions hProtocol.TransactionsPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &transactions)
	return
}

// PrevTransactionsPage returns the previous page of transactions.
func (c *Client) PrevTransactionsPage(page hProtocol.TransactionsPage) (transactions hProtocol.TransactionsPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &transactions)
	return
}

// NextOperationsPage returns the next page of operations.
func (c *Client) NextOperationsPage(page operations.OperationsPage) (operations operations.OperationsPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &operations)
	return
}

// PrevOperationsPage returns the previous page of operations.
func (c *Client) PrevOperationsPage(page operations.OperationsPage) (operations operations.OperationsPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &operations)
	return
}

// NextPaymentsPage returns the next page of payments.
func (c *Client) NextPaymentsPage(page operations.OperationsPage) (operations.OperationsPage, error) {
	return c.NextOperationsPage(page)
}

// PrevPaymentsPage returns the previous page of payments.
func (c *Client) PrevPaymentsPage(page operations.OperationsPage) (operations.OperationsPage, error) {
	return c.PrevOperationsPage(page)
}

// NextOffersPage returns the next page of offers.
func (c *Client) NextOffersPage(page hProtocol.OffersPage) (offers hProtocol.OffersPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &offers)
	return
}

// PrevOffersPage returns the previous page of offers.
func (c *Client) PrevOffersPage(page hProtocol.OffersPage) (offers hProtocol.OffersPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &offers)
	return
}

// NextTradesPage returns the next page of trades.
func (c *Client) NextTradesPage(page hProtocol.TradesPage) (trades hProtocol.TradesPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &trades)
	return
}

// PrevTradesPage returns the previous page of trades.
func (c *Client) PrevTradesPage(page hProtocol.TradesPage) (trades hProtocol.TradesPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &trades)
	return
}

// HomeDomainForAccount returns the home domain for a single account.
func (c *Client) HomeDomainForAccount(aid string) (string, error) {
	if aid == "" {
		return "", errors.New("no account ID provided")
	}

	accountDetail, err := c.AccountDetail(AccountRequest{AccountID: aid})
	if err != nil {
		return "", errors.Wrap(err, "get account detail failed")
	}

	return accountDetail.HomeDomain, nil
}

// NextTradeAggregationsPage returns the next page of trade aggregations from the current
// trade aggregations response.
func (c *Client) NextTradeAggregationsPage(page hProtocol.TradeAggregationsPage) (ta hProtocol.TradeAggregationsPage, err error) {
	err = c.sendRequestURL(page.Links.Next.Href, "get", &ta)
	return
}

// PrevTradeAggregationsPage returns the previous page of trade aggregations from the current
// trade aggregations response.
func (c *Client) PrevTradeAggregationsPage(page hProtocol.TradeAggregationsPage) (ta hProtocol.TradeAggregationsPage, err error) {
	err = c.sendRequestURL(page.Links.Prev.Href, "get", &ta)
	return
}

// setDefaultCurrentUniversalTime sets the currentUniversalTime function for the horizon client if non has been
// provided to the default function that returns the current UTC time. This is needed when the client is
// initialised directly.
func (c *Client) setDefaultCurrentUniversalTime() {
	if c.currentUniversalTime == nil {
		c.SetCurrentUniversalTime(universalTimeFunc)
	}
}

// SetCurrentUniversalTime sets the currentUniversalTime function to the provided handler function. Users can
// use this method to set a custom handler function.
func (c *Client) SetCurrentUniversalTime(handler UniversalTimeHandler) {
	c.currentUniversalTime = handler
}

// ensure that the horizon client implements ClientInterface
var _ ClientInterface = &Client{}
