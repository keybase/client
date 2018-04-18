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
const GregorConnectionShortRetryInterval time.Duration = 2 * time.Second
const GregorConnectionLongRetryInterval time.Duration = 10 * time.Second
const GregorGetClientTimeout time.Duration = 4 * time.Second
const slowConnSleepTime = 1 * time.Second

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
		cli:          keybase1.GregorUIClient{Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), nil)},
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

type testingReplayRes struct {
	replayed []gregor.InBandMessage
	err      error
}

type testingEvents struct {
	broadcastSentCh chan error
	replayThreadCh  chan testingReplayRes
}

func newTestingEvents() *testingEvents {
	return &testingEvents{
		broadcastSentCh: make(chan error),
		replayThreadCh:  make(chan testingReplayRes, 10),
	}
}

type connectionAuthError struct {
	msg         string
	shouldRetry bool
}

func newConnectionAuthError(msg string, shouldRetry bool) connectionAuthError {
	return connectionAuthError{
		msg:         msg,
		shouldRetry: shouldRetry,
	}
}

func (c connectionAuthError) ShouldRetry() bool {
	return c.shouldRetry
}

func (c connectionAuthError) Error() string {
	return fmt.Sprintf("connection auth error: msg: %s shouldRetry: %v", c.msg, c.shouldRetry)
}

type replayThreadArg struct {
	cli gregor1.IncomingInterface
	t   time.Time
	ctx context.Context
}

type gregorHandler struct {
	globals.Contextified

	// This lock is to protect ibmHandlers and gregorCli and firehoseHandlers. Only public methods
	// should grab it.
	sync.Mutex
	ibmHandlers      []libkb.GregorInBandMessageHandler
	gregorCli        *grclient.Client
	firehoseHandlers []libkb.GregorFirehoseHandler
	badger           *badges.Badger
	reachability     *reachability
	chatLog          utils.DebugLabeler

	// This mutex protects the con object
	connMutex sync.Mutex
	conn      *rpc.Connection
	uri       *rpc.FMPURI

	// connectHappened will be closed after gregor connection established
	connectHappened chan struct{}

	cli               rpc.GenericClient
	pingCli           rpc.GenericClient
	sessionID         gregor1.SessionID
	firstConnect      bool
	forceSessionCheck bool

	// Function for determining if a new BroadcastMessage should trigger
	// a pushState call to firehose handlers
	pushStateFilter func(m gregor.Message) bool

	shutdownCh  chan struct{}
	broadcastCh chan gregor1.Message
	replayCh    chan replayThreadArg

	// Testing
	testingEvents       *testingEvents
	transportForTesting *connTransport
}

var _ libkb.GregorDismisser = (*gregorHandler)(nil)
var _ libkb.GregorListener = (*gregorHandler)(nil)

func newGregorHandler(g *globals.Context) *gregorHandler {
	gh := &gregorHandler{
		Contextified:      globals.NewContextified(g),
		chatLog:           utils.NewDebugLabeler(g.GetLog(), "PushHandler", false),
		firstConnect:      true,
		pushStateFilter:   func(m gregor.Message) bool { return true },
		badger:            nil,
		broadcastCh:       make(chan gregor1.Message, 10000),
		forceSessionCheck: false,
		connectHappened:   make(chan struct{}),
		replayCh:          make(chan replayThreadArg, 10),
	}
	return gh
}

// Init starts all the background services for managing connection to Gregor
func (g *gregorHandler) Init() {
	// Attempt to create a gregor client initially, if we are not logged in
	// or don't have user/device info in G, then this won't work
	if err := g.resetGregorClient(context.TODO()); err != nil {
		g.Warning(context.Background(), "unable to create push service client: %s", err.Error())
	}

	// Start broadcast handler goroutine
	go g.broadcastMessageHandler()

	// Start the app state monitor thread
	go g.monitorAppState()

	// Start replay thread
	go g.syncReplayThread()
}

func (g *gregorHandler) monitorAppState() {
	// Wait for state updates and react accordingly
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-g.G().AppState.NextUpdate(&state)
		switch state {
		case keybase1.AppState_BACKGROUNDACTIVE:
			fallthrough
		case keybase1.AppState_FOREGROUND:
			// Make sure the URI is set before attempting this (possible it isn't in a race)
			if g.uri != nil {
				g.chatLog.Debug(context.Background(), "foregrounded, reconnecting")
				if err := g.Connect(g.uri); err != nil {
					g.chatLog.Debug(context.Background(), "error reconnecting")
				}
			}
		case keybase1.AppState_INACTIVE, keybase1.AppState_BACKGROUND:
			g.chatLog.Debug(context.Background(), "backgrounded, shutting down connection")
			g.Shutdown()
		}
	}
}

func (g *gregorHandler) GetURI() *rpc.FMPURI {
	return g.uri
}

func (g *gregorHandler) GetIncomingClient() gregor1.IncomingInterface {
	if g.IsShutdown() || g.cli == nil {
		return gregor1.IncomingClient{Cli: chat.OfflineClient{}}
	}
	return gregor1.IncomingClient{Cli: g.cli}
}

