package libkb

import (
	"golang.org/x/net/context"
	"net/url"
	"time"
)

type APIArg struct {
	Endpoint        string
	uArgs           url.Values
	Args            HTTPArgs
	JSONPayload     JSONPayload
	NeedSession     bool
	SessionR        SessionReader
	HTTPStatus      []int
	AppStatusCodes  []int
	InitialTimeout  time.Duration // optional
	RetryMultiplier float64       // optional
	RetryCount      int           // optional
	NetContext      context.Context
}

// NewAPIArg creates a standard APIArg that will result
// in one API request with the default timeout.
func NewAPIArg(endpoint string) APIArg {
	return APIArg{
		Endpoint: endpoint,
	}
}

func NewAPIArgWithNetContext(ctx context.Context, endpoint string) APIArg {
	return APIArg{
		NetContext: ctx,
		Endpoint:   endpoint,
	}
}

// NewRetryAPIArg creates an APIArg that will cause the http client
// to use a much smaller request timeout, but retry the request
// several times, backing off on the timeout each time.
func NewRetryAPIArg(endpoint string) APIArg {
	return APIArg{
		Endpoint:        endpoint,
		InitialTimeout:  HTTPRetryInitialTimeout,
		RetryMultiplier: HTTPRetryMutliplier,
		RetryCount:      HTTPRetryCount,
	}
}
