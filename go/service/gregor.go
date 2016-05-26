package service

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/jonboulle/clockwork"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/keybase/gregor"
	"github.com/keybase/gregor/protocol/gregor1"
	grclient "github.com/keybase/gregor/rpc/client"
	grstorage "github.com/keybase/gregor/storage"
)

type IdentifyUIHandler struct {
	libkb.Contextified
	connID      libkb.ConnectionID
	alwaysAlive bool
}

var _ libkb.GregorInBandMessageHandler = (*IdentifyUIHandler)(nil)

func NewIdentifyUIHandler(g *libkb.GlobalContext, connID libkb.ConnectionID) IdentifyUIHandler {
	return IdentifyUIHandler{
		Contextified: libkb.NewContextified(g),
		connID:       connID,
		alwaysAlive:  false,
	}
}

func (h IdentifyUIHandler) IsAlive() bool {
	return (h.alwaysAlive || h.G().ConnectionManager.LookupConnection(h.connID) != nil)
}

func (h IdentifyUIHandler) Name() string {
	return "IdentifyUIHandler"
}

func (h *IdentifyUIHandler) toggleAlwaysAlive(alive bool) {
	h.alwaysAlive = alive
}

type gregorHandler struct {
	libkb.Contextified

	// This lock is to protect ibmHandlers and gregorCli. Only public methods
	// should grab it.
	sync.Mutex

	conn             *rpc.Connection
	cli              rpc.GenericClient
	sessionID        gregor1.SessionID
	skipRetryConnect bool
	itemsByID        map[string]gregor.Item
	gregorCli        *grclient.Client
	freshSync        bool
	ibmHandlers      []libkb.GregorInBandMessageHandler
}

var _ libkb.GregorDismisser = (*gregorHandler)(nil)
var _ libkb.GregorListener = (*gregorHandler)(nil)

type gregorLocalDb struct {
	db *libkb.JSONLocalDb
}

func newLocalDB(g *libkb.GlobalContext) *gregorLocalDb {
	return &gregorLocalDb{db: g.LocalDb}
}

func dbKey(u gregor.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBGregor, Key: hex.EncodeToString(u.Bytes())}
}

func (db *gregorLocalDb) Store(u gregor.UID, b []byte) error {
	return db.db.PutRaw(dbKey(u), b)
}

func (db *gregorLocalDb) Load(u gregor.UID) (res []byte, e error) {
	res, _, err := db.db.GetRaw(dbKey(u))
	return res, err
}

func newGregorHandler(g *libkb.GlobalContext) (gh *gregorHandler, err error) {
	gh = &gregorHandler{
		Contextified: libkb.NewContextified(g),
		itemsByID:    make(map[string]gregor.Item),
		ibmHandlers:  []libkb.GregorInBandMessageHandler{},
		freshSync:    true,
	}

	// Create client interface to gregord
	if gh.gregorCli, err = newGregorClient(g); err != nil {
		return nil, err
	}

	return gh, nil
}

func newGregorClient(g *libkb.GlobalContext) (*grclient.Client, error) {
	objFactory := gregor1.ObjFactory{}
	sm := grstorage.NewMemEngine(objFactory, clockwork.NewRealClock())

	var guid gregor.UID
	var gdid gregor.DeviceID
	var b []byte
	var err error

	uid := g.Env.GetUID()
	if !uid.Exists() {
		return nil, errors.New("no UID; probably not logged in")
	}
	if b = uid.ToBytes(); b == nil {
		return nil, errors.New("Can't convert UID to byte array")
	}
	if guid, err = objFactory.MakeUID(b); err != nil {
		return nil, err
	}

	did := g.Env.GetDeviceID()
	if !did.Exists() {
		return nil, errors.New("no UID; probably not logged in")
	}
	if b, err = hex.DecodeString(did.String()); err != nil {
		return nil, err
	}
	if gdid, err = objFactory.MakeDeviceID(b); err != nil {
		return nil, err
	}

	// Create client object
	gcli := grclient.NewClient(guid, gdid, sm, newLocalDB(g),
		g.Env.GetGregorSaveInterval(), g.Log)

	// Bring up local state
	g.Log.Debug("gregor handler: restoring state from leveldb")
	if err = gcli.Restore(); err != nil {
		// If this fails, we'll keep trying since the server can bail us out
		g.Log.Info("gregor handler: restore local state failed: %s", err)
	}

	return gcli, nil
}

