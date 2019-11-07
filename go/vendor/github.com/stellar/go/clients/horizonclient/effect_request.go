package horizonclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/stellar/go/protocols/horizon/effects"
	"github.com/stellar/go/support/errors"
)

// EffectHandler is a function that is called when a new effect is received
type EffectHandler func(effects.Effect)

// BuildURL creates the endpoint to be queried based on the data in the EffectRequest struct.
// If no data is set, it defaults to the build the URL for all effects
func (er EffectRequest) BuildURL() (endpoint string, err error) {
	nParams := countParams(er.ForAccount, er.ForLedger, er.ForOperation, er.ForTransaction)

	if nParams > 1 {
		return endpoint, errors.New("invalid request: too many parameters")
	}

	endpoint = "effects"

	if er.ForAccount != "" {
		endpoint = fmt.Sprintf("accounts/%s/effects", er.ForAccount)
	}

	if er.ForLedger != "" {
		endpoint = fmt.Sprintf("ledgers/%s/effects", er.ForLedger)
	}

	if er.ForOperation != "" {
		endpoint = fmt.Sprintf("operations/%s/effects", er.ForOperation)
	}

	if er.ForTransaction != "" {
		endpoint = fmt.Sprintf("transactions/%s/effects", er.ForTransaction)
	}

	queryParams := addQueryParams(cursor(er.Cursor), limit(er.Limit), er.Order)
	if queryParams != "" {
		endpoint = fmt.Sprintf("%s?%s", endpoint, queryParams)
	}

	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
	}

	return endpoint, err
}

// StreamEffects streams horizon effects. It can be used to stream all effects or account specific effects.
// Use context.WithCancel to stop streaming or context.Background() if you want to stream indefinitely.
// EffectHandler is a user-supplied function that is executed for each streamed effect received.
func (er EffectRequest) StreamEffects(ctx context.Context, client *Client, handler EffectHandler) error {
	endpoint, err := er.BuildURL()
	if err != nil {
		return errors.Wrap(err, "unable to build endpoint for effects request")
	}

	url := fmt.Sprintf("%s%s", client.fixHorizonURL(), endpoint)
	return client.stream(ctx, url, func(data []byte) error {
		var baseEffect effects.Base
		// unmarshal into the base effect type
		if err = json.Unmarshal(data, &baseEffect); err != nil {
			return errors.Wrap(err, "error unmarshaling data for effects request")
		}

		// unmarshal into the concrete effect type
		effs, err := effects.UnmarshalEffect(baseEffect.GetType(), data)
		if err != nil {
			return errors.Wrap(err, "unmarshaling to the correct effect type")
		}

		handler(effs)
		return nil
	})
}
