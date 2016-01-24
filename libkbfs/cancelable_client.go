package libkbfs

import (
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// TODO: Remove this once the RPC library supports cancellation
// natively.
type cancelableClient struct {
	delegate keybase1.GenericClient
}

var _ keybase1.GenericClient = cancelableClient{}

func (c cancelableClient) Call(ctx context.Context, s string, args interface{}, res interface{}) error {
	return runUnlessCanceled(ctx, func() error {
		return c.delegate.Call(ctx, s, args, res)
	})
}

func (c cancelableClient) Notify(ctx context.Context, s string, args interface{}) error {
	return runUnlessCanceled(ctx, func() error {
		return c.delegate.Notify(ctx, s, args)
	})
}
