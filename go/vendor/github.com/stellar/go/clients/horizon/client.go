package horizon

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/manucorporat/sse"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// HomeDomainForAccount returns the home domain for the provided strkey-encoded
// account id.
func (c *Client) HomeDomainForAccount(aid string) (string, error) {
	a, err := c.LoadAccount(aid)
	if err != nil {
		return "", errors.Wrap(err, "load account failed")
	}
	return a.HomeDomain, nil
}

// fixURL removes trailing slash from Client.URL. This will prevent situation when
// http.Client does not follow redirects.
func (c *Client) fixURL() {
	c.URL = strings.TrimRight(c.URL, "/")
}

// Root loads the root endpoint of horizon
func (c *Client) Root() (root Root, err error) {
	c.fixURLOnce.Do(c.fixURL)
	resp, err := c.HTTP.Get(c.URL)
	if err != nil {
		return
	}

	err = decodeResponse(resp, &root)
	return
}

// LoadAccount loads the account state from horizon. err can be either error
// object or horizon.Error object.
func (c *Client) LoadAccount(accountID string) (account Account, err error) {
	c.fixURLOnce.Do(c.fixURL)
	resp, err := c.HTTP.Get(c.URL + "/accounts/" + accountID)
	if err != nil {
		return
	}

	err = decodeResponse(resp, &account)
	return
}

// LoadAccountOffers loads the account offers from horizon. err can be either
// error object or horizon.Error object.
func (c *Client) LoadAccountOffers(
	accountID string,
	params ...interface{},
) (offers OffersPage, err error) {
	c.fixURLOnce.Do(c.fixURL)
	endpoint := ""
	query := url.Values{}

	for _, param := range params {
		switch param := param.(type) {
		case At:
			endpoint = string(param)
		case Limit:
			query.Add("limit", strconv.Itoa(int(param)))
		case Order:
			query.Add("order", string(param))
		case Cursor:
			query.Add("cursor", string(param))
		default:
			err = fmt.Errorf("Undefined parameter (%T): %+v", param, param)
			return
		}
	}

	if endpoint == "" {
		endpoint = fmt.Sprintf(
			"%s/accounts/%s/offers?%s",
			c.URL,
			accountID,
			query.Encode(),
		)
	}

	// ensure our endpoint is a real url
	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
		return
	}

	resp, err := c.HTTP.Get(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to load endpoint")
		return
	}

	err = decodeResponse(resp, &offers)
	return
}

// LoadTradeAggregations loads the trade aggregation from horizon.
func (c *Client) LoadTradeAggregations(
	baseAsset Asset,
	counterAsset Asset,
	resolution int64,
	params ...interface{},
) (tradeAggrs TradeAggregationsPage, err error) {
	c.fixURLOnce.Do(c.fixURL)
	query := url.Values{}

	query.Add("base_asset_type", baseAsset.Type)
	query.Add("base_asset_code", baseAsset.Code)
	query.Add("base_asset_issuer", baseAsset.Issuer)

	query.Add("counter_asset_type", counterAsset.Type)
	query.Add("counter_asset_code", counterAsset.Code)
	query.Add("counter_asset_issuer", counterAsset.Issuer)

	query.Add("resolution", strconv.FormatInt(resolution, 10))

	for _, param := range params {
		switch param := param.(type) {
		case StartTime:
			query.Add("start_time", strconv.Itoa(int(param)))
		case EndTime:
			query.Add("end_time", strconv.Itoa(int(param)))
		case Limit:
			query.Add("limit", strconv.Itoa(int(param)))
		case Order:
			query.Add("order", string(param))
		default:
			err = fmt.Errorf("Undefined parameter (%T): %+v", param, param)
			return
		}
	}

	endpoint := fmt.Sprintf(
		"%s/trade_aggregations/?%s",
		c.URL,
		query.Encode(),
	)

	// ensure our endpoint is a real url
	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
		return
	}

	resp, err := c.HTTP.Get(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to load endpoint")
		return
	}

	err = decodeResponse(resp, &tradeAggrs)
	return
}

