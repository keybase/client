package chat

import (
	"context"
	"sync"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Syncer struct {
	libkb.Contextified
	utils.DebugLabeler
	sync.Mutex

	isConnected bool
	offlinables []types.Offlinable
}

func NewSyncer(g *libkb.GlobalContext) *Syncer {
	return &Syncer{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "Syncer", false),
		isConnected:  true,
	}
}

func (s *Syncer) getConvIDs(convs []chat1.Conversation) (res []chat1.ConversationID) {
	for _, conv := range convs {
		res = append(res, conv.GetConvID())
	}
	return res
}

func (s *Syncer) SendChatStaleNotifications(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID) {

	kuid := keybase1.UID(uid.String())
	if len(convIDs) == 0 {
		s.Debug(ctx, "sending inbox stale message")
		s.G().NotifyRouter.HandleChatInboxStale(context.Background(), kuid)
	}
	s.Debug(ctx, "sending threads stale message: len: %d", len(convIDs))
	s.G().NotifyRouter.HandleChatThreadsStale(context.Background(), kuid, convIDs)
}

func (s *Syncer) isServerInboxClear(ctx context.Context, inbox *storage.Inbox, srvVers int) bool {
	if _, err := s.G().ServerCacheVersions.MatchInbox(ctx, srvVers); err != nil {
		s.Debug(ctx, "isServerInboxClear: inbox server version match error: %s", err.Error())
		return true
	}

	return false
}

func (s *Syncer) Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID) (err error) {
	ctx = CtxAddLogTags(ctx)
	s.Debug(ctx, "Connected: running")
	s.Lock()
	defer s.Unlock()

	s.isConnected = true

	// Let the Offlinables know that we are back online
	for _, o := range s.offlinables {
		o.Connected(ctx)
	}

	s.sync(ctx, cli, uid)

	return nil
}

func (s *Syncer) Disconnected(ctx context.Context) {
	s.Debug(ctx, "Disconnected: running")
	s.Lock()
	defer s.Unlock()

	s.isConnected = false

	// Let the Offlinables know of connection state change
	for _, o := range s.offlinables {
		o.Disconnected(ctx)
	}
}

func (s *Syncer) Sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID) (err error) {
	s.Lock()
	defer s.Unlock()
	return s.sync(ctx, cli, uid)
}

func (s *Syncer) sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID) (err error) {
	if !s.isConnected {
		s.Debug(ctx, "Sync: aborting because currently offline")
		return OfflineError{}
	}

	// Grab current on disk version
	ibox := storage.NewInbox(s.G(), uid)
	var syncRes chat1.SyncChatRes
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

	// Run the sync call on the server to see how current our local copy is

	if syncRes, err = cli.SyncChat(ctx, vers); err != nil {
		s.Debug(ctx, "Sync: failed to sync inbox: %s", err.Error())
		return err
	}

	// Set new server versions
	if err = s.G().ServerCacheVersions.Set(ctx, syncRes.CacheVers); err != nil {
		s.Debug(ctx, "Connected: failed to set new server versions: %s", err.Error())
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
		s.SendChatStaleNotifications(ctx, uid, nil)
	case chat1.SyncInboxResType_CURRENT:
		s.Debug(ctx, "Sync: version is current, standing pat: %v", vers)
	case chat1.SyncInboxResType_INCREMENTAL:
		incr := syncRes.InboxRes.Incremental()
		s.Debug(ctx, "Sync: version out of date, but can incrementally sync: old vers: %v vers: %v convs: %d",
			vers, incr.Vers, len(incr.Convs))

		if err = ibox.Sync(ctx, incr.Vers, incr.Convs); err != nil {
			s.Debug(ctx, "Sync: failed to sync conversations to inbox: %s", err.Error())

			// Send notifications for a full clear
			s.SendChatStaleNotifications(ctx, uid, nil)
		} else {
			// Send notifications for a successful partial sync
			s.SendChatStaleNotifications(ctx, uid, s.getConvIDs(incr.Convs))
		}
	}

	return nil
}

func (s *Syncer) RegisterOfflinable(offlinable types.Offlinable) {
	s.Lock()
	defer s.Unlock()
	s.offlinables = append(s.offlinables, offlinable)
}
