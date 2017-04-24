package service

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/url"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	chatstorage "github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/gregor"
	grclient "github.com/keybase/client/go/gregor/client"
	"github.com/keybase/client/go/gregor/storage"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
)

const GregorRequestTimeout time.Duration = 30 * time.Second
const GregorConnectionRetryInterval time.Duration = 2 * time.Second

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

type gregorFirehoseHandler struct {
	libkb.Contextified
	connID libkb.ConnectionID
	cli    keybase1.GregorUIClient
}

func newGregorFirehoseHandler(g *libkb.GlobalContext, connID libkb.ConnectionID, xp rpc.Transporter) *gregorFirehoseHandler {
	return &gregorFirehoseHandler{
		Contextified: libkb.NewContextified(g),
		connID:       connID,
		cli:          keybase1.GregorUIClient{Cli: rpc.NewClient(xp, libkb.ErrorUnwrapper{}, nil)},
	}
}

func (h *gregorFirehoseHandler) IsAlive() bool {
	return h.G().ConnectionManager.LookupConnection(h.connID) != nil
}

func (h *gregorFirehoseHandler) PushState(s gregor1.State, r keybase1.PushReason) {
	err := h.cli.PushState(context.Background(), keybase1.PushStateArg{State: s, Reason: r})
	if err != nil {
		h.G().Log.Error(fmt.Sprintf("Error in firehose push state: %s", err))
	}
}

func (h *gregorFirehoseHandler) PushOutOfBandMessages(m []gregor1.OutOfBandMessage) {
	err := h.cli.PushOutOfBandMessages(context.Background(), m)
	if err != nil {
		h.G().Log.Error(fmt.Sprintf("Error in firehose push out-of-band messages: %s", err))
	}
}

type testingEvents struct {
	broadcastSentCh chan error
}

func newTestingEvents() *testingEvents {
	return &testingEvents{
		broadcastSentCh: make(chan error),
	}
}

type gregorHandler struct {
	globals.Contextified
	utils.DebugLabeler

	// This lock is to protect ibmHandlers and gregorCli and firehoseHandlers. Only public methods
	// should grab it.
	sync.Mutex
	ibmHandlers      []libkb.GregorInBandMessageHandler
	gregorCli        *grclient.Client
	firehoseHandlers []libkb.GregorFirehoseHandler
	badger           *badges.Badger
	chatHandler      *chat.PushHandler
	reachability     *reachability

	// This mutex protects the con object
	connMutex sync.Mutex
	conn      *rpc.Connection
	uri       *rpc.FMPURI

	cli              rpc.GenericClient
	pingCli          rpc.GenericClient
	sessionID        gregor1.SessionID
	skipRetryConnect bool
	freshReplay      bool

	// Function for determining if a new BroadcastMessage should trigger
	// a pushState call to firehose handlers
	pushStateFilter func(m gregor.Message) bool

	shutdownCh  chan struct{}
	broadcastCh chan gregor1.Message

	// Testing
	testingEvents       *testingEvents
	transportForTesting *connTransport
}

var _ libkb.GregorDismisser = (*gregorHandler)(nil)
var _ libkb.GregorListener = (*gregorHandler)(nil)

type gregorLocalDb struct {
	libkb.Contextified
}

func newLocalDB(g *libkb.GlobalContext) *gregorLocalDb {
	return &gregorLocalDb{
		Contextified: libkb.NewContextified(g),
	}
}

func dbKey(u gregor.UID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBGregor, Key: hex.EncodeToString(u.Bytes())}
}

func (db *gregorLocalDb) Store(u gregor.UID, b []byte) error {
	return db.G().LocalDb.PutRaw(dbKey(u), b)
}

func (db *gregorLocalDb) Load(u gregor.UID) (res []byte, e error) {
	res, _, err := db.G().LocalDb.GetRaw(dbKey(u))
	return res, err
}

func newGregorHandler(g *globals.Context) *gregorHandler {
	gh := &gregorHandler{
		Contextified:    globals.NewContextified(g),
		DebugLabeler:    utils.NewDebugLabeler(g, "PushHandler", false),
		freshReplay:     true,
		pushStateFilter: func(m gregor.Message) bool { return true },
		badger:          nil,
		chatHandler:     chat.NewPushHandler(g),
		broadcastCh:     make(chan gregor1.Message, 10000),
	}

	// Attempt to create a gregor client initially, if we are not logged in
	// or don't have user/device info in G, then this won't work
	if err := gh.resetGregorClient(); err != nil {
		g.Log.Warning("unable to create push service client: %s", err)
	}

	// Start broadcast handler goroutine
	go gh.broadcastMessageHandler()

	return gh
}

func (g *gregorHandler) GetClient() rpc.GenericClient {
	return g.cli
}

func (g *gregorHandler) resetGregorClient() (err error) {
	defer g.G().Trace("gregorHandler#newGregorClient", func() error { return err })()
	of := gregor1.ObjFactory{}
	sm := storage.NewMemEngine(of, clockwork.NewRealClock())
	ctx := context.Background()

	var guid gregor.UID
	var gdid gregor.DeviceID
	var b []byte

	uid := g.G().Env.GetUID()
	if !uid.Exists() {
		err = errors.New("no UID; probably not logged in")
		return err
	}
	if b = uid.ToBytes(); b == nil {
		err = errors.New("Can't convert UID to byte array")
		return err
	}
	if guid, err = of.MakeUID(b); err != nil {
		return err
	}

	did := g.G().Env.GetDeviceID()
	if !did.Exists() {
		err = errors.New("no device ID; probably not logged in")
		return err
	}
	if b, err = hex.DecodeString(did.String()); err != nil {
		return err
	}
	if gdid, err = of.MakeDeviceID(b); err != nil {
		return err
	}

	// Create client object
	gcli := grclient.NewClient(guid, gdid, sm, newLocalDB(g.G().ExternalG()),
		g.G().Env.GetGregorSaveInterval(), g.G().Log)

	// Bring up local state
	g.Debug(ctx, "restoring state from leveldb")
	if err = gcli.Restore(); err != nil {
		// If this fails, we'll keep trying since the server can bail us out
		g.Debug(ctx, "restore local state failed: %s", err)
	}

	g.gregorCli = gcli
	return nil
}

