package interfaces

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Offlinable interface {
	Connected(ctx context.Context)
	Disconnected(ctx context.Context)
}

type ConversationSource interface {
	Offlinable

	Push(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error)
	Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, query *chat1.GetThreadQuery,
		pagination *chat1.Pagination) (chat1.ThreadView, []*chat1.RateLimit, error)
	PullLocalOnly(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		query *chat1.GetThreadQuery, p *chat1.Pagination) (chat1.ThreadView, error)
	GetMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgIDs []chat1.MessageID, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error)
	GetMessagesWithRemotes(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msgs []chat1.MessageBoxed, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error)
	Clear(convID chat1.ConversationID, uid gregor1.UID) error
	TransformSupersedes(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error)
}

type MessageDeliverer interface {
	Offlinable

	Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, error)
	Start(ctx context.Context, uid gregor1.UID)
	Stop(ctx context.Context) chan struct{}
	ForceDeliverLoop(ctx context.Context)
}

type ChatLocalizer interface {
	Localize(ctx context.Context, uid gregor1.UID, inbox chat1.Inbox) ([]chat1.ConversationLocal, error)
	Name() string
}

type InboxSource interface {
	Offlinable

	Read(ctx context.Context, uid gregor1.UID, localizer ChatLocalizer, query *chat1.GetInboxLocalQuery,
		p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error)
	ReadNoCache(ctx context.Context, uid gregor1.UID, localizer ChatLocalizer,
		query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error)
	ReadRemote(ctx context.Context, uid gregor1.UID, query *chat1.GetInboxLocalQuery,
		p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error)

	NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		conv chat1.Conversation) error
	NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		msg chat1.MessageBoxed) (*chat1.ConversationLocal, error)
	ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		msgID chat1.MessageID) (*chat1.ConversationLocal, error)
	SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		status chat1.ConversationStatus) (*chat1.ConversationLocal, error)
	TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) ([]chat1.ConversationLocal, error)
}