// LoadTrades loads the /trades endpoint from horizon.
func (c *Client) LoadTrades(
	baseAsset Asset,
	counterAsset Asset,
	offerID int64,
	resolution int64,
	params ...interface{},
) (tradesPage TradesPage, err error) {
	c.fixURLOnce.Do(c.fixURL)
	query := url.Values{}

	addAssetToQuery(query, "base", baseAsset)
	addAssetToQuery(query, "counter", counterAsset)

	query.Add("offer_id", strconv.FormatInt(offerID, 10))
	query.Add("resolution", strconv.FormatInt(resolution, 10))

	for _, param := range params {
		switch param := param.(type) {
		case Cursor:
			query.Add("cursor", string(param))
		case Limit:
			query.Add("limit", strconv.Itoa(int(param)))
		case Order:
			query.Add("order", string(param))
		default:
			err = fmt.Errorf("Undefined parameter (%T): %+v", param, param)
			return
		}
	}

	endpoint := fmt.Sprintf(
		"%s/trades/?%s",
		c.URL,
		query.Encode(),
	)

	// ensure our endpoint is a real url
	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
		return
	}

	resp, err := c.HTTP.Get(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to load endpoint")
		return
	}

	err = decodeResponse(resp, &tradesPage)
	return
}

// LoadTransaction loads a single transaction from Horizon server
func (c *Client) LoadTransaction(transactionID string) (transaction Transaction, err error) {
	c.fixURLOnce.Do(c.fixURL)
	resp, err := c.HTTP.Get(c.URL + "/transactions/" + transactionID)
	if err != nil {
		return
	}

	err = decodeResponse(resp, &transaction)
	return
}

func addAssetToQuery(v map[string][]string, assetPrefix string, asset Asset) {
	if asset.Type == "native" {
		v[assetPrefix+"_asset_type"] = []string{asset.Type}
	} else {
		v[assetPrefix+"_asset_type"] = []string{asset.Type}
		v[assetPrefix+"_asset_code"] = []string{asset.Code}
		v[assetPrefix+"_asset_issuer"] = []string{asset.Issuer}
	}
}

// LoadOperation loads a single operation from Horizon server
func (c *Client) LoadOperation(operationID string) (payment Payment, err error) {
	c.fixURLOnce.Do(c.fixURL)
	resp, err := c.HTTP.Get(c.URL + "/operations/" + operationID)
	if err != nil {
		return
	}

	err = decodeResponse(resp, &payment)
	return
}

// LoadMemo loads memo for a transaction in Payment
func (c *Client) LoadMemo(p *Payment) (err error) {
	res, err := c.HTTP.Get(p.Links.Transaction.Href)
	if err != nil {
		return errors.Wrap(err, "load transaction failed")
	}
	defer res.Body.Close()
	return json.NewDecoder(res.Body).Decode(&p.Memo)
}

// LoadAccountMergeAmount loads `account_merge` operation amount from it's effects
func (c *Client) LoadAccountMergeAmount(p *Payment) error {
	if p.Type != "account_merge" {
		return errors.New("Not `account_merge` operation")
	}

	res, err := c.HTTP.Get(p.Links.Effects.Href)
	if err != nil {
		return errors.Wrap(err, "Error getting effects for operation")
	}
	defer res.Body.Close()
	var page EffectsPage
	err = decodeResponse(res, &page)
	if err != nil {
		return errors.Wrap(err, "Error decoding effects page")
	}

	for _, effect := range page.Embedded.Records {
		if effect.Type == "account_credited" {
			p.Amount = effect.Amount
			return nil
		}
	}

	return errors.New("Could not find `account_credited` effect in `account_merge` operation effects")
}

// SequenceForAccount implements build.SequenceProvider
func (c *Client) SequenceForAccount(
	accountID string,
) (xdr.SequenceNumber, error) {

	a, err := c.LoadAccount(accountID)
	if err != nil {
		return 0, errors.Wrap(err, "load account failed")
	}

	seq, err := strconv.ParseUint(a.Sequence, 10, 64)
	if err != nil {
		return 0, errors.Wrap(err, "parse sequence failed")
	}

	return xdr.SequenceNumber(seq), nil
}

// LoadOrderBook loads order book for given selling and buying assets.
func (c *Client) LoadOrderBook(
	selling Asset,
	buying Asset,
	params ...interface{},
) (orderBook OrderBookSummary, err error) {
	c.fixURLOnce.Do(c.fixURL)
	query := url.Values{}

	query.Add("selling_asset_type", selling.Type)
	query.Add("selling_asset_code", selling.Code)
	query.Add("selling_asset_issuer", selling.Issuer)

	query.Add("buying_asset_type", buying.Type)
	query.Add("buying_asset_code", buying.Code)
	query.Add("buying_asset_issuer", buying.Issuer)

	for _, param := range params {
		switch param := param.(type) {
		case Limit:
			query.Add("limit", strconv.Itoa(int(param)))
		default:
			err = fmt.Errorf("Undefined parameter (%T): %+v", param, param)
			return
		}
	}

	resp, err := c.HTTP.Get(c.URL + "/order_book?" + query.Encode())
	if err != nil {
		return
	}

	err = decodeResponse(resp, &orderBook)
	return
}

