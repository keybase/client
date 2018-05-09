package types

import (
	"io"
	"regexp"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type Offlinable interface {
	IsOffline(ctx context.Context) bool
	Connected(ctx context.Context)
	Disconnected(ctx context.Context)
}

type Resumable interface {
	Start(ctx context.Context, uid gregor1.UID)
	Stop(ctx context.Context) chan struct{}
}

type CryptKey interface {
	Material() keybase1.Bytes32
	Generation() int
}

type AllCryptKeys map[chat1.ConversationMembersType][]CryptKey

type NameInfoSource interface {
	Lookup(ctx context.Context, name string, public bool) (*NameInfo, error)
	EncryptionKeys(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (*NameInfo, error)
	DecryptionKeys(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool,
		keyGeneration int, kbfsEncrypted bool) (*NameInfo, error)
	EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (keybase1.TeamEk, error)
	EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool,
		generation keybase1.EkGeneration) (keybase1.TeamEk, error)
}

type UnboxConversationInfo interface {
	GetConvID() chat1.ConversationID
	GetMembersType() chat1.ConversationMembersType
	GetFinalizeInfo() *chat1.ConversationFinalizeInfo
	GetExpunge() *chat1.Expunge
	IsPublic() bool
}

type ConversationSource interface {
	Offlinable

	AcquireConversationLock(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error
	ReleaseConversationLock(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID)

	Push(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error)
	PushUnboxed(ctx context.Context, convID chat1.ConversationID,
		uid gregor1.UID, msg chat1.MessageUnboxed) (continuousUpdate bool, err error)
	Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, query *chat1.GetThreadQuery,
		pagination *chat1.Pagination) (chat1.ThreadView, []*chat1.RateLimit, error)
	PullLocalOnly(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		query *chat1.GetThreadQuery, p *chat1.Pagination, maxPlaceholders int) (chat1.ThreadView, error)
	GetMessages(ctx context.Context, conv UnboxConversationInfo, uid gregor1.UID, msgIDs []chat1.MessageID) ([]chat1.MessageUnboxed, error)
	GetMessagesWithRemotes(ctx context.Context, conv chat1.Conversation, uid gregor1.UID,
		msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error)
	Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error
	TransformSupersedes(ctx context.Context, unboxInfo UnboxConversationInfo, uid gregor1.UID,
		msgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error)
	Expunge(ctx context.Context, convID chat1.ConversationID,
		uid gregor1.UID, expunge chat1.Expunge) error
	ClearFromDelete(ctx context.Context, uid gregor1.UID,
		convID chat1.ConversationID, deleteID chat1.MessageID)

	SetRemoteInterface(func() chat1.RemoteInterface)
	DeleteAssets(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, assets []chat1.Asset)
}

type MessageDeliverer interface {
	Offlinable
	Resumable

	Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		outboxID *chat1.OutboxID, identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, error)
	ForceDeliverLoop(ctx context.Context)
}

type Searcher interface {
	SearchRegexp(ctx context.Context, uiCh chan chat1.ChatSearchHit, conversationID chat1.ConversationID, re *regexp.Regexp, maxHits int, maxMessages int) (hits []chat1.ChatSearchHit, rlimits []chat1.RateLimit, err error)
}

type Sender interface {
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		clientPrev chat1.MessageID, outboxID *chat1.OutboxID) (chat1.OutboxID, *chat1.MessageBoxed, *chat1.RateLimit, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, membersType chat1.ConversationMembersType,
		conv *chat1.Conversation) (*chat1.MessageBoxed, []chat1.Asset, []gregor1.UID, chat1.ChannelMention, *chat1.TopicNameState, error)
}

type ChatLocalizer interface {
	Localize(ctx context.Context, uid gregor1.UID, inbox Inbox) ([]chat1.ConversationLocal, error)
	Name() string
	SetOffline()
}

