package service

import (
	"time"

	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/gregor1"
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
	if err := srv.Register(gregor1.OutgoingProtocol(g)); err != nil {
		return err
	}

	loggedIn, err := g.G().LoginState().LoggedInLoad()
	if err != nil {
		return err
	}
	if !loggedIn {
		g.G().Log.Debug("gregor handler: not logged in, so not authenticating")
		return nil
	}

	var token string
	aerr := g.G().LoginState().LocalSession(func(s *libkb.Session) {
		token = s.GetToken()
	}, "gregor handler - login session")
	if aerr != nil {
		return aerr
	}
	g.G().Log.Debug("gregor handler: have session token")

	g.G().Log.Debug("gregor handler: authenticating")
	ac := gregor1.AuthClient{Cli: cli}
	auth, err := ac.AuthenticateSessionToken(ctx, gregor1.SessionToken(token))
	if err != nil {
		g.G().Log.Debug("gregor handler: auth error: %s", err)
		return err
	}

	g.G().Log.Debug("gregor handler: auth result: %+v", auth)

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

func (g *gregorHandler) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	g.G().Log.Debug("gregor handler: broadcast: %+v", m)
	return nil
}
