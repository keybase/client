package chat

import (
	"context"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type NotifyRouterActivityRouter struct {
	utils.DebugLabeler
	globals.Contextified
	sync.Mutex

	notifyCh   chan func()
	shutdownCh chan struct{}
}

func NewNotifyRouterActivityRouter(g *globals.Context) *NotifyRouterActivityRouter {
	n := &NotifyRouterActivityRouter{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "NotifyRouterActivityRouter", false),
		notifyCh:     make(chan func(), 5000),
		shutdownCh:   make(chan struct{}),
	}
	go n.notifyLoop()
	g.PushShutdownHook(func() error {
		close(n.shutdownCh)
		return nil
	})
	return n
}

func (n *NotifyRouterActivityRouter) notifyLoop() {
	for {
		select {
		case f := <-n.notifyCh:
			f()
		case <-n.shutdownCh:
			return
		}
	}
}

func (n *NotifyRouterActivityRouter) kuid(uid gregor1.UID) keybase1.UID {
	return keybase1.UID(uid.String())
}

func (n *NotifyRouterActivityRouter) Activity(ctx context.Context, uid gregor1.UID,
	topicType chat1.TopicType, activity *chat1.ChatActivity, source chat1.ChatActivitySource) {
	defer n.Trace(ctx, func() error { return nil }, "Activity(%v,%v)", topicType, source)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleNewChatActivity(ctx, n.kuid(uid), topicType, activity, source)
	}
}

func (n *NotifyRouterActivityRouter) TypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate) {
	defer n.Trace(ctx, func() error { return nil }, "TypingUpdate")()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatTypingUpdate(ctx, updates)
	}
}

func (n *NotifyRouterActivityRouter) JoinedConversation(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "JoinedConversation(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatJoinedConversation(ctx, n.kuid(uid), convID, topicType, conv)
	}
}

func (n *NotifyRouterActivityRouter) LeftConversation(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	defer n.Trace(ctx, func() error { return nil }, "LeftConversation(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatLeftConversation(ctx, n.kuid(uid), convID, topicType)
	}
}

func (n *NotifyRouterActivityRouter) ResetConversation(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	defer n.Trace(ctx, func() error { return nil }, "ResetConversation(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatResetConversation(ctx, n.kuid(uid), convID, topicType)
	}
}

func (n *NotifyRouterActivityRouter) KBFSToImpteamUpgrade(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	defer n.Trace(ctx, func() error { return nil }, "KBFSToImpteamUpgrade(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatKBFSToImpteamUpgrade(ctx, n.kuid(uid), convID, topicType)
	}
}

func (n *NotifyRouterActivityRouter) SetConvRetention(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "SetConvRetention(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatSetConvRetention(ctx, n.kuid(uid), convID, topicType, conv)
	}
}

func (n *NotifyRouterActivityRouter) SetTeamRetention(ctx context.Context, uid gregor1.UID,
	teamID keybase1.TeamID, topicType chat1.TopicType, convs []chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "SetTeamRetention(%s,%v)", teamID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatSetTeamRetention(ctx, n.kuid(uid), teamID, topicType, convs)
	}
}

func (n *NotifyRouterActivityRouter) SetConvSettings(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "SetConvSettings(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatSetConvSettings(ctx, n.kuid(uid), convID, topicType, conv)
	}
}

func (n *NotifyRouterActivityRouter) SubteamRename(ctx context.Context, uid gregor1.UID,
	convIDs []chat1.ConversationID, topicType chat1.TopicType, convs []chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "SubteamRename(%v,%d convs)", topicType, len(convs))()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatSubteamRename(ctx, n.kuid(uid), convIDs, topicType, convs)
	}
}

func (n *NotifyRouterActivityRouter) InboxSyncStarted(ctx context.Context, uid gregor1.UID) {
	defer n.Trace(ctx, func() error { return nil }, "InboxSyncStarted")()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatInboxSyncStarted(ctx, n.kuid(uid))
	}
}

func (n *NotifyRouterActivityRouter) InboxSynced(ctx context.Context, uid gregor1.UID,
	topicType chat1.TopicType, syncRes chat1.ChatSyncResult) {
	defer n.Trace(ctx, func() error { return nil }, "InboxSynced(%v)", topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatInboxSynced(ctx, n.kuid(uid), topicType, syncRes)
	}
}

func (n *NotifyRouterActivityRouter) InboxStale(ctx context.Context, uid gregor1.UID) {
	defer n.Trace(ctx, func() error { return nil }, "InboxStale")()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatInboxStale(ctx, n.kuid(uid))
	}
}

func (n *NotifyRouterActivityRouter) ThreadsStale(ctx context.Context, uid gregor1.UID,
	updates []chat1.ConversationStaleUpdate) {
	defer n.Trace(ctx, func() error { return nil }, "ThreadsStale")()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatThreadsStale(ctx, n.kuid(uid), updates)
	}
}

func (n *NotifyRouterActivityRouter) TLFFinalize(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, finalizeInfo chat1.ConversationFinalizeInfo, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "TLFFinalize(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatTLFFinalize(ctx, n.kuid(uid), convID, topicType, finalizeInfo, conv)
	}
}

func (n *NotifyRouterActivityRouter) TLFResolve(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, resolveInfo chat1.ConversationResolveInfo) {
	defer n.Trace(ctx, func() error { return nil }, "TLFResolve(%s,%v)", convID, topicType)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatTLFResolve(ctx, n.kuid(uid), convID, topicType, resolveInfo)
	}
}

func (n *NotifyRouterActivityRouter) AttachmentUploadStart(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, outboxID chat1.OutboxID) {
	defer n.Trace(ctx, func() error { return nil }, "AttachmentUploadStart(%s,%s)", convID, outboxID)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatAttachmentUploadStart(ctx, n.kuid(uid), convID, outboxID)
	}
}

func (n *NotifyRouterActivityRouter) AttachmentUploadProgress(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, outboxID chat1.OutboxID, bytesComplete, bytesTotal int64) {
	defer n.Trace(ctx, func() error { return nil }, "AttachmentUploadProgress(%s,%s)", convID, outboxID)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatAttachmentUploadProgress(ctx, n.kuid(uid), convID, outboxID,
			bytesComplete, bytesTotal)
	}
}

func (n *NotifyRouterActivityRouter) PromptUnfurl(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, domain string) {
	defer n.Trace(ctx, func() error { return nil }, "PromptUnfurl(%s,%s)", convID, msgID)()
	ctx = globals.BackgroundChatCtx(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatPromptUnfurl(ctx, n.kuid(uid), convID, msgID, domain)
	}
}