type InboxSource interface {
	Offlinable

	Read(ctx context.Context, uid gregor1.UID, localizer ChatLocalizer, useLocalData bool,
		query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (Inbox, *chat1.RateLimit, error)
	ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
		query *chat1.GetInboxQuery, p *chat1.Pagination) (Inbox, *chat1.RateLimit, error)
	IsMember(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (bool, *chat1.RateLimit, error)

	NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		conv chat1.Conversation) error
	NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (*chat1.ConversationLocal, error)
	ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		msgID chat1.MessageID) (*chat1.ConversationLocal, error)
	SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		status chat1.ConversationStatus) (*chat1.ConversationLocal, error)
	SetAppNotificationSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		convID chat1.ConversationID, settings chat1.ConversationNotificationInfo) (*chat1.ConversationLocal, error)
	TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) ([]chat1.ConversationLocal, error)
	MembershipUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		joined []chat1.ConversationMember, removed []chat1.ConversationMember,
		resets []chat1.ConversationMember, previews []chat1.ConversationID) (MembershipUpdateRes, error)
	TeamTypeChanged(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		teamType chat1.TeamType) (*chat1.ConversationLocal, error)
	UpgradeKBFSToImpteam(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID) (*chat1.ConversationLocal, error)
	Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (*chat1.ConversationLocal, error)
	SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		policy chat1.RetentionPolicy) (*chat1.ConversationLocal, error)
	SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, teamID keybase1.TeamID,
		policy chat1.RetentionPolicy) ([]chat1.ConversationLocal, error)

	GetInboxQueryLocalToRemote(ctx context.Context,
		lquery *chat1.GetInboxLocalQuery) (*chat1.GetInboxQuery, *NameInfo, error)

	SetRemoteInterface(func() chat1.RemoteInterface)
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
	SendChatStaleNotifications(ctx context.Context, uid gregor1.UID,
		updates []chat1.ConversationStaleUpdate, immediate bool)
	SelectConversation(ctx context.Context, convID chat1.ConversationID)
	Shutdown()
}

type RetryDescription interface {
	Fix(ctx context.Context, uid gregor1.UID) error
	SendStale(ctx context.Context, uid gregor1.UID)
	String() string
	RekeyFixable(ctx context.Context, tlfID chat1.TLFID) bool
}

type FetchRetrier interface {
	Offlinable
	Resumable

	Failure(ctx context.Context, uid gregor1.UID, desc RetryDescription) error
	Success(ctx context.Context, uid gregor1.UID, desc RetryDescription) error
	Force(ctx context.Context)
	Rekey(ctx context.Context, name string, membersType chat1.ConversationMembersType,
		public bool)
}

type ConvLoader interface {
	Resumable

	Queue(ctx context.Context, job ConvLoaderJob) error
	Suspend(ctx context.Context) bool
	Resume(ctx context.Context) bool
}

type PushHandler interface {
	TlfFinalize(context.Context, gregor.OutOfBandMessage) error
	TlfResolve(context.Context, gregor.OutOfBandMessage) error
	Activity(context.Context, gregor.OutOfBandMessage) error
	Typing(context.Context, gregor.OutOfBandMessage) error
	MembershipUpdate(context.Context, gregor.OutOfBandMessage) error
	HandleOobm(context.Context, gregor.OutOfBandMessage) (bool, error)
	UpgradeKBFSToImpteam(ctx context.Context, m gregor.OutOfBandMessage) error
}

type AppState interface {
	State() keybase1.AppState
	NextUpdate() chan keybase1.AppState
}

type TeamChannelSource interface {
	Offlinable

	GetChannelsFull(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType) ([]chat1.ConversationLocal, []chat1.RateLimit, error)
	GetChannelsTopicName(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType) ([]chat1.ChannelNameMention, []chat1.RateLimit, error)
	GetChannelTopicName(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType, chat1.ConversationID) (string, []chat1.RateLimit, error)
	ChannelsChanged(context.Context, chat1.TLFID)
}

type IdentifyNotifier interface {
	Reset()
	ResetOnGUIConnect()
	Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks)
}
type UPAKFinder interface {
	LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (username libkb.NormalizedUsername, deviceName string, deviceType string, err error)
	CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error)
}

type ProgressReporter func(bytesCompleted, bytesTotal int64)

type AttachmentFetcher interface {
	DeleteAssets(ctx context.Context, convID chat1.ConversationID, assets []chat1.Asset,
		ri func() chat1.RemoteInterface, signer s3.Signer) error
	FetchAttachment(ctx context.Context, w io.Writer, convID chat1.ConversationID, asset chat1.Asset,
		ri func() chat1.RemoteInterface, signer s3.Signer, progress ProgressReporter) error
}

type AttachmentURLSrv interface {
	GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
		preview bool) string
	GetAttachmentFetcher() AttachmentFetcher
}
