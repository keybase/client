package service

import (
	"bytes"
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/gregor1"
)

type gregorHandler struct {
	libkb.Contextified
	cli       rpc.GenericClient
	sessionID gregor1.SessionID
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

	g.cli = cli

	// handler needs to know when login, logout happens
	g.G().AddLoginHook(g)
	g.G().AddLogoutHook(g)

	return g.tryAuth(ctx)
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
	g.G().Log.Debug("gregor handler: should retry: name %s, err %v (returning false)", name, err)
	return false
}

func (g *gregorHandler) ShouldRetryOnConnect(err error) bool {
	if err == nil {
		return false
	}

	g.G().Log.Debug("gregor handler: should retry on connect, err %v (returning true)", err)
	return true
}

func (g *gregorHandler) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	g.G().Log.Debug("gregor handler: broadcast: %+v", m)
	return nil
}

func (g *gregorHandler) OnLogin() {
	g.G().Log.Debug("gregor handler: OnLogin")
	if err := g.tryAuth(context.Background()); err != nil {
		g.G().Log.Debug("gregor handler: OnLogin tryAuth error: %s", err)
	}
}

func (g *gregorHandler) OnLogout() {
	g.G().Log.Debug("gregor handler: OnLogout")
	if err := g.revokeAuth(context.Background()); err != nil {
		g.G().Log.Debug("gregor handler: OnLogin revokeAuth error: %s", err)
	}
}

func (g *gregorHandler) tryAuth(ctx context.Context) error {
	loggedIn, err := g.G().LoginState().LoggedInLoad()
	if err != nil {
		return err
	}
	if !loggedIn {
		g.G().Log.Debug("gregor handler: not logged in, so not authenticating")
		return nil
	}

	var token string
	var uid keybase1.UID
	aerr := g.G().LoginState().LocalSession(func(s *libkb.Session) {
		token = s.GetToken()
		uid = s.GetUID()
	}, "gregor handler - login session")
	if aerr != nil {
		return aerr
	}
	g.G().Log.Debug("gregor handler: have session token")

	g.G().Log.Debug("gregor handler: authenticating")
	ac := gregor1.AuthClient{Cli: g.cli}
	auth, err := ac.AuthenticateSessionToken(ctx, gregor1.SessionToken(token))
	if err != nil {
		g.G().Log.Debug("gregor handler: auth error: %s", err)
		return err
	}

	g.G().Log.Debug("gregor handler: auth result: %+v", auth)
	if !bytes.Equal(auth.Uid, uid.ToBytes()) {
		return fmt.Errorf("gregor handler: auth result uid %x doesn't match session uid %q", auth.Uid, uid)
	}
	g.sessionID = auth.Sid

	return nil
}

func (g *gregorHandler) revokeAuth(ctx context.Context) error {
	if len(g.sessionID) == 0 {
		return nil
	}

	ac := gregor1.AuthClient{Cli: g.cli}
	if err := ac.RevokeSessionIDs(ctx, []gregor1.SessionID{g.sessionID}); err != nil {
		g.G().Log.Debug("gregor handler: revoke session id error: %s", err)
		return err
	}
	return nil
}
