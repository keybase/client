package service

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/keybase/gregor"
	"github.com/keybase/gregor/protocol/gregor1"
)

type gregorHandler struct {
	libkb.Contextified
	conn             *rpc.Connection
	cli              rpc.GenericClient
	sessionID        gregor1.SessionID
	skipRetryConnect bool
	itemsByID        map[string]gregor.Item
}

func newGregorHandler(g *libkb.GlobalContext) *gregorHandler {
	return &gregorHandler{
		Contextified: libkb.NewContextified(g),
		itemsByID:    make(map[string]gregor.Item),
	}
}

func (g *gregorHandler) Connect(uri *fmpURI) error {
	var err error
	if uri.UseTLS() {
		err = g.connectTLS(uri)
	} else {
		err = g.connectNoTLS(uri)
	}
	return err
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

	g.cli = conn.GetClient()

	return g.auth(ctx)
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

	g.G().Log.Debug("gregor handler: should retry on connect, err %v", err)
	if g.skipRetryConnect {
		g.G().Log.Debug("gregor handler: should retry on connect, skip retry flag set, returning false")
		g.skipRetryConnect = false
		return false
	}

	return true
}

func (g *gregorHandler) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	g.G().Log.Debug("gregor handler: broadcast: %+v", m)

	ibm := m.ToInBandMessage()
	if ibm != nil {
		return g.handleInBandMessage(ctx, ibm)
	}

	obm := m.ToOutOfBandMessage()
	if obm != nil {
		return g.handleOutOfBandMessage(ctx, obm)
	}

	return fmt.Errorf("gregor handler: both in-band and out-of-band message nil")
}

func (g *gregorHandler) handleInBandMessage(ctx context.Context, ibm gregor.InBandMessage) error {
	g.G().Log.Debug("gregor handler: handleInBand: %+v", ibm)

	sync := ibm.ToStateSyncMessage()
	if sync != nil {
		g.G().Log.Debug("gregor handler: state sync message")
		return nil
	}

	update := ibm.ToStateUpdateMessage()
	if update != nil {
		g.G().Log.Debug("gregor handler: state update message")

		item := update.Creation()
		if item != nil {
			id := item.Metadata().MsgID().String()
			g.G().Log.Debug("gregor handler: item %s created", id)

			// Store the item in a map according to its ID. We use this when
			// items are dismissed, to remember what the item was.
			g.itemsByID[item.Metadata().MsgID().String()] = item

			category := ""
			if item.Category() != nil {
				category = item.Category().String()
				g.G().Log.Debug("gregor handler: item %s has category %s", id, category)
			}
			if category == "show_tracker_popup" {
				return g.handleShowTrackerPopup(ctx, item)
			}
			g.G().Log.Errorf("Unrecognized item category: %s", item.Category())
		}

		dismissal := update.Dismissal()
		if dismissal != nil {
			g.G().Log.Debug("gregor handler: received dismissal")
			for _, id := range dismissal.MsgIDsToDismiss() {
				item, present := g.itemsByID[id.String()]
				if !present {
					g.G().Log.Warning("gregor handler: tried to dismiss item %s, not present", id.String())
					continue
				}
				g.G().Log.Debug("gregor handler: dismissing item %s", id.String())

				category := ""
				if item.Category() != nil {
					category = item.Category().String()
					g.G().Log.Debug("gregor handler: dismissal %s has category %s", id, category)
				}
				if category == "show_tracker_popup" {
					return g.handleDismissTrackerPopup(ctx, item)
				}

				// Clear the item out of items map.
				delete(g.itemsByID, id.String())
			}
			if len(dismissal.RangesToDismiss()) > 0 {
				g.G().Log.Error("gregor handler: message range dismissing not implemented")
			}
			return nil
		}
	}

	g.G().Log.Errorf("InBandMessage unexpectedly not handled")
	return nil
}

func (g *gregorHandler) handleShowTrackerPopup(ctx context.Context, item gregor.Item) error {
	g.G().Log.Debug("gregor handler: handleShowTrackerPopup: %+v", item)
	if item.Body() == nil {
		return errors.New("gregor handler for show_tracker_popup: nil message body")
	}
	body, err := jsonw.Unmarshal(item.Body().Bytes())
	if err != nil {
		g.G().Log.Error("body failed to unmarshal", err)
		return err
	}
	uidString, err := body.AtPath("uid").GetString()
	if err != nil {
		g.G().Log.Error("failed to extract uid", err)
		return err
	}
	uid, err := keybase1.UIDFromString(uidString)
	if err != nil {
		g.G().Log.Error("failed to convert UID from string", err)
		return err
	}

	identifyUI, err := g.G().UIRouter.GetIdentifyUI()
	if err != nil {
		g.G().Log.Error("failed to get IdentifyUI", err)
		return err
	}
	if identifyUI == nil {
		g.G().Log.Error("got nil IdentifyUI")
		return errors.New("got nil IdentifyUI")
	}
	secretUI, err := g.G().UIRouter.GetSecretUI(0)
	if err != nil {
		g.G().Log.Error("failed to get SecretUI", err)
		return err
	}
	if secretUI == nil {
		g.G().Log.Error("got nil SecretUI")
		return errors.New("got nil SecretUI")
	}
	engineContext := engine.Context{
		IdentifyUI: identifyUI,
		SecretUI:   secretUI,
	}

	identifyReason := keybase1.IdentifyReason{
		Type: keybase1.IdentifyReasonType_TRACK,
		// TODO: text here?
	}
	identifyArg := keybase1.Identify2Arg{Uid: uid, Reason: identifyReason}
	identifyEng := engine.NewIdentify2WithUID(g.G(), &identifyArg)
	return identifyEng.Run(&engineContext)
}

