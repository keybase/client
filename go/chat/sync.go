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

func (s *Syncer) SendChatStaleNotifications(uid gregor1.UID, convs []chat1.Conversation) {
	kuid := keybase1.UID(uid.String())
	s.G().NotifyRouter.HandleChatInboxStale(context.Background(), kuid)
	s.G().NotifyRouter.HandleChatThreadsStale(context.Background(), kuid, s.getConvIDs(convs))
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
	ibox := storage.NewInbox(s.G(), uid, func() libkb.SecretUI {
		return DelivererSecretUI{}
	})
	vers, err := ibox.Version(ctx)
	if err != nil {
		s.Debug(ctx, "Sync: failed to get current inbox version (using 0): %s", err.Error())
		vers = chat1.InboxVers(0)
	}
	s.Debug(ctx, "Sync: current inbox version: %v", vers)

	// Run the sync call on the server to see how current our local copy is
	var syncRes chat1.SyncInboxRes
	if syncRes, err = cli.SyncInbox(ctx, vers); err != nil {
		s.Debug(ctx, "Sync: failed to sync inbox: %s", err.Error())
		return err
	}

	// Process what the server has told us to do with the local inbox copy
	rtyp, err := syncRes.Typ()
	if err != nil {
		s.Debug(ctx, "Sync: strange type from SyncInbox: %s", err.Error())
		return err
	}
	switch rtyp {
	case chat1.SyncInboxResType_CLEAR:
		s.Debug(ctx, "Sync: version out of date, clearing inbox: %v", vers)
		if err = ibox.Clear(ctx); err != nil {
			s.Debug(ctx, "Sync: failed to clear inbox: %s", err.Error())
		}
		// Send notifications for a full clear
		s.SendChatStaleNotifications(uid, nil)
	case chat1.SyncInboxResType_CURRENT:
		s.Debug(ctx, "Sync: version is current, standing pat: %v", vers)
	case chat1.SyncInboxResType_INCREMENTAL:
		incr := syncRes.Incremental()
		s.Debug(ctx, "Sync: version out of date, but can incrementally sync: old vers: %v vers: %v convs: %d",
			vers, incr.Vers, len(incr.Convs))

		if err = ibox.Sync(ctx, incr.Vers, incr.Convs); err != nil {
			s.Debug(ctx, "Sync: failed to sync conversations to inbox: %s", err.Error())

			// Send notifications for a full clear
			s.SendChatStaleNotifications(uid, nil)
		} else {
			// Send notifications for a successful partial sync
			s.SendChatStaleNotifications(uid, incr.Convs)
		}
	}

	return nil
}

func (s *Syncer) RegisterOfflinable(offlinable types.Offlinable) {
	s.Lock()
	defer s.Unlock()
	s.offlinables = append(s.offlinables, offlinable)
}
