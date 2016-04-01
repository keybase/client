package service

import (
	"time"

	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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

func (g *gregorHandler) OnConnect(context.Context, *rpc.Connection, rpc.GenericClient, *rpc.Server) error {
	g.G().Log.Debug("gregor handler: connected")
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
