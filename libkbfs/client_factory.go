package libkbfs

import (
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// A ClientFactory vends keybase1.GenericClient objects, which wrap an
// underlying base GenericClient to provide additional functionality,
// like robust connection handling, stat tracking, etc.
type ClientFactory interface {
	// Makes a new client for the given context. The result
	// shouldn't be cached -- a new client should be created for
	// every RPC call.
	//
	// TODO: Once context.Context is plumbed through
	// GenericClient.Call, we can remove the ctx argument here,
	// and clients can cache the returned value. We can maybe even
	// get rid of this interface altogether.
	GetClient(ctx context.Context) keybase1.GenericClient

	// Clean up any associated resources. None of the other
	// functions may be called after this is called.
	Shutdown()
}

// A CancelableClientFactory just vends a single client.
type CancelableClientFactory struct {
	client keybase1.GenericClient
}

type cancelableClient struct {
	client keybase1.GenericClient
	// We won't need this once ctx is plumbed through
	// GenericClient.Call.
	ctx context.Context
}

var _ keybase1.GenericClient = cancelableClient{}

func (c cancelableClient) Call(s string, args interface{}, res interface{}) error {
	return runUnlessCanceled(c.ctx, func() error {
		return c.client.Call(s, args, res)
	})
}

// GetClient implements ClientFactory for CancelableClientFactory.
func (f CancelableClientFactory) GetClient(ctx context.Context) keybase1.GenericClient {
	return cancelableClient{f.client, ctx}
}

// Shutdown implements ClientFactory for CancelableClientFactory.
func (f CancelableClientFactory) Shutdown() {}