func (c *Client) stream(
	ctx context.Context,
	baseURL string,
	cursor *Cursor,
	handler func(data []byte) error,
) error {
	query := url.Values{}
	if cursor != nil {
		query.Set("cursor", string(*cursor))
	}

	client := http.Client{}

	for {
		req, err := http.NewRequest("GET", fmt.Sprintf("%s?%s", baseURL, query.Encode()), nil)
		if err != nil {
			return errors.Wrap(err, "Error creating HTTP request")
		}
		req.Header.Set("Accept", "text/event-stream")

		// Make sure we don't use c.HTTP that can have Timeout set.
		resp, err := client.Do(req)
		if err != nil {
			return errors.Wrap(err, "Error sending HTTP request")
		}
		if resp.StatusCode/100 != 2 {
			return fmt.Errorf("Got bad HTTP status code %d", resp.StatusCode)
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
						return errors.Wrap(err, "Error reading line")
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
				return errors.Wrap(err, "Error decoding event")
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
					err = errors.Wrap(err, "Handler error")
				case []byte:
					err = handler(data)
					err = errors.Wrap(err, "Handler error")
				default:
					err = errors.New("Invalid event.Data type")
				}
				if err != nil {
					return err
				}
			}
		}
	}
}

// StreamLedgers streams incoming ledgers. Use context.WithCancel to stop streaming or
// context.Background() if you want to stream indefinitely.
func (c *Client) StreamLedgers(
	ctx context.Context,
	cursor *Cursor,
	handler LedgerHandler,
) (err error) {
	c.fixURLOnce.Do(c.fixURL)
	url := fmt.Sprintf("%s/ledgers", c.URL)
	return c.stream(ctx, url, cursor, func(data []byte) error {
		var ledger Ledger
		err = json.Unmarshal(data, &ledger)
		if err != nil {
			return errors.Wrap(err, "Error unmarshaling data")
		}
		handler(ledger)
		return nil
	})
}

// StreamPayments streams payments, for which the given `accountID` was either the sender or receiver.
// Use context.WithCancel to stop streaming or context.Background() if you want to stream indefinitely.
func (c *Client) StreamPayments(
	ctx context.Context,
	accountID string,
	cursor *Cursor,
	handler PaymentHandler,
) (err error) {
	c.fixURLOnce.Do(c.fixURL)
	url := fmt.Sprintf("%s/accounts/%s/payments", c.URL, accountID)
	return c.stream(ctx, url, cursor, func(data []byte) error {
		var payment Payment
		err = json.Unmarshal(data, &payment)
		if err != nil {
			return errors.Wrap(err, "Error unmarshaling data")
		}
		handler(payment)
		return nil
	})
}

// StreamTransactions streams incoming transactions. Use context.WithCancel to stop streaming or
// context.Background() if you want to stream indefinitely.
func (c *Client) StreamTransactions(
	ctx context.Context,
	accountID string,
	cursor *Cursor,
	handler TransactionHandler,
) (err error) {
	c.fixURLOnce.Do(c.fixURL)
	url := fmt.Sprintf("%s/accounts/%s/transactions", c.URL, accountID)
	return c.stream(ctx, url, cursor, func(data []byte) error {
		var transaction Transaction
		err = json.Unmarshal(data, &transaction)
		if err != nil {
			return errors.Wrap(err, "Error unmarshaling data")
		}
		handler(transaction)
		return nil
	})
}

// SubmitTransaction submits a transaction to the network. err can be either error object or horizon.Error object.
func (c *Client) SubmitTransaction(
	transactionEnvelopeXdr string,
) (response TransactionSuccess, err error) {
	c.fixURLOnce.Do(c.fixURL)
	v := url.Values{}
	v.Set("tx", transactionEnvelopeXdr)

	resp, err := c.HTTP.PostForm(c.URL+"/transactions", v)
	if err != nil {
		err = errors.Wrap(err, "http post failed")
		return
	}

	err = decodeResponse(resp, &response)
	if err != nil {
		return
	}

	// WARNING! Do not remove this code. If you include two trailing slashes (`//`) at the end of Client.URL
	// and developers changed Client.HTTP to not follow redirects, this will return empty response and no error!
	if resp.StatusCode != http.StatusOK {
		err = errors.New("Invalid response code")
		return
	}

	return
}
