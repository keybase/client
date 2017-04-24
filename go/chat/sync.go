package chat

import (
	"encoding/hex"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

type Syncer struct {
	libkb.Contextified
	utils.DebugLabeler
	sync.Mutex

	isConnected bool
	offlinables []types.Offlinable

	notificationLock  sync.Mutex
	clock             clockwork.Clock
	sendDelay         time.Duration
	shutdownCh        chan struct{}
	fullReloadCh      chan gregor1.UID
	flushCh           chan struct{}
	notificationQueue map[string][]chat1.ConversationID
}

func NewSyncer(g *libkb.GlobalContext) *Syncer {
	s := &Syncer{
		Contextified:      libkb.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g, "Syncer", false),
		isConnected:       false,
		clock:             clockwork.NewRealClock(),
		shutdownCh:        make(chan struct{}),
		fullReloadCh:      make(chan gregor1.UID),
		flushCh:           make(chan struct{}),
		notificationQueue: make(map[string][]chat1.ConversationID),
		sendDelay:         time.Millisecond * 1000,
	}

	go s.sendNotificationLoop()
	return s
}

func (s *Syncer) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *Syncer) Shutdown() {
	s.Debug(context.Background(), "shutting down")
	close(s.shutdownCh)
}

func (s *Syncer) dedupConvIDs(convIDs []chat1.ConversationID) (res []chat1.ConversationID) {
	m := make(map[string]bool)
	for _, convID := range convIDs {
		m[convID.String()] = true
	}
	for hexConvID := range m {
		convID, _ := hex.DecodeString(hexConvID)
		res = append(res, convID)
	}
	return res
}

func (s *Syncer) sendNotificationsOnce() {
	s.notificationLock.Lock()
	defer s.notificationLock.Unlock()
	for uid, convIDs := range s.notificationQueue {
		convIDs = s.dedupConvIDs(convIDs)
		s.Debug(context.Background(), "flushing notifications: uid: %s len: %d", uid, len(convIDs))
		s.G().NotifyRouter.HandleChatThreadsStale(context.Background(), keybase1.UID(uid), convIDs)
	}
	s.notificationQueue = make(map[string][]chat1.ConversationID)
}

func (s *Syncer) sendNotificationLoop() {
	s.Debug(context.Background(), "starting notification loop")
	for {
		select {
		case <-s.shutdownCh:
			return
		case uid := <-s.fullReloadCh:
			s.notificationLock.Lock()
			kuid := keybase1.UID(uid.String())
			s.G().NotifyRouter.HandleChatInboxStale(context.Background(), kuid)
			s.G().NotifyRouter.HandleChatThreadsStale(context.Background(), kuid, nil)
			s.notificationQueue[uid.String()] = nil
			s.notificationLock.Unlock()
		case <-s.clock.After(s.sendDelay):
			s.sendNotificationsOnce()
		case <-s.flushCh:
			s.sendNotificationsOnce()
		}
	}

}

func (s *Syncer) getConvIDs(convs []chat1.Conversation) (res []chat1.ConversationID) {
	for _, conv := range convs {
		res = append(res, conv.GetConvID())
	}
	return res
}

func (s *Syncer) SendChatStaleNotifications(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID, immediate bool) {
	if len(convIDs) == 0 {
		s.Debug(ctx, "sending inbox stale message")
		s.fullReloadCh <- uid
	} else {
		s.Debug(ctx, "sending threads stale message: len: %d", len(convIDs))
		s.notificationLock.Lock()
		s.notificationQueue[uid.String()] = append(s.notificationQueue[uid.String()], convIDs...)
		s.notificationLock.Unlock()
		if immediate {
			s.flushCh <- struct{}{}
		}
	}
}

func (s *Syncer) isServerInboxClear(ctx context.Context, inbox *storage.Inbox, srvVers int) bool {
	if _, err := s.G().ServerCacheVersions.MatchInbox(ctx, srvVers); err != nil {
		s.Debug(ctx, "isServerInboxClear: inbox server version match error: %s", err.Error())
		return true
	}

	return false
}

func (s *Syncer) IsConnected(ctx context.Context) bool {
	s.Lock()
	defer s.Unlock()
	return s.isConnected
}