func (g *gregorHandler) GetClient() chat1.RemoteInterface {
	if g.IsShutdown() || g.cli == nil {
		select {
		case <-g.connectHappened:
			if g.IsShutdown() || g.cli == nil {
				g.chatLog.Debug(context.Background(), "GetClient: connectHappened, but still shutdown, using OfflineClient for chat1.RemoteClient")
				return chat1.RemoteClient{Cli: chat.OfflineClient{}}

			}
			g.chatLog.Debug(context.Background(), "GetClient: successfully waited for connection")
			return chat1.RemoteClient{Cli: chat.NewRemoteClient(g.G(), g.cli)}
		case <-time.After(GregorGetClientTimeout):
			g.chatLog.Debug(context.Background(), "GetClient: shutdown, using OfflineClient for chat1.RemoteClient (waited %s for connectHappened)", GregorGetClientTimeout)
			return chat1.RemoteClient{Cli: chat.OfflineClient{}}
		}
	}

	g.chatLog.Debug(context.Background(), "GetClient: not shutdown, making new remote client")
	return chat1.RemoteClient{Cli: chat.NewRemoteClient(g.G(), g.cli)}
}

func (g *gregorHandler) resetGregorClient(ctx context.Context) (err error) {
	defer g.G().Trace("gregorHandler#newGregorClient", func() error { return err })()
	of := gregor1.ObjFactory{}
	sm := storage.NewMemEngine(of, clockwork.NewRealClock(), g.G().Log)

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
	gcli := grclient.NewClient(guid, gdid, sm, storage.NewLocalDB(g.G().ExternalG()),
		g.G().Env.GetGregorSaveInterval(), g.G().Log)

	// Bring up local state
	g.Debug(ctx, "restoring state from leveldb")
	if err = gcli.Restore(ctx); err != nil {
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

func (g *gregorHandler) Debug(ctx context.Context, s string, args ...interface{}) {
	g.G().Log.CloneWithAddedDepth(1).CDebugf(ctx, "PushHandler: "+s, args...)
}

func (g *gregorHandler) Warning(ctx context.Context, s string, args ...interface{}) {
	g.G().Log.CloneWithAddedDepth(1).CWarningf(ctx, "PushHandler: "+s, args...)
}

func (g *gregorHandler) Errorf(ctx context.Context, s string, args ...interface{}) {
	g.G().Log.CloneWithAddedDepth(1).CErrorf(ctx, "PushHandler: "+s, args...)
}

func (g *gregorHandler) SetPushStateFilter(f func(m gregor.Message) bool) {
	g.pushStateFilter = f
}

func (g *gregorHandler) setReachability(r *reachability) {
	g.reachability = r
}

func (g *gregorHandler) Connect(uri *rpc.FMPURI) (err error) {

	defer g.G().Trace("gregorHandler#Connect", func() error { return err })()

	g.connMutex.Lock()
	defer g.connMutex.Unlock()

	defer func() {
		close(g.connectHappened)
		g.connectHappened = make(chan struct{})
	}()

	// Create client interface to gregord; the user needs to be logged in for this
	// to work
	if err = g.resetGregorClient(context.TODO()); err != nil {
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
	return "gregor"
}

// PushHandler adds a new ibm handler to our list. This is usually triggered
// when an external entity (like Electron) connects to the service, and we can
// safely send Gregor information to it
func (g *gregorHandler) PushHandler(handler libkb.GregorInBandMessageHandler) {
	defer g.chatLog.Trace(context.Background(), func() error { return nil }, "PushHandler")()

	g.G().Log.Debug("pushing inband handler %s to position %d", handler.Name(), len(g.ibmHandlers))

	g.Lock()
	g.ibmHandlers = append(g.ibmHandlers, handler)
	g.Unlock()

	// Only try replaying if we are logged in, it's possible that a handler can
	// attach before that is true (like if we start the service logged out and
	// Electron connects)
	if g.IsConnected() {
		if _, err := g.replayInBandMessages(context.TODO(), gregor1.IncomingClient{Cli: g.cli},
			time.Time{}, handler); err != nil {
			g.Errorf(context.Background(), "replayInBandMessages on PushHandler failed: %s", err)
		}

		if g.badger != nil {
			s, err := g.getState(context.Background())
			if err != nil {
				g.Warning(context.Background(), "Cannot get state in PushHandler: %s", err)
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
	defer g.chatLog.Trace(context.Background(), func() error { return nil }, "PushFirehoseHandler")()
	g.Lock()
	g.firehoseHandlers = append(g.firehoseHandlers, handler)
	g.Unlock()

	s, err := g.getState(context.Background())
	if err != nil {
		g.Warning(context.Background(), "Cannot push state in firehose handler: %s", err)
		return
	}
	handler.PushState(s, keybase1.PushReason_RECONNECTED)
}

// iterateOverFirehoseHandlers applies the function f to all live firehose handlers
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
	s, err := g.getState(context.Background())
	if err != nil {
		g.Warning(context.Background(), "Cannot push state in firehose handler: %s", err)
		return
	}
	g.iterateOverFirehoseHandlers(func(h libkb.GregorFirehoseHandler) { h.PushState(s, r) })

	// Only send this state update on reception of new data, not a reconnect since we will
	// be sending that on a different code path altogether (see OnConnect).
	if g.badger != nil && r != keybase1.PushReason_RECONNECTED {
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
		state, err := gcli.StateMachineState(ctx, nil, true)
		if err != nil {
			g.Debug(ctx, "replayInBandMessages: unable to fetch state for replay: %s", err)
			return nil, err
		}
		if msgs, err = gcli.InBandMessagesFromState(state); err != nil {
			g.Debug(ctx, "replayInBandMessages: unable to fetch messages from state for replay: %s", err)
			return nil, err
		}
	} else {
		g.Debug(ctx, "replayInBandMessages: incremental replay: using ibms since")
		if msgs, err = gcli.StateMachineInBandMessagesSince(ctx, t, true); err != nil {
			g.Debug(ctx, "replayInBandMessages: unable to fetch messages for replay: %s", err)
			return nil, err
		}
	}

	g.Debug(ctx, "replayInBandMessages: replaying %d messages", len(msgs))
	for _, msg := range msgs {
		g.Debug(ctx, "replayInBandMessages: replaying: %s", msg.Metadata().MsgID())
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
			g.Debug(ctx, "replayInBandMessages: failure in message replay: %s", err.Error())
			err = nil
		}
	}

	return msgs, nil
}

func (g *gregorHandler) IsShutdown() bool {
	g.connMutex.Lock()
	defer g.connMutex.Unlock()
	return g.conn == nil
}

func (g *gregorHandler) IsConnected() bool {
	defer g.chatLog.Trace(context.Background(), func() error { return nil }, "IsConnected")()
	g.connMutex.Lock()
	defer g.connMutex.Unlock()
	return g.conn != nil && g.conn.IsConnected()
}

func (g *gregorHandler) syncReplayThread() {
	for rarg := range g.replayCh {
		var trr testingReplayRes
		replayedMsgs, err := g.replayInBandMessages(rarg.ctx, rarg.cli, rarg.t, nil)
		if err != nil {
			g.Debug(rarg.ctx, "serverSync: replayThread: replay messages failed: %s", err)
			trr.err = err
		} else {
			g.Debug(rarg.ctx, "serverSync: replayThread: replayed %d messages", len(replayedMsgs))
			trr.replayed = replayedMsgs
		}
		if g.testingEvents != nil {
			g.testingEvents.replayThreadCh <- trr
		}
	}
}

// serverSync is called from
// gregord. This can happen either on initial startup, or after a reconnect. Needs
// to be called with gregorHandler locked.
func (g *gregorHandler) serverSync(ctx context.Context,
	cli gregor1.IncomingInterface, gcli *grclient.Client, syncRes *chat1.SyncAllNotificationRes) ([]gregor.InBandMessage, error) {

	// Get time of the last message we synced (unless this is our first time syncing)
	var t time.Time
	if !g.firstConnect {
		pt := gcli.StateMachineLatestCTime(ctx)
		if pt != nil {
			t = *pt
		}
		g.Debug(ctx, "serverSync: starting replay from: %s", t)
	} else {
		g.Debug(ctx, "serverSync: performing a fresh replay")
	}

	// Sync down everything from the server
	consumedMsgs, err := gcli.Sync(ctx, cli, syncRes)
	if err != nil {
		g.Debug(ctx, "serverSync: error syncing from the server, reason: %s", err)
		return nil, err
	}
	g.Debug(ctx, "serverSync: consumed %d messages", len(consumedMsgs))

	// Schedule replay of in-band messages
	g.replayCh <- replayThreadArg{
		cli: cli,
		t:   t,
		ctx: chat.BackgroundContext(ctx, g.G()),
	}

	g.pushState(keybase1.PushReason_RECONNECTED)
	return consumedMsgs, nil
}

func (g *gregorHandler) makeReconnectOobm() gregor1.Message {
	return gregor1.Message{
		Oobm_: &gregor1.OutOfBandMessage{
			System_: "internal.reconnect",
		},
	}
}

func (g *gregorHandler) authParams(ctx context.Context) (uid gregor1.UID, token gregor1.SessionToken, err error) {
	var res loggedInRes
	var stoken string
	var kuid keybase1.UID
	if kuid, stoken, res = g.loggedIn(ctx); res != loggedInYes {
		return uid, token,
			newConnectionAuthError("failed to check logged in status", res == loggedInMaybe)
	}
	return kuid.ToBytes(), gregor1.SessionToken(stoken), nil
}

func (g *gregorHandler) inboxParams(ctx context.Context, uid gregor1.UID) chat1.InboxVers {
	// Grab current on disk version
	ibox := chatstorage.NewInbox(g.G(), uid)
	vers, err := ibox.Version(ctx)
	if err != nil {
		g.chatLog.Debug(ctx, "inboxParams: failed to get current inbox version (using 0): %s",
			err.Error())
		vers = chat1.InboxVers(0)
	}
	return vers
}

func (g *gregorHandler) notificationParams(ctx context.Context, gcli *grclient.Client) (t gregor1.Time) {
	pt := gcli.StateMachineLatestCTime(ctx)
	if pt != nil {
		t = gregor1.ToTime(*pt)
	}
	g.chatLog.Debug(ctx, "notificationParams: latest ctime: %v", t.Time())
	return t
}

// OnConnect is called by the rpc library to indicate we have connected to
// gregord
func (g *gregorHandler) OnConnect(ctx context.Context, conn *rpc.Connection,
	cli rpc.GenericClient, srv *rpc.Server) (err error) {
	defer g.chatLog.Trace(ctx, func() error { return err }, "OnConnect")()

	// If we get a random OnConnect on some other connection that is not g.conn, then
	// just reject it.
	g.connMutex.Lock()
	if conn != g.conn {
		g.connMutex.Unlock()
		g.chatLog.Debug(ctx, "aborting on dup connection")
		return chat.ErrDuplicateConnection
	}
	g.connMutex.Unlock()

	g.chatLog.Debug(ctx, "connected")
	timeoutCli := WrapGenericClientWithTimeout(cli, GregorRequestTimeout, chat.ErrChatServerTimeout)
	chatCli := chat1.RemoteClient{Cli: chat.NewRemoteClient(g.G(), cli)}
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
		return err
	}
	iboxVers := g.inboxParams(ctx, uid)
	latestCtime := g.notificationParams(ctx, gcli)

	// Run SyncAll to both authenticate, and grab all the data we will need to run the
	// various resync procedures for chat and notifications
	var identBreaks []keybase1.TLFIdentifyFailure
	ctx = chat.Context(ctx, g.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		chat.NewCachingIdentifyNotifier(g.G()))
	g.chatLog.Debug(ctx, "OnConnect begin")
	syncAllRes, err := chatCli.SyncAll(ctx, chat1.SyncAllArg{
		Uid:       uid,
		DeviceID:  gcli.Device.(gregor1.DeviceID),
		Session:   token,
		InboxVers: iboxVers,
		Ctime:     latestCtime,
		Fresh:     g.firstConnect,
		ProtVers:  chat1.SyncAllProtVers_V1,
		HostName:  g.GetURI().Host,
	})
	if err != nil {
		// This will cause us to try and refresh session on the next attempt
		if _, ok := err.(libkb.BadSessionError); ok {
			g.chatLog.Debug(ctx, "bad session from SyncAll(): forcing session check on next attempt")
			g.forceSessionCheck = true
		}
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
	if _, err := g.serverSync(ctx, gregor1.IncomingClient{Cli: timeoutCli}, gcli,
		&syncAllRes.Notification); err != nil {
		g.chatLog.Debug(ctx, "serverSync: failure: %s", err.Error())
	}

	// Sync badge state in the background
	if g.badger != nil {
		if err := g.badger.Resync(ctx, g.GetClient, gcli, &syncAllRes.Badge); err != nil {
			g.chatLog.Debug(ctx, "badger failure: %s", err.Error())
		}
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

	// No longer first connect if we are now connected
	g.firstConnect = false
	// On successful login we can reset this guy to not force a check
	g.forceSessionCheck = false
	g.chatLog.Debug(ctx, "OnConnect complete")

	return nil
}

func (g *gregorHandler) OnConnectError(err error, reconnectThrottleDuration time.Duration) {
	g.chatLog.Debug(context.Background(), "connect error %s, reconnect throttle duration: %s", err, reconnectThrottleDuration)

	// Check reachability here to see the nature of our offline status
	go func() {
		if g.reachability != nil && !g.isReachable() {
			g.reachability.setReachability(keybase1.Reachability{
				Reachable: keybase1.Reachable_NO,
			})
		}
	}()
}

func (g *gregorHandler) OnDisconnected(ctx context.Context, status rpc.DisconnectStatus) {
	g.chatLog.Debug(context.Background(), "disconnected: %v", status)

	// Alert chat syncer that we are now disconnected
	g.G().Syncer.Disconnected(ctx)

	// Call out to reachability module if we have one (and we are currently connected)
	go func() {
		if g.reachability != nil && status != rpc.StartingFirstConnection && !g.isReachable() {
			g.reachability.setReachability(keybase1.Reachability{
				Reachable: keybase1.Reachable_NO,
			})
		}
	}()
}

func (g *gregorHandler) OnDoCommandError(err error, nextTime time.Duration) {
	g.chatLog.Debug(context.Background(), "do command error: %s, nextTime: %s", err, nextTime)
}

func (g *gregorHandler) ShouldRetry(name string, err error) bool {
	g.chatLog.Debug(context.Background(), "should retry: name %s, err %v (returning false)", name, err)
	return false
}

func (g *gregorHandler) ShouldRetryOnConnect(err error) bool {
	if err == nil {
		return false
	}

	ctx := context.Background()
	g.chatLog.Debug(ctx, "should retry on connect, err %v", err)
	if err == chat.ErrDuplicateConnection {
		g.chatLog.Debug(ctx, "duplicate connection error, not retrying")
		return false
	}
	if _, ok := err.(libkb.BadSessionError); ok {
		g.chatLog.Debug(ctx, "bad session error, not retrying")
		return false
	}
	if cerr, ok := err.(connectionAuthError); ok && !cerr.ShouldRetry() {
		g.chatLog.Debug(ctx, "should retry on connect, non-retry error, ending: %s", err.Error())
		return false
	}

	return true
}

func (g *gregorHandler) broadcastMessageOnce(ctx context.Context, m gregor1.Message) (err error) {
	defer g.chatLog.Trace(ctx, func() error { return err }, "broadcastMessageOnce")()

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
		state, err := gcli.StateMachineState(ctx, nil, false)
		if err != nil {
			g.Debug(ctx, "BroadcastMessage: no state machine available: %s", err.Error())
			return err
		}
		if _, ok := state.GetItem(msgID); ok {
			g.Debug(ctx, "BroadcastMessage: msgID: %s already in state, ignoring", msgID)
			return errors.New("ignored repeat message")
		}

		g.Debug(ctx, "broadcast: in-band message: msgID: %s Ctime: %s", msgID, ibm.Metadata().CTime())
		err = g.handleInBandMessage(ctx, g.GetIncomingClient(), ibm)

		// Send message to local state machine
		gcli.StateMachineConsumeMessage(ctx, m)

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
		if g.G().GetEnv().GetSlowGregorConn() {
			g.Debug(ctx, "[slow conn]: sleeping")
			time.Sleep(time.Duration(slowConnSleepTime))
			g.Debug(ctx, "[slow conn]: awake")
		}
		err := g.broadcastMessageOnce(ctx, m)
		if err != nil {
			g.Debug(context.Background(), "broadcast error: %v", err)
		}

		// Testing alerts
		if g.testingEvents != nil {
			g.testingEvents.broadcastSentCh <- err
		}
	}
}

// BroadcastMessage is called when we receive a new message from gregord. Grabs
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
	ctx = libkb.WithLogTag(ctx, "GRGIBM")

	var freshHandlers []libkb.GregorInBandMessageHandler

	// Loop over all handlers and run the messages against any that are alive
	// If the handler is not alive, we prune it from our list
	for i, handler := range g.ibmHandlers {
		g.Debug(ctx, "trying handler %s at position %d", handler.Name(), i)
		if handler.IsAlive() {
			if handled, err := g.handleInBandMessageWithHandler(ctx, cli, ibm, handler); err != nil {
				if handled {
					// Don't stop handling errors on a first failure.
					g.Errorf(ctx, "failed to run %s handler: %s", handler.Name(), err)
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
	state, err := gcli.StateMachineState(ctx, nil, false)
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

	// Send the oobm to that chat system so that it can potentially handle it
	if g.G().PushHandler != nil {
		handled, err := g.G().PushHandler.HandleOobm(ctx, obm)
		if err != nil {
			return err
		}
		if handled {
			return nil
		}
	}

	switch obm.System().String() {
	case "kbfs.favorites":
		return g.kbfsFavorites(ctx, obm)
	case "internal.reconnect":
		g.G().Log.Debug("reconnected to push server")
		return nil
	default:
		return fmt.Errorf("unhandled system: %s", obm.System())
	}
}

func (g *gregorHandler) Shutdown() {
	defer g.chatLog.Trace(context.Background(), func() error { return nil }, "Shutdown")()
	g.connMutex.Lock()
	defer g.connMutex.Unlock()

	if g.conn == nil {
		return
	}

	// Alert chat syncer that we are now disconnected
	g.G().Syncer.Disconnected(context.Background())

	close(g.shutdownCh)
	g.conn.Shutdown()
	g.conn = nil
	g.cli = nil
}

func (g *gregorHandler) Reset() error {
	g.Shutdown()
	return g.resetGregorClient(context.TODO())
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

type loggedInRes int

const (
	loggedInYes loggedInRes = iota
	loggedInNo
	loggedInMaybe
)

func (g *gregorHandler) loggedIn(ctx context.Context) (uid keybase1.UID, token string, res loggedInRes) {

	// Check to see if we have been shut down,
	select {
	case <-g.shutdownCh:
		return uid, token, loggedInMaybe
	default:
		// if we were going to block, then that means we are still alive
	}

	nist, uid, err := g.G().ActiveDevice.NISTAndUID(ctx)
	if nist == nil {
		g.G().Log.CDebugf(ctx, "gregorHandler: no NIST for login; user isn't logged in")
		return uid, token, loggedInNo
	}
	if err != nil {
		g.G().Log.CDebugf(ctx, "gregorHandler: error in generating NIST: %s", err.Error())
		return uid, token, loggedInMaybe
	}

	return uid, nist.Token().String(), loggedInYes
}

func (g *gregorHandler) auth(ctx context.Context, cli rpc.GenericClient, auth *gregor1.AuthResult) (err error) {
	var token string
	var res loggedInRes
	var uid keybase1.UID

	if uid, token, res = g.loggedIn(ctx); res != loggedInYes {
		return newConnectionAuthError("not logged in for auth", res == loggedInMaybe)
	}

	if auth == nil {
		g.chatLog.Debug(ctx, "logged in: authenticating")
		ac := gregor1.AuthClient{Cli: cli}
		auth = new(gregor1.AuthResult)
		*auth, err = ac.AuthenticateSessionToken(ctx, gregor1.SessionToken(token))
		if err != nil {
			g.chatLog.Debug(ctx, "auth error: %s", err)
			g.forceSessionCheck = true
			return err
		}
	} else {
		g.Debug(ctx, "using previously obtained auth result")
	}

	g.chatLog.Debug(ctx, "auth result: %+v", *auth)
	if !bytes.Equal(auth.Uid, uid.ToBytes()) {
		msg := fmt.Sprintf("auth result uid %x doesn't match session uid %q", auth.Uid, uid)
		return newConnectionAuthError(msg, false)
	}
	g.sessionID = auth.Sid

	return nil
}

func (g *gregorHandler) isReachable() bool {
	ctx := context.Background()
	timeout := g.G().Env.GetGregorPingTimeout()
	url, err := url.Parse(g.G().Env.GetGregorURI())
	if err != nil {
		g.chatLog.Debug(ctx, "isReachable: failed to parse server uri, exiting: %s", err.Error())
		return false
	}

	// If we currently think we are online, then make sure
	conn, err := net.DialTimeout("tcp", url.Host, timeout)
	if conn != nil {
		conn.Close()
		return true
	}
	if err != nil {
		g.chatLog.Debug(ctx, "isReachable: error: terminating connection: %s", err.Error())
		if _, err := g.Reconnect(ctx); err != nil {
			g.chatLog.Debug(ctx, "isReachable: error reconnecting: %s", err.Error())
		}
		return false
	}

	return true
}

func (g *gregorHandler) Reconnect(ctx context.Context) (didShutdown bool, err error) {
	if g.IsConnected() {
		didShutdown = true
		g.chatLog.Debug(ctx, "Reconnect: reconnecting to server")
		g.Shutdown()
		return didShutdown, g.Connect(g.uri)
	}

	didShutdown = false
	g.chatLog.Debug(ctx, "Reconnect: skipping reconnect, already disconnected")
	return didShutdown, nil
}

func (g *gregorHandler) pingLoop() {

	ctx := context.Background()
	id, _ := libkb.RandBytes(4)
	duration := g.G().Env.GetGregorPingInterval()
	timeout := g.G().Env.GetGregorPingTimeout()
	url, err := url.Parse(g.G().Env.GetGregorURI())
	if err != nil {
		g.chatLog.Debug(ctx, "ping loop: failed to parse server uri, exiting: %s", err.Error())
		return
	}

	g.chatLog.Debug(ctx, "ping loop: starting up: id: %x duration: %v timeout: %v url: %s",
		id, duration, timeout, url.Host)
	defer g.chatLog.Debug(ctx, "ping loop: id: %x terminating", id)

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
					g.chatLog.Debug(ctx, "ping loop: id: %x normal ping, not connected", id)
					_, err = gregor1.IncomingClient{Cli: g.pingCli}.Ping(ctx)
				}
				select {
				case <-ctx.Done():
					g.chatLog.Debug(ctx, "ping loop: id: %x context cancelled, so not sending err", id)
				default:
					doneCh <- err
				}
			}(ctx)

			select {
			case err = <-doneCh:
			case <-g.shutdownCh:
				g.chatLog.Debug(ctx, "ping loop: id: %x shutdown received", id)
				shutdownCancel()
				return
			}
			if err != nil {
				g.Debug(ctx, "ping loop: id: %x error: %s", id, err.Error())
				if err == context.DeadlineExceeded {
					g.chatLog.Debug(ctx, "ping loop: timeout: terminating connection")
					var didShutdown bool
					var err error
					if didShutdown, err = g.Reconnect(ctx); err != nil {
						g.chatLog.Debug(ctx, "ping loop: id: %x error reconnecting: %s", id,
							err.Error())
					}
					// It is possible that we have already reconnected by the time we call Reconnect
					// above. If that is the case, we don't want to terminate the ping loop. Only
					// if Reconnect has actually reset the connection do we stop this ping loop.
					if didShutdown {
						shutdownCancel()
						return
					}
				}
			}
		case <-g.shutdownCh:
			g.chatLog.Debug(ctx, "ping loop: id: %x shutdown received", id)
			shutdownCancel()
			return
		}
		shutdownCancel()
	}
}

// Our heuristic for figuring out whether your device is "active in chat" is
// whether you've sent a message in the last month. We're recording your last
// send as a simple timestamp, and we'll compare that to the current time.
// However, we want to avoid the situation where we ship this code for the
// first time, and suddenly *all* devices appear inactive, because no one has
// written the timestamp yet. So we add a second timestamp, which is the first
// time you ran any of this code. For 24 hours after the first time a device
// queries these keys, we treat all devices as active. We'll want to keep
// (something like) this code even after it's all stable in the wild, because
// it covers newly provisioned devices too.
func (g *gregorHandler) chatAwareReconnectIsLong(ctx context.Context) bool {
	now := time.Now()
	firstQueryTime := chat.TouchFirstChatActiveQueryTime(ctx, g.G(), g.chatLog)

	// As a special case, always use a short backoff on mobile. Mobile devices
	// aren't responsible for the thundering herd issues that this logic is
	// trying to mitigate, and mobile users are much more likely to notice a
	// connection delay.
	if g.G().Env.GetAppType() == libkb.MobileAppType {
		return false
	}

	// All devices are presumed active for the first 24 hours after they start
	// checking this, and we give them a short backoff.
	if now.Sub(firstQueryTime) < chat.InitialAssumedActiveInterval {
		return false
	}

	// Otherwise, devices that haven't recorded a send in the last month are
	// given a long backoff.
	lastSendTime := chat.GetLastSendTime(ctx, g.G(), g.chatLog)
	if now.Sub(lastSendTime) < chat.ActiveIntervalAfterSend {
		return false
	}
	g.chatLog.Debug(ctx, "Device isn't active in chat. Using long reconnect backoff.")
	return true
}

func (g *gregorHandler) chatAwareReconnectBackoff(ctx context.Context) backoff.BackOff {
	if g.chatAwareReconnectIsLong(ctx) {
		return backoff.NewConstantBackOff(GregorConnectionLongRetryInterval)
	}
	return backoff.NewConstantBackOff(GregorConnectionShortRetryInterval)
}

// Similar to the backoff above, except that the "short" window is zero, so
// that active clients don't wait at all before their first reconnect attempt.
func (g *gregorHandler) chatAwareInitialReconnectBackoffWindow(ctx context.Context) time.Duration {
	if g.chatAwareReconnectIsLong(ctx) {
		return GregorConnectionLongRetryInterval
	}
	return 0
}

// connMutex must be locked before calling this
func (g *gregorHandler) connectTLS() error {
	ctx := context.Background()
	if g.conn != nil {
		g.chatLog.Debug(ctx, "skipping connect, conn is not nil")
		return nil
	}

	uri := g.uri
	g.chatLog.Debug(ctx, "connecting to gregord via TLS at %s", uri)
	rawCA := g.G().Env.GetBundledCA(uri.Host)
	if len(rawCA) == 0 {
		return fmt.Errorf("No bundled CA for %s", uri.Host)
	}
	g.chatLog.Debug(ctx, "Using CA for gregor: %s", libkb.ShortCA(rawCA))
	// Let people know we are trying to sync
	g.G().NotifyRouter.HandleChatInboxSyncStarted(ctx, g.G().Env.GetUID())

	opts := rpc.ConnectionOpts{
		TagsFunc:                      logger.LogTagsFromContextRPC,
		WrapErrorFunc:                 libkb.MakeWrapError(g.G().ExternalG()),
		InitialReconnectBackoffWindow: func() time.Duration { return g.chatAwareInitialReconnectBackoffWindow(ctx) },
		ReconnectBackoff:              func() backoff.BackOff { return g.chatAwareReconnectBackoff(ctx) },
		// We deliberately avoid ForceInitialBackoff here, becuase we don't
		// want to penalize mobile, which tears down its connection frequently.
	}
	g.conn = rpc.NewTLSConnection(rpc.NewFixedRemote(uri.HostPort),
		[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(g.G().ExternalG()),
		g, libkb.NewRPCLogFactory(g.G().ExternalG()),
		logger.LogOutputWithDepthAdder{Logger: g.G().Log}, opts)

	// The client we get here will reconnect to gregord on disconnect if necessary.
	// We should grab it here instead of in OnConnect, since the connection is not
	// fully established in OnConnect. Anything that wants to make calls outside
	// of OnConnect should use g.cli, everything else should the client that is
	// a parameter to OnConnect
	g.cli = WrapGenericClientWithTimeout(g.conn.GetClient(), GregorRequestTimeout,
		chat.ErrChatServerTimeout)
	g.pingCli = g.conn.GetClient() // Don't want this to have a timeout from here

	// Start up ping loop to keep the connection to gregord alive, and to kick
	// off the reconnect logic in the RPC library
	go g.pingLoop()

	return nil
}

// connMutex must be locked before calling this
func (g *gregorHandler) connectNoTLS() error {
	ctx := context.Background()
	if g.conn != nil {
		g.chatLog.Debug(ctx, "skipping connect, conn is not nil")
		return nil
	}
	uri := g.uri
	g.chatLog.Debug(ctx, "connecting to gregord without TLS at %s", uri)
	t := newConnTransport(g.G().ExternalG(), uri.HostPort)
	g.transportForTesting = t

	opts := rpc.ConnectionOpts{
		TagsFunc:                      logger.LogTagsFromContextRPC,
		WrapErrorFunc:                 libkb.MakeWrapError(g.G().ExternalG()),
		InitialReconnectBackoffWindow: func() time.Duration { return g.chatAwareInitialReconnectBackoffWindow(ctx) },
		ReconnectBackoff:              func() backoff.BackOff { return g.chatAwareReconnectBackoff(ctx) },
		// We deliberately avoid ForceInitialBackoff here, because we don't
		// want to penalize mobile, which tears down its connection frequently.
	}
	g.conn = rpc.NewConnectionWithTransport(g, t,
		libkb.NewContextifiedErrorUnwrapper(g.G().ExternalG()),
		logger.LogOutputWithDepthAdder{Logger: g.G().Log}, opts)

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

// `cli` is the interface used to talk to gregor.
// If nil then the global cli will be used.
// Be sure to pass a cli when called from within OnConnect, as the global cli would deadlock.
func (g *gregorHandler) DismissItem(ctx context.Context, cli gregor1.IncomingInterface, id gregor.MsgID) error {
	if id == nil {
		return nil
	}
	var err error
	defer g.G().CTrace(ctx, fmt.Sprintf("gregorHandler.dismissItem(%s)", id.String()),
		func() error { return err },
	)()

	dismissal, err := g.templateMessage()
	if err != nil {
		return err
	}

	dismissal.Ibm_.StateUpdate_.Dismissal_ = &gregor1.Dismissal{
		MsgIDs_: []gregor1.MsgID{gregor1.MsgID(id.Bytes())},
	}

	if cli == nil {
		cli = gregor1.IncomingClient{Cli: g.cli}
	}
	err = cli.ConsumeMessage(ctx, *dismissal)
	return err
}

func (g *gregorHandler) LocalDismissItem(ctx context.Context, id gregor.MsgID) (err error) {
	if id == nil {
		return nil
	}
	defer g.G().CTrace(ctx, fmt.Sprintf("gregorHandler.localDismissItem(%s)", id.String()),
		func() error { return err },
	)()

	cli, err := g.getGregorCli()
	if err != nil {
		return err
	}
	return cli.StateMachineConsumeLocalDismissal(ctx, id)
}

func (g *gregorHandler) DismissCategory(ctx context.Context, category gregor1.Category) error {
	var err error
	defer g.G().CTrace(ctx, fmt.Sprintf("gregorHandler.DismissCategory(%s)", category.String()),
		func() error { return err },
	)()

	dismissal, err := g.templateMessage()
	if err != nil {
		return err
	}

	dismissal.Ibm_.StateUpdate_.Dismissal_ = &gregor1.Dismissal{
		Ranges_: []gregor1.MsgRange{
			gregor1.MsgRange{
				Category_: category,
				// A small non-zero offset that effectively means "now",
				// because an actually-zero offset would be interpreted as "not
				// an offset at all" by the SQL query builder.
				EndTime_: gregor1.TimeOrOffset{
					Offset_: gregor1.DurationMsec(1),
				},
			}},
	}

	incomingClient := g.GetIncomingClient()
	err = incomingClient.ConsumeMessage(ctx, *dismissal)
	return err
}

func (g *gregorHandler) InjectItem(ctx context.Context, cat string, body []byte, dtime gregor1.TimeOrOffset) (gregor1.MsgID, error) {
	var err error
	defer g.G().CTrace(ctx, fmt.Sprintf("gregorHandler.InjectItem(%s)", cat),
		func() error { return err },
	)()

	creation, err := g.templateMessage()
	if err != nil {
		return nil, err
	}
	creation.Ibm_.StateUpdate_.Creation_ = &gregor1.Item{
		Category_: gregor1.Category(cat),
		Body_:     gregor1.Body(body),
		Dtime_:    dtime,
	}

	incomingClient := gregor1.IncomingClient{Cli: g.cli}
	err = incomingClient.ConsumeMessage(ctx, *creation)
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

func (g *gregorHandler) getState(ctx context.Context) (res gregor1.State, err error) {
	var s gregor.State

	if g == nil || g.gregorCli == nil {
		return res, errors.New("gregor service not available (are you in standalone?)")
	}

	s, err = g.gregorCli.StateMachineState(ctx, nil, false)
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

func (g *gregorRPCHandler) GetState(ctx context.Context) (res gregor1.State, err error) {
	return g.gh.getState(ctx)
}

func (g *gregorRPCHandler) InjectItem(ctx context.Context, arg keybase1.InjectItemArg) (gregor1.MsgID, error) {
	return g.gh.InjectItem(ctx, arg.Cat, []byte(arg.Body), arg.Dtime)
}

func (g *gregorRPCHandler) DismissCategory(ctx context.Context, category gregor1.Category) error {
	return g.gh.DismissCategory(ctx, category)
}

func (g *gregorRPCHandler) DismissItem(ctx context.Context, id gregor1.MsgID) error {
	return g.gh.DismissItem(ctx, nil, id)
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
