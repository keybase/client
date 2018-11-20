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
	"github.com/keybase/client/go/protocol/stellar1"
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

type Suspendable interface {
	Suspend(ctx context.Context) bool
	Resume(ctx context.Context) bool
}

type CryptKey interface {
	Material() keybase1.Bytes32
	Generation() int
}

type AllCryptKeys map[chat1.ConversationMembersType][]CryptKey

type NameInfoSource interface {
	LookupIDUntrusted(ctx context.Context, name string, public bool) (*NameInfoUntrusted, error)
	LookupID(ctx context.Context, name string, public bool) (*NameInfo, error)
	LookupName(ctx context.Context, tlfID chat1.TLFID, public bool) (*NameInfo, error)
	AllCryptKeys(ctx context.Context, name string, public bool) (AllCryptKeys, error)
	EncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (CryptKey, *NameInfo, error)
	DecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool,
		keyGeneration int, kbfsEncrypted bool) (CryptKey, error)
	EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (keybase1.TeamEk, error)
	EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool,
		generation keybase1.EkGeneration) (keybase1.TeamEk, error)
	ShouldPairwiseMAC(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error)
}

type UnboxConversationInfo interface {
	GetConvID() chat1.ConversationID
	GetMembersType() chat1.ConversationMembersType
	GetFinalizeInfo() *chat1.ConversationFinalizeInfo
	GetExpunge() *chat1.Expunge
	GetMaxDeletedUpTo() chat1.MessageID
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
	Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, reason chat1.GetThreadReason,
		query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error)
	PullLocalOnly(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		query *chat1.GetThreadQuery, p *chat1.Pagination, maxPlaceholders int) (chat1.ThreadView, error)
	GetMessages(ctx context.Context, conv UnboxConversationInfo, uid gregor1.UID, msgIDs []chat1.MessageID,
		reason *chat1.GetThreadReason) ([]chat1.MessageUnboxed, error)
	GetMessagesWithRemotes(ctx context.Context, conv chat1.Conversation, uid gregor1.UID,
		msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error)
	Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error
	TransformSupersedes(ctx context.Context, unboxInfo UnboxConversationInfo, uid gregor1.UID,
		msgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error)
	Expunge(ctx context.Context, convID chat1.ConversationID,
		uid gregor1.UID, expunge chat1.Expunge) error
	ClearFromDelete(ctx context.Context, uid gregor1.UID,
		convID chat1.ConversationID, deleteID chat1.MessageID) bool
	EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		purgeInfo *chat1.EphemeralPurgeInfo) (*chat1.EphemeralPurgeInfo, []chat1.MessageUnboxed, error)

	SetRemoteInterface(func() chat1.RemoteInterface)
	DeleteAssets(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, assets []chat1.Asset)
}

type MessageDeliverer interface {
	Offlinable
	Resumable

	Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		outboxID *chat1.OutboxID, identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, error)
	ForceDeliverLoop(ctx context.Context)
	ActiveDeliveries(ctx context.Context) ([]chat1.ConversationID, error)
	NextFailure() (chan []chat1.OutboxRecord, func())
}

type RegexpSearcher interface {
	Search(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		re *regexp.Regexp, uiCh chan chat1.ChatSearchHit, opts chat1.SearchOpts) ([]chat1.ChatSearchHit, error)
}

type Indexer interface {
	Resumable

	Search(ctx context.Context, uid gregor1.UID, query string, opts chat1.SearchOpts,
		hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus) (*chat1.ChatSearchInboxResults, error)
	// Add/update the index with the given messages
	Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error
	// Remove the given messages from the index
	Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error
	// For devel/testing
	IndexInbox(ctx context.Context, uid gregor1.UID) (map[string]chat1.ProfileSearchConvStats, error)
}

type Sender interface {
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		clientPrev chat1.MessageID, outboxID *chat1.OutboxID) (chat1.OutboxID, *chat1.MessageBoxed, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, membersType chat1.ConversationMembersType,
		conv *chat1.Conversation) (*chat1.MessageBoxed, []chat1.Asset, []gregor1.UID, chat1.ChannelMention, *chat1.TopicNameState, error)
}

type InboxSource interface {
	Offlinable
	Resumable
	Suspendable

	Read(ctx context.Context, uid gregor1.UID, localizeTyp ConversationLocalizerTyp, useLocalData bool,
		maxLocalize *int, query *chat1.GetInboxLocalQuery, p *chat1.Pagination) (Inbox, chan AsyncInboxResult, error)
	ReadUnverified(ctx context.Context, uid gregor1.UID, useLocalData bool,
		query *chat1.GetInboxQuery, p *chat1.Pagination) (Inbox, error)
	Localize(ctx context.Context, uid gregor1.UID, convs []RemoteConversation,
		localizeTyp ConversationLocalizerTyp) ([]chat1.ConversationLocal, chan AsyncInboxResult, error)

	NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		conv chat1.Conversation) error
	IsMember(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (bool, error)
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
	UpgradeKBFSToImpteam(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		convID chat1.ConversationID) (*chat1.ConversationLocal, error)
	Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (*chat1.ConversationLocal, error)
	SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		policy chat1.RetentionPolicy) (*chat1.ConversationLocal, error)
	SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, teamID keybase1.TeamID,
		policy chat1.RetentionPolicy) ([]chat1.ConversationLocal, error)
	SetConvSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convID chat1.ConversationID,
		convSettings *chat1.ConversationSettings) (*chat1.ConversationLocal, error)
	SubteamRename(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convIDs []chat1.ConversationID) ([]chat1.ConversationLocal, error)

	GetInboxQueryLocalToRemote(ctx context.Context,
		lquery *chat1.GetInboxLocalQuery) (*chat1.GetInboxQuery, *NameInfoUntrusted, error)

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
	Suspendable

	Queue(ctx context.Context, job ConvLoaderJob) error
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

	GetChannelsFull(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType) ([]chat1.ConversationLocal, error)
	GetChannelsTopicName(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType) ([]chat1.ChannelNameMention, error)
	GetChannelTopicName(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType, chat1.ConversationID) (string, error)
	ChannelsChanged(context.Context, chat1.TLFID)
}