func (s *Syncer) Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	ctx = CtxAddLogTags(ctx)
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return err }, "Connected")()

	s.isConnected = true

	// Let the Offlinables know that we are back online
	for _, o := range s.offlinables {
		o.Connected(ctx)
	}

	// Run sync against the server
	s.sync(ctx, cli, uid, syncRes)

	return nil
}

func (s *Syncer) Disconnected(ctx context.Context) {
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return nil }, "Disconnected")()

	s.isConnected = false

	// Let the Offlinables know of connection state change
	for _, o := range s.offlinables {
		o.Disconnected(ctx)
	}
}

func (s *Syncer) Sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return err }, "Sync")()
	return s.sync(ctx, cli, uid, syncRes)
}

func (s *Syncer) sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
	syncRes *chat1.SyncChatRes) (err error) {
	if !s.isConnected {
		s.Debug(ctx, "Sync: aborting because currently offline")
		return OfflineError{}
	}

	// Grab current on disk version
	ibox := storage.NewInbox(s.G(), uid)
	vers, err := ibox.Version(ctx)
	if err != nil {
		s.Debug(ctx, "Sync: failed to get current inbox version (using 0): %s", err.Error())
		vers = chat1.InboxVers(0)
	}
	srvVers, err := ibox.ServerVersion(ctx)
	if err != nil {
		s.Debug(ctx, "Sync: failed to get current inbox server version (using 0): %s", err.Error())
		srvVers = 0
	}
	s.Debug(ctx, "Sync: current inbox version: %v server version: %d", vers, srvVers)

	if syncRes == nil {
		// Run the sync call on the server to see how current our local copy is
		syncRes = new(chat1.SyncChatRes)
		if *syncRes, err = cli.SyncChat(ctx, vers); err != nil {
			s.Debug(ctx, "Sync: failed to sync inbox: %s", err.Error())
			return err
		}
	} else {
		s.Debug(ctx, "Sync: skipping sync call, data provided")
	}

	// Set new server versions
	if err = s.G().ServerCacheVersions.Set(ctx, syncRes.CacheVers); err != nil {
		s.Debug(ctx, "Sync: failed to set new server versions: %s", err.Error())
	}

	// Process what the server has told us to do with the local inbox copy
	rtyp, err := syncRes.InboxRes.Typ()
	if err != nil {
		s.Debug(ctx, "Sync: strange type from SyncInbox: %s", err.Error())
		return err
	}
	// Check if the server has cleared the inbox
	if s.isServerInboxClear(ctx, ibox, srvVers) {
		rtyp = chat1.SyncInboxResType_CLEAR
	}

	switch rtyp {
	case chat1.SyncInboxResType_CLEAR:
		s.Debug(ctx, "Sync: version out of date, clearing inbox: %v", vers)
		if err = ibox.Clear(ctx); err != nil {
			s.Debug(ctx, "Sync: failed to clear inbox: %s", err.Error())
		}
		// Send notifications for a full clear
		s.SendChatStaleNotifications(ctx, uid, nil, true)
	case chat1.SyncInboxResType_CURRENT:
		s.Debug(ctx, "Sync: version is current, standing pat: %v", vers)
	case chat1.SyncInboxResType_INCREMENTAL:
		incr := syncRes.InboxRes.Incremental()
		s.Debug(ctx, "Sync: version out of date, but can incrementally sync: old vers: %v vers: %v convs: %d",
			vers, incr.Vers, len(incr.Convs))

		if err = ibox.Sync(ctx, incr.Vers, incr.Convs); err != nil {
			s.Debug(ctx, "Sync: failed to sync conversations to inbox: %s", err.Error())

			// Send notifications for a full clear
			s.SendChatStaleNotifications(ctx, uid, nil, true)
		} else {
			// Send notifications for a successful partial sync
			s.SendChatStaleNotifications(ctx, uid, s.getConvIDs(incr.Convs), true)
		}
	}

	return nil
}

func (s *Syncer) RegisterOfflinable(offlinable types.Offlinable) {
	s.Lock()
	defer s.Unlock()
	s.offlinables = append(s.offlinables, offlinable)
}
