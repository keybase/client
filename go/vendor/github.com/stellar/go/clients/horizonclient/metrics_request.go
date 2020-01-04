package horizonclient

import "github.com/stellar/go/support/errors"

// BuildURL returns the url for getting metrics about a running horizon instance
func (mr metricsRequest) BuildURL() (endpoint string, err error) {
	endpoint = mr.endpoint
	if endpoint == "" {
		err = errors.New("invalid request: too few parameters")
	}

	return
}