func (g *gregorHandler) getGregorCli() (*grclient.Client, error) {
	if g.gregorCli == nil {
		return nil, errors.New("client unset")
	}
	return g.gregorCli, nil
}

func (g *gregorHandler) getRPCCli() rpc.GenericClient {
	return g.cli
}

func (g *gregorHandler) Warning(s string, args ...interface{}) {
	g.G().Log.Warning("PushHandler: "+s, args...)
}

func (g *gregorHandler) Errorf(s string, args ...interface{}) {
	g.G().Log.Errorf("PushHandler: "+s, args...)
}

func (g *gregorHandler) SetPushStateFilter(f func(m gregor.Message) bool) {
	g.pushStateFilter = f
}

func (g *gregorHandler) setReachability(r *reachability) {
	g.reachability = r
}

func (g *gregorHandler) Connect(uri *rpc.FMPURI) (err error) {

	defer g.G().Trace("gregorHandler#Connect", func() error { return err })()

	// Create client interface to gregord; the user needs to be logged in for this
	// to work
	if err = g.resetGregorClient(); err != nil {
		return err
	}

	// In case we need to interrupt auth'ing or the ping loop,
	// set up this channel.
	g.shutdownCh = make(chan struct{})

	g.uri = uri
	if uri.UseTLS() {
		err = g.connectTLS()
	} else {
		err = g.connectNoTLS()
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

	g.G().Log.Debug("pushing inband handler %s to position %d", handler.Name(), len(g.ibmHandlers))

	g.ibmHandlers = append(g.ibmHandlers, handler)

	// Only try replaying if we are logged in, it's possible that a handler can
	// attach before that is true (like if we start the service logged out and
	// Electron connects)
	if g.IsConnected() {
		if _, err := g.replayInBandMessages(context.TODO(), gregor1.IncomingClient{Cli: g.cli},
			time.Time{}, handler); err != nil {
			g.Errorf("replayInBandMessages on PushHandler failed: %s", err)
		}

		if g.badger != nil {
			s, err := g.getState()
			if err != nil {
				g.Warning("Cannot get state in PushHandler: %s", err)
				return
			}
			g.badger.PushState(s)
		}
	}
}

// PushFirehoseHandler pushes a new firehose handler onto the list of currently
// active firehose handles. We can have several of these active at once. All
// get the "firehose" of gregor events. They're removed lazily as their underlying
// connections die.
func (g *gregorHandler) PushFirehoseHandler(handler libkb.GregorFirehoseHandler) {
	g.Lock()
	defer g.Unlock()
	g.firehoseHandlers = append(g.firehoseHandlers, handler)

	s, err := g.getState()
	if err != nil {
		g.Warning("Cannot push state in firehose handler: %s", err)
		return
	}
	handler.PushState(s, keybase1.PushReason_RECONNECTED)
}

// iterateOverFirehoseHandlers applies the function f to all live fireshose handlers
// and then resets the list to only include the live ones.
func (g *gregorHandler) iterateOverFirehoseHandlers(f func(h libkb.GregorFirehoseHandler)) {
	var freshHandlers []libkb.GregorFirehoseHandler
	for _, h := range g.firehoseHandlers {
		if h.IsAlive() {
			f(h)
			freshHandlers = append(freshHandlers, h)
		}
	}
	g.firehoseHandlers = freshHandlers
	return
}

func (g *gregorHandler) pushState(r keybase1.PushReason) {
	s, err := g.getState()
	if err != nil {
		g.Warning("Cannot push state in firehose handler: %s", err)
		return
	}
	g.iterateOverFirehoseHandlers(func(h libkb.GregorFirehoseHandler) { h.PushState(s, r) })

	if g.badger != nil {
		g.badger.PushState(s)
	}
}

func (g *gregorHandler) pushOutOfBandMessages(m []gregor1.OutOfBandMessage) {
	g.iterateOverFirehoseHandlers(func(h libkb.GregorFirehoseHandler) { h.PushOutOfBandMessages(m) })
}

// replayInBandMessages will replay all the messages in the current state from
// the given time. If a handler is specified, it will only replay using it,
// otherwise it will try all of them. gregorHandler needs to be locked when calling
// this function.
func (g *gregorHandler) replayInBandMessages(ctx context.Context, cli gregor1.IncomingInterface,
	t time.Time, handler libkb.GregorInBandMessageHandler) ([]gregor.InBandMessage, error) {

	var msgs []gregor.InBandMessage
	var err error

	gcli, err := g.getGregorCli()
	if err != nil {
		return nil, err
	}

	if t.IsZero() {
		g.Debug(ctx, "replayInBandMessages: fresh replay: using state items")
		state, err := gcli.StateMachineState(nil)
		if err != nil {
			g.Debug(ctx, "unable to fetch state for replay: %s", err)
			return nil, err
		}
		if msgs, err = gcli.InBandMessagesFromState(state); err != nil {
			g.Debug(ctx, "unable to fetch messages from state for replay: %s", err)
			return nil, err
		}
	} else {
		g.Debug(ctx, "replayInBandMessages: incremental replay: using ibms since")
		if msgs, err = gcli.StateMachineInBandMessagesSince(t); err != nil {
			g.Debug(ctx, "unable to fetch messages for replay: %s", err)
			return nil, err
		}
	}

	g.Debug(ctx, "replaying %d messages", len(msgs))
	for _, msg := range msgs {
		// If we have a handler, just run it on that, otherwise run it against
		// all of the handlers we know about
		if handler == nil {
			err = g.handleInBandMessage(ctx, cli, msg)
		} else {
			_, err = g.handleInBandMessageWithHandler(ctx, cli, msg, handler)
		}

		// If an error happens when replaying, don't kill everything else that
		// follows, just make a warning.
		if err != nil {
			g.Debug(ctx, "Failure in message replay: %s", err.Error())
			err = nil
		}
	}

	return msgs, nil
}

func (g *gregorHandler) IsConnected() bool {
	g.connMutex.Lock()
	defer g.connMutex.Unlock()
	return g.conn != nil && g.conn.IsConnected()
}

// serverSync is called from
// gregord. This can happen either on initial startup, or after a reconnect. Needs
// to be called with gregorHandler locked.
func (g *gregorHandler) serverSync(ctx context.Context,
	cli gregor1.IncomingInterface, gcli *grclient.Client, syncRes *chat1.SyncAllNotificationRes) ([]gregor.InBandMessage, []gregor.InBandMessage, error) {

	// Get time of the last message we synced (unless this is our first time syncing)
	var t time.Time
	if !g.freshReplay {
		pt := gcli.StateMachineLatestCTime()
		if pt != nil {
			t = *pt
		}
		g.Debug(ctx, "serverSync: starting replay from: %s", t)
	} else {
		g.Debug(ctx, "serverSync: performing a fresh replay")
	}

	// Sync down everything from the server
	consumedMsgs, err := gcli.Sync(cli, syncRes)
	if err != nil {
		g.Debug(ctx, "serverSync: error syncing from the server, reason: %s", err)
		return nil, nil, err
	}

	// Replay in-band messages
	replayedMsgs, err := g.replayInBandMessages(ctx, cli, t, nil)
	if err != nil {
		g.Errorf("replay messages failed: %s", err)
		return nil, nil, err
	}

	// All done with fresh replays
	g.freshReplay = false

	g.pushState(keybase1.PushReason_RECONNECTED)
	return replayedMsgs, consumedMsgs, nil
}

func (g *gregorHandler) makeReconnectOobm() gregor1.Message {
	return gregor1.Message{
		Oobm_: &gregor1.OutOfBandMessage{
			System_: "internal.reconnect",
		},
	}
}

func (g *gregorHandler) authParams(ctx context.Context) (uid gregor1.UID, token gregor1.SessionToken, err error) {
	var ok bool
	var stoken string
	var kuid keybase1.UID
	if kuid, stoken, ok = g.loggedIn(ctx); !ok {
		g.skipRetryConnect = true
		return uid, token, errors.New("not logged in for auth")
	}
	return kuid.ToBytes(), gregor1.SessionToken(stoken), nil
}

func (g *gregorHandler) inboxParams(ctx context.Context, uid gregor1.UID) chat1.InboxVers {
	// Grab current on disk version
	ibox := chatstorage.NewInbox(g.G(), uid)
	vers, err := ibox.Version(ctx)
	if err != nil {
		g.Debug(ctx, "inboxParams: failed to get current inbox version (using 0): %s", err.Error())
		vers = chat1.InboxVers(0)
	}
	return vers
}

func (g *gregorHandler) notificationParams(ctx context.Context, gcli *grclient.Client) (t gregor1.Time) {
	pt := gcli.StateMachineLatestCTime()
	if pt != nil {
		t = gregor1.ToTime(*pt)
	}
	g.Debug(ctx, "notificationParams: latest ctime: %s", t)
	return t
}

// OnConnect is called by the rpc library to indicate we have connected to
// gregord
func (g *gregorHandler) OnConnect(ctx context.Context, conn *rpc.Connection,
	cli rpc.GenericClient, srv *rpc.Server) error {
	g.Lock()
	defer g.Unlock()

	timeoutCli := WrapGenericClientWithTimeout(cli, GregorRequestTimeout, chat.ErrChatServerTimeout)
	chatCli := chat1.RemoteClient{Cli: cli}

	g.Debug(ctx, "connected")
	if err := srv.Register(gregor1.OutgoingProtocol(g)); err != nil {
		return fmt.Errorf("error registering protocol: %s", err.Error())
	}

	// Grab authentication and sync params
	gcli, err := g.getGregorCli()
	if err != nil {
		return fmt.Errorf("failed to get gregor client: %s", err.Error())
	}
	uid, token, err := g.authParams(ctx)
	if err != nil {
		return fmt.Errorf("unable to obtain auth params: %s", err.Error())
	}
	iboxVers := g.inboxParams(ctx, uid)
	latestCtime := g.notificationParams(ctx, gcli)

	// Run SyncAll to both authenticate, and grab all the data we will need to run the
	// various resync procedures for chat and notifications
	syncAllRes, err := chatCli.SyncAll(ctx, chat1.SyncAllArg{
		Uid:       uid,
		DeviceID:  gcli.Device.(gregor1.DeviceID),
		Session:   token,
		InboxVers: iboxVers,
		Ctime:     latestCtime,
	})
	if err != nil {
		return fmt.Errorf("error running SyncAll: %s", err.Error())
	}

	// Use the client parameter instead of conn.GetClient(), since we can get stuck
	// in a recursive loop if we keep retrying on reconnect.
	if err := g.auth(ctx, timeoutCli, &syncAllRes.Auth); err != nil {
		return fmt.Errorf("error authenticating: %s", err.Error())
	}

	// Sync chat data using a Syncer object
	if err := g.G().Syncer.Connected(ctx, chatCli, uid, &syncAllRes.Chat); err != nil {
		return fmt.Errorf("error running chat sync: %s", err.Error())
	}

	// Sync down events since we have been dead
	replayedMsgs, consumedMsgs, err := g.serverSync(ctx, gregor1.IncomingClient{Cli: timeoutCli}, gcli,
		&syncAllRes.Notification)
	if err != nil {
		g.Debug(ctx, "sync failure: %s", err)
	} else {
		g.Debug(ctx, "sync success: replayed: %d consumed: %d", len(replayedMsgs), len(consumedMsgs))
	}

	// Sync badge state in the background
	if g.badger != nil {
		go func(badger *badges.Badger) {
			badger.Resync(context.Background(), &chat1.RemoteClient{Cli: g.cli}, &syncAllRes.Badge)
		}(g.badger)
	}

	// Call out to reachability module if we have one
	if g.reachability != nil {
		g.reachability.setReachability(keybase1.Reachability{
			Reachable: keybase1.Reachable_YES,
		})
	}

	// Broadcast reconnect oobm. Spawn this off into a goroutine so that we don't delay
	// reconnection any longer than we have to.
	go func(m gregor1.Message) {
		g.BroadcastMessage(context.Background(), m)
	}(g.makeReconnectOobm())

	return nil
}

func (g *gregorHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
	g.Debug(context.Background(), "connect error %s, reconnect throttle duration: %s", err, reconnectThrottleDuration)

	// Call out to reachability module if we have one
	if g.reachability != nil {
		g.reachability.setReachability(keybase1.Reachability{
			Reachable: keybase1.Reachable_NO,
		})
	}
}

func (g *gregorHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
	g.Debug(context.Background(), "disconnected: %v", status)

	// Call out to reachability module if we have one (and we are currently connected)
	if g.reachability != nil && status != rpc.StartingFirstConnection {
		g.reachability.setReachability(keybase1.Reachability{
			Reachable: keybase1.Reachable_NO,
		})
	}

	// Alert chat syncer that we are now disconnected
	g.G().Syncer.Disconnected(ctx)
}

func (g *gregorHandler) OnDoCommandError(err error, nextTime time.Duration) {
	g.Debug(context.Background(), "do command error: %s, nextTime: %s", err, nextTime)
}

func (g *gregorHandler) ShouldRetry(name string, err error) bool {
	g.Debug(context.Background(), "should retry: name %s, err %v (returning false)", name, err)
	return false
}

func (g *gregorHandler) ShouldRetryOnConnect(err error) bool {
	if err == nil {
		return false
	}

	ctx := context.Background()
	g.Debug(ctx, "should retry on connect, err %v", err)
	if g.skipRetryConnect {
		g.Debug(ctx, "should retry on connect, skip retry flag set, returning false")
		g.skipRetryConnect = false
		return false
	}

	return true
}

func (g *gregorHandler) broadcastMessageOnce(ctx context.Context, m gregor1.Message) error {
	g.Lock()
	defer g.Unlock()

	// Handle the message
	var obm gregor.OutOfBandMessage
	ibm := m.ToInBandMessage()
	if ibm != nil {
		gcli, err := g.getGregorCli()
		if err != nil {
			g.Debug(ctx, "BroadcastMessage: failed to get Gregor client: %s", err.Error())
			return err
		}
		// Check to see if this is already in our state
		msgID := ibm.Metadata().MsgID()
		state, err := gcli.StateMachineState(nil)
		if err != nil {
			g.Debug(ctx, "BroadcastMessage: no state machine available: %s", err.Error())
			return err
		}
		if _, ok := state.GetItem(msgID); ok {
			g.Debug(ctx, "BroadcastMessage: msgID: %s already in state, ignoring", msgID)
			return errors.New("ignored repeat message")
		}

		g.Debug(ctx, "broadcast: in-band message: msgID: %s Ctime: %s", msgID, ibm.Metadata().CTime())
		err = g.handleInBandMessage(ctx, gregor1.IncomingClient{Cli: g.cli}, ibm)

		// Send message to local state machine
		gcli.StateMachineConsumeMessage(m)

		// Forward to electron or whichever UI is listening for the new gregor state
		if g.pushStateFilter(m) {
			g.pushState(keybase1.PushReason_NEW_DATA)
		}

		return err
	}

	obm = m.ToOutOfBandMessage()
	if obm != nil {
		g.Debug(ctx, "broadcast: out-of-band message: uid: %s",
			m.ToOutOfBandMessage().UID())
		if err := g.handleOutOfBandMessage(ctx, obm); err != nil {
			g.Debug(ctx, "BroadcastMessage: error handling oobm: %s", err.Error())
			return err
		}
		return nil
	}

	g.Debug(ctx, "BroadcastMessage: both in-band and out-of-band message nil")
	return errors.New("invalid message, no ibm or oobm")
}

func (g *gregorHandler) broadcastMessageHandler() {
	ctx := context.Background()
	for {
		m := <-g.broadcastCh
		err := g.broadcastMessageOnce(ctx, m)

		// Testing alerts
		if g.testingEvents != nil {
			g.testingEvents.broadcastSentCh <- err
		}
	}
}

// BroadcastMessage is called when we receive a new messages from gregord. Grabs
// the lock protect the state machine and handleInBandMessage
func (g *gregorHandler) BroadcastMessage(ctx context.Context, m gregor1.Message) error {
	// Send the message on a channel so we can return to Gregor as fast as possible. Note
	// that this can block, but broadcastCh has a large buffer to try and mitigate
	g.broadcastCh <- m
	return nil
}

// handleInBandMessage runs a message on all the alive handlers. gregorHandler
// must be locked when calling this function.
func (g *gregorHandler) handleInBandMessage(ctx context.Context, cli gregor1.IncomingInterface,
	ibm gregor.InBandMessage) (err error) {

	defer g.G().Trace(fmt.Sprintf("gregorHandler#handleInBandMessage with %d handlers", len(g.ibmHandlers)), func() error { return err })()

	var freshHandlers []libkb.GregorInBandMessageHandler

	// Loop over all handlers and run the messages against any that are alive
	// If the handler is not alive, we prune it from our list
	for i, handler := range g.ibmHandlers {
		g.Debug(ctx, "trying handler %s at position %d", handler.Name(), i)
		if handler.IsAlive() {
			if handled, err := g.handleInBandMessageWithHandler(ctx, cli, ibm, handler); err != nil {
				if handled {
					// Don't stop handling errors on a first failure.
					g.Errorf("failed to run %s handler: %s", handler.Name(), err)
				} else {
					g.Debug(ctx, "handleInBandMessage() failed to run %s handler: %s", handler.Name(), err)
				}
			}
			freshHandlers = append(freshHandlers, handler)
		} else {
			g.Debug(ctx, "skipping handler as it's marked dead: %s", handler.Name())
		}
	}

	if len(g.ibmHandlers) != len(freshHandlers) {
		g.Debug(ctx, "Change # of live handlers from %d to %d", len(g.ibmHandlers), len(freshHandlers))
		g.ibmHandlers = freshHandlers
	}
	return nil
}

// handleInBandMessageWithHandler runs a message against the specified handler
func (g *gregorHandler) handleInBandMessageWithHandler(ctx context.Context, cli gregor1.IncomingInterface,
	ibm gregor.InBandMessage, handler libkb.GregorInBandMessageHandler) (bool, error) {
	g.Debug(ctx, "handleInBand: %+v", ibm)

	gcli, err := g.getGregorCli()
	if err != nil {
		return false, err
	}
	state, err := gcli.StateMachineState(nil)
	if err != nil {
		return false, err
	}

	sync := ibm.ToStateSyncMessage()
	if sync != nil {
		g.Debug(ctx, "state sync message")
		return false, nil
	}

	update := ibm.ToStateUpdateMessage()
	if update != nil {
		g.Debug(ctx, "state update message")

		item := update.Creation()
		if item != nil {
			id := item.Metadata().MsgID().String()
			g.Debug(ctx, "msg ID %s created ctime: %s", id,
				item.Metadata().CTime())

			category := ""
			if item.Category() != nil {
				category = item.Category().String()
				g.Debug(ctx, "item %s has category %s", id, category)
			}

			if handled, err := handler.Create(ctx, cli, category, item); err != nil {
				return handled, err
			}
		}

		dismissal := update.Dismissal()
		if dismissal != nil {
			g.Debug(ctx, "received dismissal")
			for _, id := range dismissal.MsgIDsToDismiss() {
				item, present := state.GetItem(id)
				if !present {
					g.Debug(ctx, "tried to dismiss item %s, not present", id.String())
					continue
				}
				g.Debug(ctx, "dismissing item %s", id.String())

				category := ""
				if item.Category() != nil {
					category = item.Category().String()
					g.Debug(ctx, "dismissal %s has category %s", id, category)
				}

				if handled, err := handler.Dismiss(ctx, cli, category, item); handled && err != nil {
					return handled, err
				}
			}
			if len(dismissal.RangesToDismiss()) > 0 {
				g.Debug(ctx, "message range dismissing not implemented")
			}
		}

		return true, nil
	}

	return false, nil
}

func (h IdentifyUIHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string,
	item gregor.Item) (bool, error) {

	switch category {
	case "show_tracker_popup":
		return true, h.handleShowTrackerPopupCreate(ctx, cli, item)
	}

	return false, nil
}

func (h IdentifyUIHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string,
	item gregor.Item) (bool, error) {

	switch category {
	case "show_tracker_popup":
		return true, h.handleShowTrackerPopupDismiss(ctx, cli, item)
	}

	return false, nil
}

func (h IdentifyUIHandler) handleShowTrackerPopupCreate(ctx context.Context, cli gregor1.IncomingInterface,
	item gregor.Item) error {

	h.G().Log.Debug("handleShowTrackerPopupCreate: %+v", item)
	if item.Body() == nil {
		return errors.New("gregor handler for show_tracker_popup: nil message body")
	}
	body, err := jsonw.Unmarshal(item.Body().Bytes())
	if err != nil {
		h.G().Log.Debug("body failed to unmarshal", err)
		return err
	}
	uidString, err := body.AtPath("uid").GetString()
	if err != nil {
		h.G().Log.Debug("failed to extract uid", err)
		return err
	}
	uid, err := keybase1.UIDFromString(uidString)
	if err != nil {
		h.G().Log.Debug("failed to convert UID from string", err)
		return err
	}

	identifyUI, err := h.G().UIRouter.GetIdentifyUI()
	if err != nil {
		h.G().Log.Debug("failed to get IdentifyUI", err)
		return err
	}
	if identifyUI == nil {
		h.G().Log.Debug("got nil IdentifyUI")
		return errors.New("got nil IdentifyUI")
	}
	secretUI, err := h.G().UIRouter.GetSecretUI(0)
	if err != nil {
		h.G().Log.Debug("failed to get SecretUI", err)
		return err
	}
	if secretUI == nil {
		h.G().Log.Debug("got nil SecretUI")
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
	identifyEng.SetResponsibleGregorItem(item)
	return identifyEng.Run(&engineContext)
}

func (h IdentifyUIHandler) handleShowTrackerPopupDismiss(ctx context.Context, cli gregor1.IncomingInterface,
	item gregor.Item) error {

	h.G().Log.Debug("handleShowTrackerPopupDismiss: %+v", item)
	if item.Body() == nil {
		return errors.New("gregor dismissal for show_tracker_popup: nil message body")
	}
	body, err := jsonw.Unmarshal(item.Body().Bytes())
	if err != nil {
		h.G().Log.Debug("body failed to unmarshal", err)
		return err
	}
	uidString, err := body.AtPath("uid").GetString()
	if err != nil {
		h.G().Log.Debug("failed to extract uid", err)
		return err
	}
	uid, err := keybase1.UIDFromString(uidString)
	if err != nil {
		h.G().Log.Debug("failed to convert UID from string", err)
		return err
	}
	user, err := libkb.LoadUser(libkb.NewLoadUserByUIDArg(ctx, h.G(), uid))
	if err != nil {
		h.G().Log.Debug("failed to load user from UID", err)
		return err
	}

	identifyUI, err := h.G().UIRouter.GetIdentifyUI()
	if err != nil {
		h.G().Log.Debug("failed to get IdentifyUI", err)
		return err
	}
	if identifyUI == nil {
		h.G().Log.Debug("got nil IdentifyUI")
		return errors.New("got nil IdentifyUI")
	}

	reason := keybase1.DismissReason{
		Type: keybase1.DismissReasonType_HANDLED_ELSEWHERE,
	}
	identifyUI.Dismiss(user.GetName(), reason)

	return nil
}

func (g *gregorHandler) handleOutOfBandMessage(ctx context.Context, obm gregor.OutOfBandMessage) error {
	if obm.System() == nil {
		return errors.New("nil system in out of band message")
	}

	if tmp, ok := obm.(gregor1.OutOfBandMessage); ok {
		g.pushOutOfBandMessages([]gregor1.OutOfBandMessage{tmp})
	} else {
		g.G().Log.Warning("Got non-exportable out-of-band message")
	}

	switch obm.System().String() {
	case "kbfs.favorites":
		return g.kbfsFavorites(ctx, obm)
	case "chat.activity":
		return g.chatHandler.Activity(ctx, obm, g.badger)
	case "chat.tlffinalize":
		return g.chatHandler.TlfFinalize(ctx, obm)
	case "chat.tlfresolve":
		return g.chatHandler.TlfResolve(ctx, obm)
	case "internal.reconnect":
		g.G().Log.Debug("reconnected to push server")
		return nil
	default:
		return fmt.Errorf("unhandled system: %s", obm.System())
	}
}

func (g *gregorHandler) Shutdown() {
	g.Debug(context.Background(), "shutdown")
	g.connMutex.Lock()
	defer g.connMutex.Unlock()

	if g.conn == nil {
		return
	}
	close(g.shutdownCh)
	g.conn.Shutdown()
	g.conn = nil
}

func (g *gregorHandler) Reset() error {
	g.Shutdown()
	return g.resetGregorClient()
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

func (g *gregorHandler) loggedIn(ctx context.Context) (uid keybase1.UID, token string, ok bool) {
	ok = false

	// Check to see if we have been shutdown,
	select {
	case <-g.shutdownCh:
		return uid, token, ok
	default:
		// if we were going to block, then that means we are still alive
	}

	// Continue on and authenticate
	aerr := g.G().LoginState().Account(func(a *libkb.Account) {
		in, err := a.LoggedInLoad()
		if err != nil {
			g.G().Log.Debug("gregorHandler loggedIn check: LoggedInLoad error: %s", err)
			return
		}
		if !in {
			g.G().Log.Debug("gregorHandler loggedIn check: not logged in")
			return
		}
		g.G().Log.Debug("gregorHandler: logged in, getting token and uid")
		token = a.LocalSession().GetToken()
		uid = a.LocalSession().GetUID()
	}, "gregor handler - login session")
	if token == "" || uid == "" {
		return uid, token, ok
	}
	if aerr != nil {
		return uid, token, ok
	}

	return uid, token, true
}

func (g *gregorHandler) auth(ctx context.Context, cli rpc.GenericClient, auth *gregor1.AuthResult) (err error) {
	var token string
	var ok bool
	var uid keybase1.UID

	if uid, token, ok = g.loggedIn(ctx); !ok {
		g.skipRetryConnect = true
		return errors.New("not logged in for auth")
	}

	if auth == nil {
		g.Debug(ctx, "logged in: authenticating")
		ac := gregor1.AuthClient{Cli: cli}
		auth = new(gregor1.AuthResult)
		*auth, err = ac.AuthenticateSessionToken(ctx, gregor1.SessionToken(token))
		if err != nil {
			g.Debug(ctx, "auth error: %s", err)
			return err
		}
	} else {
		g.Debug(ctx, "using previously obtained auth result")
	}

	g.Debug(ctx, "auth result: %+v", *auth)
	if !bytes.Equal(auth.Uid, uid.ToBytes()) {
		g.skipRetryConnect = true
		return fmt.Errorf("auth result uid %x doesn't match session uid %q", auth.Uid, uid)
	}
	g.sessionID = auth.Sid

	return nil
}

func (g *gregorHandler) isReachable() bool {
	ctx := context.Background()
	timeout := g.G().Env.GetGregorPingTimeout()
	url, err := url.Parse(g.G().Env.GetGregorURI())
	if err != nil {
		g.Debug(ctx, "isReachable: failed to parse server uri, exiting: %s", err.Error())
		return false
	}

	// If we currently think we are online, then make sure
	conn, err := net.DialTimeout("tcp", url.Host, timeout)
	if conn != nil {
		conn.Close()
		return true
	}
	if err != nil {
		g.Debug(ctx, "isReachable: error: terminating connection: %s", err.Error())
		if err := g.Reconnect(ctx); err != nil {
			g.Debug(ctx, "isReachable: error reconnecting: %s", err.Error())
		}
		return false
	}

	return true
}

func (g *gregorHandler) Reconnect(ctx context.Context) error {
	if g.IsConnected() {
		g.Debug(ctx, "Reconnect: reconnecting to server")
		g.reachability.setReachability(keybase1.Reachability{
			Reachable: keybase1.Reachable_NO,
		})
		g.Shutdown()
		return g.Connect(g.uri)
	}

	g.Debug(ctx, "Reconnect: skipping reconnect, already disconnected")
	return nil
}

func (g *gregorHandler) pingLoop() {

	ctx := context.Background()
	id, _ := libkb.RandBytes(4)
	duration := g.G().Env.GetGregorPingInterval()
	timeout := g.G().Env.GetGregorPingTimeout()
	url, err := url.Parse(g.G().Env.GetGregorURI())
	if err != nil {
		g.Debug(ctx, "ping loop: failed to parse server uri, exiting: %s", err.Error())
		return
	}

	g.Debug(ctx, "ping loop: starting up: id: %x duration: %v timeout: %v url: %s",
		id, duration, timeout, url.Host)
	defer g.Debug(ctx, "ping loop: id: %x terminating", id)

	for {
		ctx, shutdownCancel := context.WithCancel(context.Background())
		select {
		case <-g.G().Clock().After(duration):
			var err error

			doneCh := make(chan error)
			go func(ctx context.Context) {
				if g.IsConnected() {
					// If we are connected, subject the ping call to a fairly
					// aggressive timeout so our chat stuff can be responsive
					// to changes in connectivity
					var timeoutCancel context.CancelFunc
					var timeoutCtx context.Context
					timeoutCtx, timeoutCancel = context.WithTimeout(ctx, timeout)
					_, err = gregor1.IncomingClient{Cli: g.pingCli}.Ping(timeoutCtx)
					timeoutCancel()
				} else {
					// If we are not connected, we don't want to timeout anything
					// Just hook into the normal reconnect chan stuff in the RPC
					// library
					g.Debug(ctx, "ping loop: id: %x normal ping, not connected", id)
					_, err = gregor1.IncomingClient{Cli: g.pingCli}.Ping(ctx)
				}
				select {
				case <-ctx.Done():
					g.Debug(ctx, "ping loop: id: %x context cancelled, so not sending err", id)
				default:
					doneCh <- err
				}
			}(ctx)

			select {
			case err = <-doneCh:
			case <-g.shutdownCh:
				g.Debug(ctx, "ping loop: id: %x shutdown received", id)
				shutdownCancel()
				return
			}
			if err != nil {
				g.Debug(ctx, "ping loop: id: %x error: %s", id, err.Error())
				if err == context.DeadlineExceeded {
					g.Debug(ctx, "ping loop: timeout: terminating connection")
					if err := g.Reconnect(ctx); err != nil {
						g.Debug(ctx, "ping loop: id: %x error reconnecting: %s", id, err.Error())
					}
					shutdownCancel()
					return
				}
			}
		case <-g.shutdownCh:
			g.Debug(ctx, "ping loop: id: %x shutdown received", id)
			shutdownCancel()
			return
		}
		shutdownCancel()
	}
}

func (g *gregorHandler) connectTLS() error {
	g.connMutex.Lock()
	defer g.connMutex.Unlock()

	ctx := context.Background()
	if g.conn != nil {
		g.Debug(ctx, "skipping connect, conn is not nil")
		return nil
	}

	uri := g.uri
	g.Debug(ctx, "connecting to gregord via TLS at %s", uri)
	rawCA := g.G().Env.GetBundledCA(uri.Host)
	if len(rawCA) == 0 {
		return fmt.Errorf("No bundled CA for %s", uri.Host)
	}
	g.Debug(ctx, "Using CA for gregor: %s", libkb.ShortCA(rawCA))

	constBackoff := backoff.NewConstantBackOff(GregorConnectionRetryInterval)
	opts := rpc.ConnectionOpts{
		TagsFunc:         logger.LogTagsFromContextRPC,
		WrapErrorFunc:    libkb.WrapError,
		ReconnectBackoff: func() backoff.BackOff { return constBackoff },
	}
	g.conn = rpc.NewTLSConnection(uri.HostPort, []byte(rawCA), libkb.ErrorUnwrapper{}, g, libkb.NewRPCLogFactory(g.G().ExternalG()), g.G().Log, opts)

	// The client we get here will reconnect to gregord on disconnect if necessary.
	// We should grab it here instead of in OnConnect, since the connection is not
	// fully established in OnConnect. Anything that wants to make calls outside
	// of OnConnect should use g.cli, everything else should the client that is
	// a paramater to OnConnect
	g.cli = WrapGenericClientWithTimeout(g.conn.GetClient(), GregorRequestTimeout,
		chat.ErrChatServerTimeout)
	g.pingCli = g.conn.GetClient() // Don't want this to have a timeout from here

	// Start up ping loop to keep the connection to gregord alive, and to kick
	// off the reconnect logic in the RPC library
	go g.pingLoop()

	return nil
}

func (g *gregorHandler) connectNoTLS() error {
	g.connMutex.Lock()
	defer g.connMutex.Unlock()

	ctx := context.Background()
	if g.conn != nil {
		g.Debug(ctx, "skipping connect, conn is not nil")
		return nil
	}
	uri := g.uri
	g.Debug(ctx, "connecting to gregord without TLS at %s", uri)
	t := newConnTransport(g.G().ExternalG(), uri.HostPort)
	g.transportForTesting = t

	constBackoff := backoff.NewConstantBackOff(GregorConnectionRetryInterval)
	opts := rpc.ConnectionOpts{
		TagsFunc:         logger.LogTagsFromContextRPC,
		WrapErrorFunc:    libkb.WrapError,
		ReconnectBackoff: func() backoff.BackOff { return constBackoff },
	}
	g.conn = rpc.NewConnectionWithTransport(g, t, libkb.ErrorUnwrapper{}, g.G().Log, opts)

	g.cli = WrapGenericClientWithTimeout(g.conn.GetClient(), GregorRequestTimeout,
		chat.ErrChatServerTimeout)
	g.pingCli = g.conn.GetClient()

	// Start up ping loop to keep the connection to gregord alive, and to kick
	// off the reconnect logic in the RPC library
	go g.pingLoop()

	return nil
}

func NewGregorMsgID() (gregor1.MsgID, error) {
	r, err := libkb.RandBytes(16) // TODO: Create a shared function for this.
	if err != nil {
		return nil, err
	}
	return gregor1.MsgID(r), nil
}

func (g *gregorHandler) templateMessage() (*gregor1.Message, error) {
	uid := g.G().Env.GetUID()
	if uid.IsNil() {
		return nil, fmt.Errorf("Can't create new gregor items without a current UID.")
	}
	gregorUID := gregor1.UID(uid.ToBytes())

	newMsgID, err := NewGregorMsgID()
	if err != nil {
		return nil, err
	}

	return &gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   gregorUID,
					MsgID_: newMsgID,
				},
			},
		},
	}, nil
}