type ActivityNotifier interface {
	Activity(ctx context.Context, uid gregor1.UID, topicType chat1.TopicType, activity *chat1.ChatActivity,
		source chat1.ChatActivitySource)
	TypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate)
	JoinedConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		topicType chat1.TopicType, conv *chat1.InboxUIItem)
	LeftConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		topicType chat1.TopicType)
	ResetConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		topicType chat1.TopicType)
	KBFSToImpteamUpgrade(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		topicType chat1.TopicType)
	SetConvRetention(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		topicType chat1.TopicType, conv *chat1.InboxUIItem)
	SetTeamRetention(ctx context.Context, uid gregor1.UID, teamID keybase1.TeamID,
		topicType chat1.TopicType, convs []chat1.InboxUIItem)
	SetConvSettings(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		topicType chat1.TopicType, conv *chat1.InboxUIItem)
	SubteamRename(ctx context.Context, uid gregor1.UID, convIDs []chat1.ConversationID,
		topicType chat1.TopicType, convs []chat1.InboxUIItem)

	InboxSyncStarted(ctx context.Context, uid gregor1.UID)
	InboxSynced(ctx context.Context, uid gregor1.UID, topicType chat1.TopicType, syncRes chat1.ChatSyncResult)
	InboxStale(ctx context.Context, uid gregor1.UID)
	ThreadsStale(ctx context.Context, uid gregor1.UID, updates []chat1.ConversationStaleUpdate)

	TLFFinalize(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType,
		finalizeInfo chat1.ConversationFinalizeInfo, conv *chat1.InboxUIItem)
	TLFResolve(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType,
		resolveInfo chat1.ConversationResolveInfo)

	AttachmentUploadStart(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		outboxID chat1.OutboxID)
	AttachmentUploadProgress(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		outboxID chat1.OutboxID, bytesComplete, bytesTotal int64)

	PromptUnfurl(ctx context.Context, uid gregor1.UID,
		convID chat1.ConversationID, msgID chat1.MessageID, domain string)
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
	StreamAttachment(ctx context.Context, convID chat1.ConversationID, asset chat1.Asset,
		ri func() chat1.RemoteInterface, signer s3.Signer) (io.ReadSeeker, error)
	PutUploadedAsset(ctx context.Context, filename string, asset chat1.Asset) error
	IsAssetLocal(ctx context.Context, asset chat1.Asset) (bool, error)
}

type AttachmentURLSrv interface {
	GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
		preview bool) string
	GetPendingPreviewURL(ctx context.Context, outboxID chat1.OutboxID) string
	GetUnfurlAssetURL(ctx context.Context, convID chat1.ConversationID, asset chat1.Asset) string
	GetAttachmentFetcher() AttachmentFetcher
}

type RateLimitedResult interface {
	GetRateLimit() []chat1.RateLimit
	SetRateLimits(rl []chat1.RateLimit)
}

type EphemeralPurger interface {
	Resumable

	Queue(ctx context.Context, purgeInfo chat1.EphemeralPurgeInfo) error
}

type AttachmentUploaderResultCb interface {
	Wait() chan AttachmentUploadResult
}

type AttachmentUploader interface {
	Register(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		outboxID chat1.OutboxID, title, filename string, metadata []byte,
		callerPreview *chat1.MakePreviewRes) (AttachmentUploaderResultCb, error)
	Status(ctx context.Context, outboxID chat1.OutboxID) (AttachmentUploaderTaskStatus, AttachmentUploadResult, error)
	Retry(ctx context.Context, outboxID chat1.OutboxID) (AttachmentUploaderResultCb, error)
	Cancel(ctx context.Context, outboxID chat1.OutboxID) error
	Complete(ctx context.Context, outboxID chat1.OutboxID)
	GetUploadTempFile(ctx context.Context, outboxID chat1.OutboxID, filename string) (string, error)
}

type NativeVideoHelper interface {
	ThumbnailAndDuration(ctx context.Context, filename string) ([]byte, int, error)
}

type StellarLoader interface {
	LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo
	LoadRequest(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo
}

type ConversationBackedStorage interface {
	Put(ctx context.Context, uid gregor1.UID, name string, data interface{}) error
	Get(ctx context.Context, uid gregor1.UID, name string, res interface{}) (bool, error)
}

type Unfurler interface {
	UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		msg chat1.MessageUnboxed)
	Status(ctx context.Context, outboxID chat1.OutboxID) (UnfurlerTaskStatus, *chat1.UnfurlResult, error)
	Retry(ctx context.Context, outboxID chat1.OutboxID)
	Complete(ctx context.Context, outboxID chat1.OutboxID)

	GetSettings(ctx context.Context, uid gregor1.UID) (chat1.UnfurlSettings, error)
	WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) error
	WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) error
	SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) error
}

type InternalError interface {
	// verbose error info for debugging but not user display
	InternalError() string
}

type UnboxingError interface {
	InternalError
	Error() string
	Inner() error
	IsPermanent() bool
	ExportType() chat1.MessageUnboxedErrorType
	VersionKind() chat1.VersionKind
	VersionNumber() int
	IsCritical() bool
}

var _ error = (UnboxingError)(nil)
