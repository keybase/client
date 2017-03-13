package chat

import (
	"context"

	"github.com/keybase/client/go/chat/interfaces"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Syncer struct {
	libkb.Contextified
	utils.DebugLabeler

	offlinables []interfaces.Offlinable
}

func NewSyncer(g *libkb.GlobalContext) *Syncer {
	return &Syncer{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "Syncer", false),
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
	s.Debug(ctx, "Connected: running")

	// Let the Offlinables know that we are back online
	for _, o := range s.offlinables {
		o.Connected(ctx)
	}

	// Grab current on disk version
	ibox := storage.NewInbox(s.G(), uid, func() libkb.SecretUI {
		return DelivererSecretUI{}
	})
	var syncRes chat1.SyncInboxRes
	vers, err := ibox.Version(ctx)
	if err != nil {
		s.Debug(ctx, "Connected: failed to get current inbox version (using 0): %s", err.Error())
		vers = chat1.InboxVers(0)
	}
	s.Debug(ctx, "Connected: current inbox version: %v", vers)

	// Run the sync call on the server to see how current our local copy is
	ctx = CtxAddLogTags(ctx)
	if syncRes, err = cli.SyncInbox(ctx, vers); err != nil {
		s.Debug(ctx, "Connected: failed to sync inbox: %s", err.Error())
		return err
	}

	// Process what the server has told us to do with the local inbox copy
	rtyp, err := syncRes.Typ()
	if err != nil {
		s.Debug(ctx, "Connected: strange type from SyncInbox: %s", err.Error())
		return err
	}
	switch rtyp {
	case chat1.SyncInboxResType_CLEAR:
		s.Debug(ctx, "Connected: version out of date, clearing inbox: %v", vers)
		if err = ibox.Clear(ctx); err != nil {
			s.Debug(ctx, "Connected: failed to clear inbox: %s", err.Error())
		}
		// Send notifications for a full clear
		s.SendChatStaleNotifications(uid, nil)
	case chat1.SyncInboxResType_CURRENT:
		s.Debug(ctx, "Connected: version is current, standing pat: %v", vers)
	case chat1.SyncInboxResType_INCREMENTAL:
		incr := syncRes.Incremental()
		s.Debug(ctx, "Connected: version out of date, but can incrementally sync: old vers: %v vers: %v convs: %d",
			vers, incr.Vers, len(incr.Convs))

		if err = ibox.Sync(ctx, incr.Vers, incr.Convs); err != nil {
			s.Debug(ctx, "Connected: failed to sync conversations to inbox: %s", err.Error())

			// Send notifications for a full clear
			s.SendChatStaleNotifications(uid, nil)
		} else {
			// Send notifications for a successful partial sync
			s.SendChatStaleNotifications(uid, incr.Convs)
		}
	}

	return nil
}

func (s *Syncer) Disconnected(ctx context.Context) {
	s.Debug(ctx, "Disconnected: running")

	// Let the Offlinables know of connection state change
	for _, o := range s.offlinables {
		o.Disconnected(ctx)
	}
}

func (s *Syncer) RegisterOfflinable(offlinable interfaces.Offlinable) {
	s.offlinables = append(s.offlinables, offlinable)
}
