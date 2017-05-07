package chat

import (
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type RemoteCallCanceler interface {
	RemoteCallBegin(context.CancelFunc, string)
	RemoteCallFinished(string)
}

type RemoteClient struct {
	utils.DebugLabeler

	cli       rpc.GenericClient
	canceller RemoteCallCanceler
}

func NewRemoteClient(g *globals.Context, cli rpc.GenericClient, canceller RemoteCallCanceler) *RemoteClient {
	return &RemoteClient{
		DebugLabeler: utils.NewDebugLabeler(g, "RemoteClient", false),
		cli:          cli,
		canceller:    canceller,
	}
}

func (c *RemoteClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	id := libkb.RandStringB64(3)
	ch := make(chan error, 1)
	c.canceller.RemoteCallBegin(cancel, id)
	go func() {
		err := c.cli.Call(ctx, method, arg, res)
		c.canceller.RemoteCallFinished(id)
		ch <- err
	}()
	select {
	case err = <-ch:
	case <-ctx.Done():
		err = ctx.Err()
	}
	return err
}

func (c *RemoteClient) Notify(ctx context.Context, method string, arg interface{}) (err error) {
	defer c.Trace(ctx, func() error { return err }, method)()
	return c.cli.Notify(ctx, method, arg)
}
