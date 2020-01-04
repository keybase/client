package horizonclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	hProtocol "github.com/stellar/go/protocols/horizon"
	"github.com/stellar/go/support/errors"
)

// BuildURL creates the endpoint to be queried based on the data in the OfferRequest struct.
func (or OfferRequest) BuildURL() (endpoint string, err error) {
	if or.ForAccount == "" {
		return endpoint, errors.New(`parameter "ForAccount" required`)
	}
	endpoint = fmt.Sprintf("accounts/%s/offers", or.ForAccount)

	queryParams := addQueryParams(cursor(or.Cursor), limit(or.Limit), or.Order)
	if queryParams != "" {
		endpoint = fmt.Sprintf("%s?%s", endpoint, queryParams)
	}

	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
	}

	return endpoint, err
}

// OfferHandler is a function that is called when a new offer is received
type OfferHandler func(hProtocol.Offer)

// StreamOffers streams offers processed by the Stellar network for an account. Use context.WithCancel
// to stop streaming or context.Background() if you want to stream indefinitely.
// OfferHandler is a user-supplied function that is executed for each streamed offer received.
func (or OfferRequest) StreamOffers(ctx context.Context, client *Client, handler OfferHandler) (err error) {
	endpoint, err := or.BuildURL()
	if err != nil {
		return errors.Wrap(err, "unable to build endpoint for offers request")
	}

	url := fmt.Sprintf("%s%s", client.fixHorizonURL(), endpoint)

	return client.stream(ctx, url, func(data []byte) error {
		var offer hProtocol.Offer
		err = json.Unmarshal(data, &offer)
		if err != nil {
			return errors.Wrap(err, "error unmarshaling data for offers request")
		}
		handler(offer)
		return nil
	})
}
