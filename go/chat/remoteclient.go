package chat

import (
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type RemoteClient struct {
	utils.DebugLabeler

	cli rpc.GenericClient
}

func NewRemoteClient(g *globals.Context, cli rpc.GenericClient) *RemoteClient {
	return &RemoteClient{
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "RemoteClient", false),
		cli:          cli,
	}
}

func (c *RemoteClient) Call(ctx context.Context, method string, arg interface{},
	res interface{}, timeout time.Duration) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	err = c.cli.Call(ctx, method, arg, res, timeout)
	if err == nil {
		if rlRes, ok := res.(types.RateLimitedResult); ok {
			globals.CtxAddRateLimit(ctx, rlRes.GetRateLimit())
		}
	}
	return err
}

func (c *RemoteClient) CallCompressed(ctx context.Context, method string, arg interface{},
	res interface{}, ctype rpc.CompressionType, timeout time.Duration) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	err = c.cli.CallCompressed(ctx, method, arg, res, ctype, timeout)
	if err == nil {
		if rlRes, ok := res.(types.RateLimitedResult); ok {
			globals.CtxAddRateLimit(ctx, rlRes.GetRateLimit())
		}
	}
	return err
}

func (c *RemoteClient) Notify(ctx context.Context, method string, arg interface{}, timeout time.Duration) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	return c.cli.Notify(ctx, method, arg, timeout)
}
