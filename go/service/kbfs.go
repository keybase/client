// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KBFSHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
}

func NewKBFSHandler(xp rpc.Transporter, g *libkb.GlobalContext, cg *globals.ChatContext) *KBFSHandler {
	return &KBFSHandler{
		BaseHandler:      NewBaseHandler(xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(cg),
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

	go h.notifyConversation(uid, arg.Filename)
}

// findFolderList returns the type of KBFS folder list containing the
// given file, e.g., "private", "public", "team", etc.
func findFolderList(filename string) string {
	// KBFS always sets the filenames in the protocol to be like
	// `/keybase/private/alice/...`, regardless of the OS.  So we just
	// need to split by `/` and take the third component.
	components := strings.Split(filename, "/")
	if len(components) < 3 {
		return ""
	}
	return components[2]
}

func (h *KBFSHandler) notifyConversation(uid keybase1.UID, filename string) {
	tlf := filepath.Base(filename)
	public := findFolderList(filename) == "public"
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
	h.ChatG().Syncer.SendChatStaleNotifications(context.Background(), uid.ToBytes(), convIDs, false)
}

func (h *KBFSHandler) conversationIDs(uid keybase1.UID, tlf string, public bool) ([]chat1.ConversationID, error) {
	vis := chat1.TLFVisibility_PRIVATE
	if public {
		vis = chat1.TLFVisibility_PUBLIC
	}

	toptype := chat1.TopicType_CHAT
	query := chat1.GetInboxLocalQuery{
		Name: &chat1.NameQuery{
			Name:        tlf,
			MembersType: chat1.ConversationMembersType_KBFS,
		},
		TlfVisibility: &vis,
		TopicType:     &toptype,
	}

	var identBreaks []keybase1.TLFIdentifyFailure
	g := globals.NewContext(h.G(), h.ChatG())
	ctx := chat.Context(context.Background(), g, keybase1.TLFIdentifyBehavior_CHAT_GUI,
		&identBreaks, chat.NewIdentifyNotifier(g))
	ib, _, err := h.ChatG().InboxSource.Read(ctx, uid.ToBytes(), nil, true, &query, nil)
	if err != nil {
		return nil, err
	}
	ids := make([]chat1.ConversationID, len(ib.Convs))
	for i, c := range ib.Convs {
		ids[i] = c.Info.Id
	}

	return ids, nil
}