func (g *gregorHandler) Connect(uri *rpc.FMPURI) error {
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

// PushHandler adds a new ibm handler to our list. This is usually triggered
// when an external entity (like Electron) connects to the service, and we can
// safely send Gregor information to it
func (g *gregorHandler) PushHandler(handler libkb.GregorInBandMessageHandler) {
	g.Lock()
	defer g.Unlock()

	g.ibmHandlers = append(g.ibmHandlers, handler)

	if err := g.replayInBandMessages(context.TODO(), time.Time{}, handler); err != nil {
		g.G().Log.Errorf("gregor handler: ConnectIdenfityUI() failed")
	}
}

// replayInBandMessages will replay all the messages in the current state from
// the given time. If a handler is specified, it will only replay using it,
// otherwise it will try all of them. gregorHandler needs to be locked when calling
// this function.
func (g *gregorHandler) replayInBandMessages(ctx context.Context, t time.Time,
	handler libkb.GregorInBandMessageHandler) error {
	var msgs []gregor.InBandMessage
	var err error
	if msgs, err = g.gregorCli.StateMachineInBandMessagesSince(t); err != nil {
		g.G().Log.Errorf("gregor handler: unable to fetch messages for reply: %s", err)
		return err
	}

	g.G().Log.Debug("gregor handler: replaying %d messages", len(msgs))
	for _, msg := range msgs {
		// If we have a handler, just run it on that, otherwise run it against
		// all of the handlers we know about
		if handler == nil {
			g.handleInBandMessage(ctx, msg)
		} else {
			g.handleInBandMessageWithHandler(ctx, msg, handler)
		}
	}

	return nil
}

// serverSync is called from OnConnect to sync down the current state from
// gregord. This can happen either on initial startup, or after a reconnect. Needs
// to be called with gregorHandler locked.
func (g *gregorHandler) serverSync(ctx context.Context, cli gregor1.IncomingInterface) error {
	var err error

	// Get time of the last message we synced (unless this is our first time syncing)
	var t time.Time
	if !g.freshSync {
		pt := g.gregorCli.StateMachineLatestCTime()
		if pt != nil {
			t = *pt
		}
	} else {
		g.G().Log.Debug("gregor handler: performing a fresh sync")
	}

	// Sync down everything from the server
	if err = g.gregorCli.Sync(cli); err != nil {
		g.G().Log.Errorf("gregor handler: error syncing from the server, bailing: %s", err)
		return err
	}

	// Replay in-band messages
	if err = g.replayInBandMessages(ctx, t, nil); err != nil {
		g.G().Log.Errorf("gregor handler: replay messages failed")
		return err
	}

	// All done with fresh syncs
	g.freshSync = false

	return nil
}

// OnConnect is called by the rpc library to indicate we have connected to
// gregord
func (g *gregorHandler) OnConnect(ctx context.Context, conn *rpc.Connection,
	cli rpc.GenericClient, srv *rpc.Server) error {
	g.Lock()
	defer g.Unlock()

	g.G().Log.Debug("gregor handler: connected")
	g.G().Log.Debug("gregor handler: registering protocols")
	if err := srv.Register(gregor1.OutgoingProtocol(g)); err != nil {
		return err
	}

	// Use the client parameter instead of conn.GetClient(), since we can get stuck
	// in a recursive loop if we keep retrying on reconnect.
	if err := g.auth(ctx, cli); err != nil {
		g.G().Log.Error("gregor handler: auth error!")
		return err
	}

	// Sync down events since we have been dead
	if err := g.serverSync(ctx, gregor1.IncomingClient{Cli: cli}); err != nil {
		g.G().Log.Error("gregor handler: sync failure!")
		return nil
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

// BroadcastMessage is called when we receive a new messages from gregord. Grabs
// the lock protect the state machine and handleInBandMessage
func (g *gregorHandler) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	g.Lock()
	defer g.Unlock()

	g.G().Log.Debug("gregor handler: broadcast: %+v", m)

	// Send message to local state machine
	g.gregorCli.StateMachineConsumeMessage(m)

	// Handle the message
	ibm := m.ToInBandMessage()
	if ibm != nil {
		return g.handleInBandMessage(ctx, ibm)
	}

	obm := m.ToOutOfBandMessage()
	if obm != nil {
		return g.handleOutOfBandMessage(ctx, obm)
	}

	g.G().Log.Error("gregor handler: both in-band and out-of-band message nil")
	return errors.New("invalid gregor message")
}

// handleInBandMessage runs a message on all the alive handlers. gregorHandler
// must be locked when calling this function.
func (g *gregorHandler) handleInBandMessage(ctx context.Context, ibm gregor.InBandMessage) error {
	var freshHandlers []libkb.GregorInBandMessageHandler

	// Loop over all handlers and run the messages against any that are alive
	// If the handler is not alive, we prune it from our list
	for _, handler := range g.ibmHandlers {
		if handler.IsAlive() {
			if err := g.handleInBandMessageWithHandler(ctx, ibm, handler); err != nil {
				g.G().Log.Debug("gregor handler: handleInBandMessage() failed to run %s handler", handler.Name())
			}
			freshHandlers = append(freshHandlers, handler)
		}
	}

	g.ibmHandlers = freshHandlers
	return nil
}

// handleInBandMessageWithHandler runs a message against the specified handler
func (g *gregorHandler) handleInBandMessageWithHandler(ctx context.Context,
	ibm gregor.InBandMessage, handler libkb.GregorInBandMessageHandler) error {
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
			g.G().Log.Debug("gregor handler: msg ID %s created ctime: %s", id,
				item.Metadata().CTime())

			// Store the item in a map according to its ID. We use this when
			// items are dismissed, to remember what the item was.
			g.itemsByID[item.Metadata().MsgID().String()] = item

			category := ""
			if item.Category() != nil {
				category = item.Category().String()
				g.G().Log.Debug("gregor handler: item %s has category %s", id, category)
			}

			handler.Create(ctx, category, item)
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

				handler.Dismiss(ctx, category, item)

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

func (h IdentifyUIHandler) Create(ctx context.Context, category string, item gregor.Item) error {
	switch category {
	case "show_tracker_popup":
		return h.handleShowTrackerPopupCreate(ctx, item)
	}

	return nil
}

func (h IdentifyUIHandler) Dismiss(ctx context.Context, category string, item gregor.Item) error {
	switch category {
	case "show_tracker_popup":
		return h.handleShowTrackerPopupDismiss(ctx, item)
	}

	return nil
}

func (h IdentifyUIHandler) handleShowTrackerPopupCreate(ctx context.Context, item gregor.Item) error {
	h.G().Log.Debug("gregor handler: handleShowTrackerPopupCreate: %+v", item)
	if item.Body() == nil {
		return errors.New("gregor handler for show_tracker_popup: nil message body")
	}
	body, err := jsonw.Unmarshal(item.Body().Bytes())
	if err != nil {
		h.G().Log.Error("body failed to unmarshal", err)
		return err
	}
	uidString, err := body.AtPath("uid").GetString()
	if err != nil {
		h.G().Log.Error("failed to extract uid", err)
		return err
	}
	uid, err := keybase1.UIDFromString(uidString)
	if err != nil {
		h.G().Log.Error("failed to convert UID from string", err)
		return err
	}

	identifyUI, err := h.G().UIRouter.GetIdentifyUI()
	if err != nil {
		h.G().Log.Error("failed to get IdentifyUI", err)
		return err
	}
	if identifyUI == nil {
		h.G().Log.Error("got nil IdentifyUI")
		return errors.New("got nil IdentifyUI")
	}
	secretUI, err := h.G().UIRouter.GetSecretUI(0)
	if err != nil {
		h.G().Log.Error("failed to get SecretUI", err)
		return err
	}
	if secretUI == nil {
		h.G().Log.Error("got nil SecretUI")
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
	identifyEng := engine.NewIdentify2WithUID(h.G(), &identifyArg)
	return identifyEng.Run(&engineContext)
}

func (h IdentifyUIHandler) handleShowTrackerPopupDismiss(ctx context.Context, item gregor.Item) error {
	h.G().Log.Debug("gregor handler: handleShowTrackerPopupDismiss: %+v", item)
	if item.Body() == nil {
		return errors.New("gregor dismissal for show_tracker_popup: nil message body")
	}
	body, err := jsonw.Unmarshal(item.Body().Bytes())
	if err != nil {
		h.G().Log.Error("body failed to unmarshal", err)
		return err
	}
	uidString, err := body.AtPath("uid").GetString()
	if err != nil {
		h.G().Log.Error("failed to extract uid", err)
		return err
	}
	uid, err := keybase1.UIDFromString(uidString)
	if err != nil {
		h.G().Log.Error("failed to convert UID from string", err)
		return err
	}
	user, err := libkb.LoadUser(libkb.NewLoadUserByUIDArg(h.G(), uid))
	if err != nil {
		h.G().Log.Error("failed to load user from UID", err)
		return err
	}

	identifyUI, err := h.G().UIRouter.GetIdentifyUI()
	if err != nil {
		h.G().Log.Error("failed to get IdentifyUI", err)
		return err
	}
	if identifyUI == nil {
		h.G().Log.Error("got nil IdentifyUI")
		return errors.New("got nil IdentifyUI")
	}

	reason := keybase1.DismissReason{
		Type: keybase1.DismissReasonType_HANDLED_ELSEWHERE,
	}
	identifyUI.Dismiss(user.GetName(), reason)

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

func (g *gregorHandler) auth(ctx context.Context, cli rpc.GenericClient) error {
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
	ac := gregor1.AuthClient{Cli: cli}
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

func (g *gregorHandler) connectTLS(uri *rpc.FMPURI) error {

	g.G().Log.Debug("connecting to gregord via TLS")
	rawCA := g.G().Env.GetBundledCA(uri.Host)
	if len(rawCA) == 0 {
		return fmt.Errorf("No bundled CA for %s", uri.Host)
	}
	g.conn = rpc.NewTLSConnection(uri.HostPort, []byte(rawCA), keybase1.ErrorUnwrapper{}, g, true, libkb.NewRPCLogFactory(g.G()), keybase1.WrapError, g.G().Log, nil)

	// The client we get here will reconnect to gregord on disconnect if necessary.
	// We should grab it here instead of in OnConnect, since the connection is not
	// fully established in OnConnect. Anything that wants to make calls outside
	// of OnConnect should use g.cli, everything else should the client that is
	// a paramater to OnConnect
	g.cli = g.conn.GetClient()

	return nil
}

func (g *gregorHandler) connectNoTLS(uri *rpc.FMPURI) error {

	g.G().Log.Debug("connecting to gregord without TLS")
	t := newConnTransport(g.G(), uri.HostPort)
	g.conn = rpc.NewConnectionWithTransport(g, t, keybase1.ErrorUnwrapper{}, true, keybase1.WrapError, g.G().Log, nil)
	g.cli = g.conn.GetClient()

	return nil
}

func (g *gregorHandler) DismissItem(id gregor.MsgID) error {
	idStruct := gregor1.MsgID(id.Bytes())
	uid := g.G().Env.GetUID()
	if uid.IsNil() {
		return fmt.Errorf("Can't dismiss gregor items without a current UID.")
	}
	msgID, randErr := libkb.RandBytes(16) // TODO: Create a shared function for this.
	if randErr != nil {
		return randErr
	}
	dismissal := gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   gregor1.UID(uid),
					MsgID_: msgID,
				},
				Dismissal_: &gregor1.Dismissal{
					MsgIDs_: []gregor1.MsgID{idStruct},
				},
			},
		},
	}
	// TODO: Should the interface take a context from the caller?
	return g.BroadcastMessage(context.TODO(), dismissal)
}