func (g *gregorHandler) handleDismissTrackerPopup(ctx context.Context, item gregor.Item) error {
	g.G().Log.Debug("gregor handler: handleDismissShowTrackerPopup: %+v", item)
	if item.Body() == nil {
		return errors.New("gregor dismissal for show_tracker_popup: nil message body")
	}
	body, err := jsonw.Unmarshal(item.Body().Bytes())
	if err != nil {
		g.G().Log.Error("body failed to unmarshal", err)
		return err
	}
	uidString, err := body.AtPath("uid").GetString()
	if err != nil {
		g.G().Log.Error("failed to extract uid", err)
		return err
	}
	uid, err := keybase1.UIDFromString(uidString)
	if err != nil {
		g.G().Log.Error("failed to convert UID from string", err)
		return err
	}

	identifyUI, err := g.G().UIRouter.GetIdentifyUI()
	if err != nil {
		g.G().Log.Error("failed to get IdentifyUI", err)
		return err
	}
	if identifyUI == nil {
		g.G().Log.Error("got nil IdentifyUI")
		return errors.New("got nil IdentifyUI")
	}

	reason := keybase1.DismissReason{
		Type: keybase1.DismissReasonType_HANDLED_ELSEWHERE,
	}
	identifyUI.Dismiss(uid, reason)

	return nil
}

func (g *gregorHandler) handleOutOfBandMessage(ctx context.Context, obm gregor.OutOfBandMessage) error {
	g.G().Log.Debug("gregor handler: handleOutOfBand: %+v", obm)
	if obm.System() == nil {
		return errors.New("nil system in out of band message")
	}

	switch obm.System().String() {
	case "kbfs.favorites":
		return g.kbfsFavorites(ctx, obm)
	default:
		return fmt.Errorf("unhandled system: %s", obm.System())
	}
}

func (g *gregorHandler) Shutdown() {
	if g.conn == nil {
		return
	}
	g.conn.Shutdown()
	g.conn = nil
}

func (g *gregorHandler) kbfsFavorites(ctx context.Context, m gregor.OutOfBandMessage) error {
	if m.Body() == nil {
		return errors.New("gregor handler for kbfs.favorites: nil message body")
	}
	body, err := jsonw.Unmarshal(m.Body().Bytes())
	if err != nil {
		return err
	}

	action, err := body.AtPath("action").GetString()
	if err != nil {
		return err
	}

	switch action {
	case "create", "delete":
		return g.notifyFavoritesChanged(ctx, m.UID())
	default:
		return fmt.Errorf("unhandled kbfs.favorites action %q", action)
	}
}

func (g *gregorHandler) notifyFavoritesChanged(ctx context.Context, uid gregor.UID) error {
	kbUID, err := keybase1.UIDFromString(hex.EncodeToString(uid.Bytes()))
	if err != nil {
		return err
	}
	g.G().NotifyRouter.HandleFavoritesChanged(kbUID)
	return nil
}

func (g *gregorHandler) auth(ctx context.Context) error {
	var token string
	var uid keybase1.UID
	aerr := g.G().LoginState().LocalSession(func(s *libkb.Session) {
		token = s.GetToken()
		uid = s.GetUID()
	}, "gregor handler - login session")
	if aerr != nil {
		g.skipRetryConnect = true
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
		g.skipRetryConnect = true
		return fmt.Errorf("gregor handler: auth result uid %x doesn't match session uid %q", auth.Uid, uid)
	}
	g.sessionID = auth.Sid

	return nil
}

func (g *gregorHandler) connectTLS(uri *fmpURI) error {
	g.G().Log.Debug("connecting to gregord via TLS")
	rawCA := g.G().Env.GetBundledCA(uri.Host)
	if len(rawCA) == 0 {
		return fmt.Errorf("No bundled CA for %s", uri.Host)
	}
	g.conn = rpc.NewTLSConnection(uri.HostPort, []byte(rawCA), keybase1.ErrorUnwrapper{}, g, true, libkb.NewRPCLogFactory(g.G()), keybase1.WrapError, g.G().Log, nil)
	return nil
}

func (g *gregorHandler) connectNoTLS(uri *fmpURI) error {
	g.G().Log.Debug("connecting to gregord without TLS")
	t := newConnTransport(g.G(), uri.HostPort)
	g.conn = rpc.NewConnectionWithTransport(g, t, keybase1.ErrorUnwrapper{}, true, keybase1.WrapError, g.G().Log, nil)
	return nil
}