func (g *gregorHandler) DismissItem(id gregor.MsgID) error {
	if id == nil {
		return nil
	}
	var err error
	defer g.G().Trace(fmt.Sprintf("gregorHandler.DismissItem(%s)", id.String()),
		func() error { return err },
	)()

	dismissal, err := g.templateMessage()
	if err != nil {
		return err
	}

	dismissal.Ibm_.StateUpdate_.Dismissal_ = &gregor1.Dismissal{
		MsgIDs_: []gregor1.MsgID{gregor1.MsgID(id.Bytes())},
	}

	incomingClient := gregor1.IncomingClient{Cli: g.cli}
	// TODO: Should the interface take a context from the caller?
	err = incomingClient.ConsumeMessage(context.TODO(), *dismissal)
	return err
}

func (g *gregorHandler) InjectItem(cat string, body []byte) (gregor.MsgID, error) {
	var err error
	defer g.G().Trace(fmt.Sprintf("gregorHandler.InjectItem(%s)", cat),
		func() error { return err },
	)()

	creation, err := g.templateMessage()
	if err != nil {
		return nil, err
	}
	creation.Ibm_.StateUpdate_.Creation_ = &gregor1.Item{
		Category_: gregor1.Category(cat),
		Body_:     gregor1.Body(body),
	}

	incomingClient := gregor1.IncomingClient{Cli: g.cli}
	// TODO: Should the interface take a context from the caller?
	err = incomingClient.ConsumeMessage(context.TODO(), *creation)
	return creation.Ibm_.StateUpdate_.Md_.MsgID_, err
}

