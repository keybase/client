// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"path/filepath"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KBFSHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewKBFSHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KBFSHandler {
	return &KBFSHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *KBFSHandler) FSEvent(_ context.Context, arg keybase1.FSNotification) error {
	h.G().NotifyRouter.HandleFSActivity(arg)

	h.checkConversationRekey(arg)

	return nil
}

func (h *KBFSHandler) FSEditList(ctx context.Context, arg keybase1.FSEditListArg) error {
	h.G().NotifyRouter.HandleFSEditListResponse(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSEditListRequest(ctx context.Context, arg keybase1.FSEditListRequest) error {
	h.G().NotifyRouter.HandleFSEditListRequest(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSSyncStatus(ctx context.Context, arg keybase1.FSSyncStatusArg) (err error) {
	h.G().NotifyRouter.HandleFSSyncStatus(ctx, arg)
	return nil
}

func (h *KBFSHandler) FSSyncEvent(ctx context.Context, arg keybase1.FSPathSyncStatus) (err error) {
	h.G().NotifyRouter.HandleFSSyncEvent(ctx, arg)
	return nil
}

// checkConversationRekey looks for rekey finished notifications and tries to
// find any conversations associated with the rekeyed TLF.  If it finds any,
// it will send ChatThreadsStale notifcations for them.
func (h *KBFSHandler) checkConversationRekey(arg keybase1.FSNotification) {
	if arg.NotificationType != keybase1.FSNotificationType_REKEYING {
		return
	}
	h.G().Log.Debug("received rekey notification for %s, code: %v", arg.Filename, arg.StatusCode)
	if arg.StatusCode != keybase1.FSStatusCode_FINISH {
		return
	}

	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		h.G().Log.Debug("received rekey finished notification for %s, but have no UID", arg.Filename)
		return
	}

	h.G().Log.Debug("received rekey finished notification for %s, checking for conversations", arg.Filename)

	go h.notifyConversation(uid, arg.Filename, arg.PublicTopLevelFolder)
}

func (h *KBFSHandler) notifyConversation(uid keybase1.UID, filename string, public bool) {
	tlf := filepath.Base(filename)
	convIDs, err := h.conversationIDs(uid, tlf, public)
	if err != nil {
		h.G().Log.Debug("error getting conversation IDs for tlf %q: %s", tlf, err)
		return
	}

	if len(convIDs) == 0 {
		h.G().Log.Debug("no conversations for tlf %s (public: %v)", tlf, public)
		return
	}

	h.G().Log.Debug("sending ChatThreadsStale notification (conversations: %d)", len(convIDs))
	h.G().Syncer.SendChatStaleNotifications(context.Background(), uid.ToBytes(), convIDs, false)
}

func (h *KBFSHandler) conversationIDs(uid keybase1.UID, tlf string, public bool) ([]chat1.ConversationID, error) {
	vis := chat1.TLFVisibility_PRIVATE
	if public {
		vis = chat1.TLFVisibility_PUBLIC
	}

	toptype := chat1.TopicType_CHAT
	query := chat1.GetInboxLocalQuery{
		TlfName:       &tlf,
		TlfVisibility: &vis,
		TopicType:     &toptype,
	}

	var identBreaks []keybase1.TLFIdentifyFailure
	ctx := chat.Context(context.Background(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &identBreaks,
		chat.NewIdentifyNotifier(h.G()))
	ib, _, err := h.G().InboxSource.Read(ctx, uid.ToBytes(), nil, true, &query, nil)
	if err != nil {
		return nil, err
	}
	ids := make([]chat1.ConversationID, len(ib.Convs))
	for i, c := range ib.Convs {
		ids[i] = c.Info.Id
	}

	return ids, nil
}
