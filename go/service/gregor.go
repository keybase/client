package service

import (
	"time"

	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	protocol "github.com/keybase/gregor/protocol/go"
	"golang.org/x/net/context"
)

type gregorHandler struct {
	libkb.Contextified
}

func newGregorHandler(g *libkb.GlobalContext) *gregorHandler {
	return &gregorHandler{Contextified: libkb.NewContextified(g)}
}

func (g *gregorHandler) HandlerName() string {
	return "keybase service"
}

func (g *gregorHandler) OnConnect(ctx context.Context, conn *rpc.Connection, cli rpc.GenericClient, srv *rpc.Server) error {
	g.G().Log.Debug("gregor handler: connected")

	g.G().Log.Debug("gregor handler: registering protocols")
	if err := srv.Register(protocol.OutgoingProtocol(g)); err != nil {
		return err
	}

	g.G().Log.Debug("gregor handler: authenticating")
	ac := protocol.AuthClient{Cli: cli}
	if err := ac.Authenticate(ctx, "dummy auth token"); err != nil {
		return err
	}
	return nil
}

func (g *gregorHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
	g.G().Log.Debug("gregor handler: connect error %s, reconnect throttle duration: %s", err, reconnectThrottleDuration)
}

func (g *gregorHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
	g.G().Log.Debug("gregor handler: disconnected: %v", status)
}

func (g *gregorHandler) OnDoCommandError(err error, nextTime time.Duration) {
	g.G().Log.Debug("gregor handler: do command error: %s, nextTime: %s", err, nextTime)
}

func (g *gregorHandler) ShouldRetry(name string, err error) bool {
	return false
}

func (g *gregorHandler) ShouldRetryOnConnect(err error) bool {
	return false
}

func (g *gregorHandler) BroadcastMessage(ctx context.Context, m protocol.Message) error {
	g.G().Log.Debug("gregor handler: broadcast: %+v", m)
	return nil
}
