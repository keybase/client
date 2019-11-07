package horizonclient

import (
	"fmt"
	"net/url"

	"github.com/stellar/go/support/errors"
)

// BuildURL returns the url for submitting transactions to a running horizon instance
func (sr submitRequest) BuildURL() (endpoint string, err error) {
	if sr.endpoint == "" || sr.transactionXdr == "" {
		return endpoint, errors.New("invalid request: too few parameters")
	}

	query := url.Values{}
	query.Set("tx", sr.transactionXdr)

	endpoint = fmt.Sprintf("%s?%s", sr.endpoint, query.Encode())
	return endpoint, err
}