func (g *gregorHandler) InjectOutOfBandMessage(system string, body []byte) error {
	var err error
	defer g.G().Trace(fmt.Sprintf("gregorHandler.InjectOutOfBandMessage(%s)", system),
		func() error { return err },
	)()

	uid := g.G().Env.GetUID()
	if uid.IsNil() {
		err = fmt.Errorf("Can't create new gregor items without a current UID.")
		return err
	}
	gregorUID := gregor1.UID(uid.ToBytes())

	msg := gregor1.Message{
		Oobm_: &gregor1.OutOfBandMessage{
			Uid_:    gregorUID,
			System_: gregor1.System(system),
			Body_:   gregor1.Body(body),
		},
	}

	incomingClient := gregor1.IncomingClient{Cli: g.cli}
	// TODO: Should the interface take a context from the caller?
	err = incomingClient.ConsumeMessage(context.TODO(), msg)
	return err
}

func (g *gregorHandler) simulateCrashForTesting() {
	g.transportForTesting.Reset()
	gregor1.IncomingClient{Cli: g.cli}.Ping(context.Background())
}

type gregorRPCHandler struct {
	libkb.Contextified
	xp rpc.Transporter
	gh *gregorHandler
}

func newGregorRPCHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *gregorRPCHandler {
	return &gregorRPCHandler{
		Contextified: libkb.NewContextified(g),
		xp:           xp,
		gh:           gh,
	}
}

