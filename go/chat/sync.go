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

func (s *Syncer) SendChatStaleNotifications(uid gregor1.UID) {
	// Alert Electron that all chat information could be out of date. Empty conversation ID
	// list means everything needs to be refreshed
	kuid := keybase1.UID(uid.String())
	s.G().NotifyRouter.HandleChatInboxStale(context.Background(), kuid)
	s.G().NotifyRouter.HandleChatThreadsStale(context.Background(), kuid, []chat1.ConversationID{})
}

func (s *Syncer) Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID) error {
	s.Debug(ctx, "Connected: running")

	// Grab the latest inbox version, and compare it to what we have
	// If we don't have the latest, then we clear the Inbox cache and
	// send alerts to clients that they should refresh.
	vers, err := cli.GetInboxVersion(ctx, uid)
	if err != nil {
		s.Debug(ctx, "Connected: failed to sync inbox version: uid: %s error: %s", uid, err.Error())
		return err
	}

	ibox := storage.NewInbox(s.G(), uid, func() libkb.SecretUI {
		return DelivererSecretUI{}
	})
	// If we miss here, then let's send notifications out to clients letting
	// them know everything is hosed
	if verr := ibox.VersionSync(ctx, vers); verr != nil {
		s.Debug(ctx, "Connected: error during version sync: %s, sending notifications", verr.Error())
		s.SendChatStaleNotifications(uid)
	} else {
		s.Debug(ctx, "Connected: version sync success! version: %d", vers)
	}

	// Let the Offlinables know that we are back online
	for _, o := range s.offlinables {
		o.Connected(ctx)
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
