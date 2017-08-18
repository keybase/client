// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdPing struct {
	libkb.Contextified
	gregor bool
}

func (v *CmdPing) Run() error {
	if v.gregor {
		return PingGregor(v.G())
	}

	_, err := v.G().API.Post(libkb.APIArg{Endpoint: "ping"})
	if err != nil {
		return err
	}
	_, err = v.G().API.Get(libkb.APIArg{Endpoint: "ping"})
	if err != nil {
		return err
	}
	v.G().Log.Info(fmt.Sprintf("API Server at %s is up", v.G().Env.GetServerURI()))

	return nil
}

func NewCmdPing(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "ping",
		Usage: "Ping the keybase API server",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "gregor",
				Usage: "ping the Gregor server",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPing{Contextified: libkb.NewContextified(g)}, "ping", c)
		},
	}
}

func (v *CmdPing) ParseArgv(ctx *cli.Context) error {
	v.gregor = ctx.Bool("gregor")
	return nil
}

func (v *CmdPing) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

// pingGregorTransport implements rpc.ConnectionTransport
type pingGregorTransport struct {
	libkb.Contextified
	host            string
	conn            net.Conn
	transport       rpc.Transporter
	stagedTransport rpc.Transporter
}

var _ rpc.ConnectionTransport = (*pingGregorTransport)(nil)

func newConnTransport(host string) *pingGregorTransport {
	return &pingGregorTransport{
		host: host,
	}
}

func (t *pingGregorTransport) Dial(context.Context) (rpc.Transporter, error) {
	t.G().Log.Debug("pingGregorTransport Dial", t.host)
	var err error
	t.conn, err = net.Dial("tcp", t.host)
	if err != nil {
		return nil, err
	}
	t.stagedTransport = rpc.NewTransport(t.conn, nil, nil)
	return t.stagedTransport, nil
}

func (t *pingGregorTransport) IsConnected() bool {
	t.G().Log.Debug("pingGregorTransport IsConnected")
	return t.transport != nil && t.transport.IsConnected()
}

func (t *pingGregorTransport) Finalize() {
	t.G().Log.Debug("pingGregorTransport Finalize")
	t.transport = t.stagedTransport
	t.stagedTransport = nil
}

func (t *pingGregorTransport) Close() {
	t.G().Log.Debug("pingGregorTransport Close")
	t.conn.Close()
}

// pingGregorHandler implements rpc.ConnectionHandler
type pingGregorHandler struct {
	libkb.Contextified
	pingErrors  chan error
	pingSuccess chan struct{}
}

var _ rpc.ConnectionHandler = (*pingGregorHandler)(nil)

func newGregorHandler() *pingGregorHandler {
	return &pingGregorHandler{}
}

func (g *pingGregorHandler) HandlerName() string {
	return "ping gregor"
}

func (g *pingGregorHandler) OnConnect(ctx context.Context, conn *rpc.Connection, cli rpc.GenericClient, srv *rpc.Server) error {
	g.G().Log.Debug("pingGregorHandler OnConnect")
	ac := gregor1.IncomingClient{Cli: cli}
	response, err := ac.Ping(ctx)
	if err != nil {
		g.pingErrors <- err
	} else if response != "pong" {
		g.pingErrors <- fmt.Errorf("Got an unexpected response from ping: %#v", response)
	} else {
		g.pingSuccess <- struct{}{}
	}
	return err
}

func (g *pingGregorHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
	g.G().Log.Debug("pingGregorHandler OnConnectError", err)
	g.pingErrors <- err
}

func (g *pingGregorHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
	g.G().Log.Debug("pingGregorHandler OnDisconnected", status)
}

func (g *pingGregorHandler) OnDoCommandError(err error, nextTime time.Duration) {
	g.G().Log.Debug("pingGregorHandler DoCommandError", err)
	g.pingErrors <- err
}

func (g *pingGregorHandler) ShouldRetry(name string, err error) bool {
	g.G().Log.Debug("pingGregorHandler ShouldRetry", name, err)
	g.pingErrors <- err
	return false
}

func (g *pingGregorHandler) ShouldRetryOnConnect(err error) bool {
	g.G().Log.Debug("pingGregorHandler ShouldRetryOnConnect", err)
	g.pingErrors <- err
	return false
}

func (g *pingGregorHandler) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	g.G().Log.Debug("pingGregorHandler BroadcaseMessage", m)
	return nil
}

func PingGregor(g *libkb.GlobalContext) error {
	var pingError error
	g.Log.Debug("+ libkb.PingGregor")
	defer g.Log.Debug("- libkb.PingGregor %#v", pingError)

	transport := &pingGregorTransport{
		Contextified: libkb.NewContextified(g),
		host:         strings.TrimPrefix(g.Env.GetGregorURI(), "fmprpc://"),
	}
	rpcHandler := &pingGregorHandler{
		Contextified: libkb.NewContextified(g),
		pingErrors:   make(chan error),
		pingSuccess:  make(chan struct{}),
	}
	opts := rpc.ConnectionOpts{
		WrapErrorFunc: keybase1.WrapError,
	}
	connection := rpc.NewConnectionWithTransport(rpcHandler, transport, keybase1.ErrorUnwrapper{}, g.Log, opts)
	select {
	case err := <-rpcHandler.pingErrors:
		pingError = fmt.Errorf("Gregor ping FAILED: %s", err.Error())
	case <-rpcHandler.pingSuccess:
	}
	connection.Shutdown()
	return pingError
}
