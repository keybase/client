package horizonclient

import (
	"fmt"
	"net/url"

	"github.com/stellar/go/support/errors"
)

// BuildURL creates the endpoint to be queried based on the data in the AccountRequest struct.
// If only AccountID is present, then the endpoint for account details is returned.
// If both AccounId and DataKey are present, then the endpoint for getting account data is returned
func (ar AccountRequest) BuildURL() (endpoint string, err error) {

	nParams := countParams(ar.DataKey, ar.AccountID)

	if nParams >= 1 && ar.AccountID == "" {
		err = errors.New("invalid request: too few parameters")
	}

	if nParams <= 0 {
		err = errors.New("invalid request: no parameters")
	}

	if err != nil {
		return endpoint, err
	}

	if ar.DataKey != "" && ar.AccountID != "" {
		endpoint = fmt.Sprintf(
			"accounts/%s/data/%s",
			ar.AccountID,
			ar.DataKey,
		)
	} else if ar.AccountID != "" {
		endpoint = fmt.Sprintf(
			"accounts/%s",
			ar.AccountID,
		)
	}

	_, err = url.Parse(endpoint)
	if err != nil {
		err = errors.Wrap(err, "failed to parse endpoint")
	}

	return endpoint, err
}
