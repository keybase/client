package chat

import (
	"github.com/keybase/client/go/chat/globals"
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
		DebugLabeler: utils.NewDebugLabeler(g, "RemoteClient", false),
		cli:          cli,
	}
}

func (c *RemoteClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	return c.cli.Call(ctx, method, arg, res)
}

func (c *RemoteClient) Notify(ctx context.Context, method string, arg interface{}) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	return c.cli.Notify(ctx, method, arg)
}
