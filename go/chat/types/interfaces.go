package types

import (
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type Offlinable interface {
	IsOffline() bool
	Connected(ctx context.Context)
	Disconnected(ctx context.Context)
}

type Resumable interface {
	Start(ctx context.Context, uid gregor1.UID)
	Stop(ctx context.Context) chan struct{}
}

type TLFInfoSource interface {
	Lookup(ctx context.Context, tlfName string, vis chat1.TLFVisibility) (*TLFInfo, error)
	CryptKeys(ctx context.Context, tlfName string) (keybase1.GetTLFCryptKeysRes, error)
	PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (keybase1.CanonicalTLFNameAndIDWithBreaks, error)
	CompleteAndCanonicalizePrivateTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error)
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

	SetRemoteInterface(func() chat1.RemoteInterface)
	SetTLFInfoSource(tlfInfoSource TLFInfoSource)
}

type MessageDeliverer interface {
	Offlinable
	Resumable

	Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, error)
	ForceDeliverLoop(ctx context.Context)
}

type ChatLocalizer interface {
	Localize(ctx context.Context, uid gregor1.UID, inbox chat1.Inbox) ([]chat1.ConversationLocal, error)
	Name() string
	SetOffline()
}

type InboxSource interface {
	Offlinable

	Read(ctx context.Context, uid gregor1.UID, localizer ChatLocalizer, useLocalData bool,
		query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error)
	ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
		query *chat1.GetInboxQuery, p *chat1.Pagination) (chat1.Inbox, *chat1.RateLimit, error)

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

	SetRemoteInterface(func() chat1.RemoteInterface)
	SetTLFInfoSource(tlfInfoSource TLFInfoSource)
}

type ServerCacheVersions interface {
	Set(ctx context.Context, vers chat1.ServerCacheVers) error
	MatchBodies(ctx context.Context, vers int) (int, error)
	MatchInbox(ctx context.Context, vers int) (int, error)
	Fetch(ctx context.Context) (chat1.ServerCacheVers, error)
}

type Syncer interface {
	IsConnected(ctx context.Context) bool
	Connected(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
		syncRes *chat1.SyncChatRes) error
	Disconnected(ctx context.Context)
	Sync(ctx context.Context, cli chat1.RemoteInterface, uid gregor1.UID,
		syncRes *chat1.SyncChatRes) error
	RegisterOfflinable(offlinable Offlinable)
	SendChatStaleNotifications(ctx context.Context, uid gregor1.UID, convIDs []chat1.ConversationID,
		immediate bool)
	Shutdown()
}

type FetchRetrier interface {
	Offlinable
	Resumable

	Failure(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, kind FetchType) error
	Success(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, kind FetchType) error
	Force(ctx context.Context)
}

type ConvLoader interface {
	Resumable

	Queue(ctx context.Context, convID chat1.ConversationID) error
}

type PushHandler interface {
	TlfFinalize(context.Context, gregor.OutOfBandMessage) error
	TlfResolve(context.Context, gregor.OutOfBandMessage) error
	Activity(context.Context, gregor.OutOfBandMessage) error
	Typing(context.Context, gregor.OutOfBandMessage) error
}

type AppState interface {
	State() keybase1.AppState
	NextUpdate() chan keybase1.AppState
}