func (g *gregorHandler) getState() (res gregor1.State, err error) {
	var s gregor.State

	if g == nil || g.gregorCli == nil {
		return res, errors.New("gregor service not available (are you in standalone?)")
	}

	s, err = g.gregorCli.StateMachineState(nil)
	if err != nil {
		return res, err
	}

	ps, err := s.Export()
	if err != nil {
		return res, err
	}

	var ok bool
	if res, ok = ps.(gregor1.State); !ok {
		return res, errors.New("failed to convert state to exportable format")
	}

	return res, nil
}

func (g *gregorRPCHandler) GetState(_ context.Context) (res gregor1.State, err error) {
	return g.gh.getState()
}

func WrapGenericClientWithTimeout(client rpc.GenericClient, timeout time.Duration, timeoutErr error) rpc.GenericClient {
	return &timeoutClient{client, timeout, timeoutErr}
}

type timeoutClient struct {
	inner      rpc.GenericClient
	timeout    time.Duration
	timeoutErr error
}

var _ rpc.GenericClient = (*timeoutClient)(nil)

func (t *timeoutClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) error {
	var timeoutCancel context.CancelFunc
	ctx, timeoutCancel = context.WithTimeout(ctx, t.timeout)
	defer timeoutCancel()
	err := t.inner.Call(ctx, method, arg, res)
	if err == context.DeadlineExceeded {
		return t.timeoutErr
	}
	return err
}

func (t *timeoutClient) Notify(ctx context.Context, method string, arg interface{}) error {
	var timeoutCancel context.CancelFunc
	ctx, timeoutCancel = context.WithTimeout(ctx, t.timeout)
	defer timeoutCancel()
	err := t.inner.Notify(ctx, method, arg)
	if err == context.DeadlineExceeded {
		return t.timeoutErr
	}
	return err
}

type errorClient struct{}

var _ rpc.GenericClient = errorClient{}

func (e errorClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) error {
	return fmt.Errorf("errorClient: Call %s", method)
}

func (e errorClient) Notify(ctx context.Context, method string, arg interface{}) error {
	return fmt.Errorf("errorClient: Notify %s", method)
}
