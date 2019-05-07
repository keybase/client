package libkb

import (
	"net/url"
	"time"
)

type APISessionType int

const (
	APISessionTypeNONE     APISessionType = 0
	APISessionTypeOPTIONAL APISessionType = 1
	APISessionTypeREQUIRED APISessionType = 2
)

type APIHeader struct {
	Key   string
	Value string
}

type APIArg struct {
	Endpoint        string
	uArgs           url.Values
	Args            HTTPArgs
	JSONPayload     JSONPayload
	SessionType     APISessionType
	HTTPStatus      []int
	AppStatusCodes  []int
	InitialTimeout  time.Duration // optional
	RetryMultiplier float64       // optional
	RetryCount      int           // optional
}

// NewAPIArg creates a standard APIArg that will result
// in one API request with the default timeout.
func NewAPIArg(endpoint string) APIArg {
	return APIArg{
		Endpoint: endpoint,
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
