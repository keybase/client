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

	running  bool
	notifyCh chan func()
}

func NewNotifyRouterActivityRouter(g *globals.Context) *NotifyRouterActivityRouter {
	return &NotifyRouterActivityRouter{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "NotifyRouterActivityRouter", false),
	}
}

func (n *NotifyRouterActivityRouter) notifyLoop() {
	for f := range n.notifyCh {
		f()
	}
}

func (n *NotifyRouterActivityRouter) Start(ctx context.Context, uid gregor1.UID) {
	n.Lock()
	defer n.Unlock()
	if n.running {
		return
	}
	n.notifyCh = make(chan func(), 1000)
	go n.notifyLoop()
}

func (n *NotifyRouterActivityRouter) Stop(ctx context.Context) chan struct{} {
	n.Lock()
	defer n.Unlock()
	n.running = false
	close(n.notifyCh)
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (n *NotifyRouterActivityRouter) kuid(uid gregor1.UID) keybase1.UID {
	return keybase1.UID(uid.String())
}

func (n *NotifyRouterActivityRouter) Activity(ctx context.Context, uid gregor1.UID, topicType chat1.TopicType, activity *chat1.ChatActivity) {
	defer n.Trace(ctx, func() error { return nil }, "Activity(%v)", topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleNewChatActivity(ctx, n.kuid(uid), topicType, activity)
	}
}

func (n *NotifyRouterActivityRouter) TypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate) {
	defer n.Trace(ctx, func() error { return nil }, "TypingUpdate")()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatTypingUpdate(ctx, updates)
	}
}

func (n *NotifyRouterActivityRouter) JoinedConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "JoinedConversation(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatJoinedConversation(ctx, n.kuid(uid), convID, topicType, conv)
	}
}

func (n *NotifyRouterActivityRouter) LeftConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) {
	defer n.Trace(ctx, func() error { return nil }, "LeftConversation(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatLeftConversation(ctx, n.kuid(uid), convID, topicType)
	}
}

func (n *NotifyRouterActivityRouter) ResetConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) {
	defer n.Trace(ctx, func() error { return nil }, "ResetConversation(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatResetConversation(ctx, n.kuid(uid), convID, topicType)
	}
}

func (n *NotifyRouterActivityRouter) KBFSToImpteamUpgrade(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) {
	defer n.Trace(ctx, func() error { return nil }, "KBFSToImpteamUpgrade(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatKBFSToImpteamUpgrade(ctx, n.kuid(uid), convID, topicType)
	}
}

func (n *NotifyRouterActivityRouter) SetConvRetention(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "SetConvRetention(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatSetConvRetention(ctx, n.kuid(uid), convID, topicType, conv)
	}
}

func (n *NotifyRouterActivityRouter) SetTeamRetention(ctx context.Context, uid gregor1.UID, teamID keybase1.TeamID, topicType chat1.TopicType, convs []chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "SetTeamRetention(%s,%v)", teamID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatSetTeamRetention(ctx, n.kuid(uid), teamID, topicType, convs)
	}
}

func (n *NotifyRouterActivityRouter) InboxSyncStarted(ctx context.Context, uid gregor1.UID) {
	defer n.Trace(ctx, func() error { return nil }, "InboxSyncStarted")()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatInboxSyncStarted(ctx, n.kuid(uid))
	}
}

func (n *NotifyRouterActivityRouter) InboxSynced(ctx context.Context, uid gregor1.UID, topicType chat1.TopicType, syncRes chat1.ChatSyncResult) {
	defer n.Trace(ctx, func() error { return nil }, "InboxSynced(%v)", topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatInboxSynced(ctx, n.kuid(uid), topicType, syncRes)
	}
}

func (n *NotifyRouterActivityRouter) InboxStale(ctx context.Context, uid gregor1.UID) {
	defer n.Trace(ctx, func() error { return nil }, "InboxStale")()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatInboxStale(ctx, n.kuid(uid))
	}
}

func (n *NotifyRouterActivityRouter) ThreadsStale(ctx context.Context, uid gregor1.UID, updates []chat1.ConversationStaleUpdate) {
	defer n.Trace(ctx, func() error { return nil }, "ThreadsStale")()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatThreadsStale(ctx, n.kuid(uid), updates)
	}
}

func (n *NotifyRouterActivityRouter) TLFFinalize(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType, finalizeInfo chat1.ConversationFinalizeInfo, conv *chat1.InboxUIItem) {
	defer n.Trace(ctx, func() error { return nil }, "TLFFinalize(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatTLFFinalize(ctx, n.kuid(uid), convID, topicType, finalizeInfo, conv)
	}
}

func (n *NotifyRouterActivityRouter) TLFResolve(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType, resolveInfo chat1.ConversationResolveInfo) {
	defer n.Trace(ctx, func() error { return nil }, "TLFResolve(%s,%v)", convID, topicType)()
	ctx = BackgroundContext(ctx, n.G())
	n.notifyCh <- func() {
		n.G().NotifyRouter.HandleChatTLFResolve(ctx, n.kuid(uid), convID, topicType, resolveInfo)
	}
}
