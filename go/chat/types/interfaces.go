package types

import (
	"io"
	"regexp"
	"time"

	"github.com/keybase/client/go/badges"
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

type BackgroundRunnable interface {
	IsBackgroundActive() bool
}

type CryptKey interface {
	Material() keybase1.Bytes32
	Generation() int
}

type EphemeralCryptKey interface {
	Material() keybase1.Bytes32
	Generation() keybase1.EkGeneration
}

type AllCryptKeys map[chat1.ConversationMembersType][]CryptKey

type NameInfoSource interface {
	LookupID(ctx context.Context, name string, public bool) (NameInfo, error)
	LookupName(ctx context.Context, tlfID chat1.TLFID, public bool) (NameInfo, error)
	AllCryptKeys(ctx context.Context, name string, public bool) (AllCryptKeys, error)
	EncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (CryptKey, NameInfo, error)
	DecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool,
		keyGeneration int, kbfsEncrypted bool, botUID *gregor1.UID) (CryptKey, error)
	EphemeralEncryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (EphemeralCryptKey, error)
	EphemeralDecryptionKey(mctx libkb.MetaContext, tlfName string, tlfID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID,
		generation keybase1.EkGeneration, contentCtime *gregor1.Time) (EphemeralCryptKey, error)
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
	AcquireConversationLock(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error
	ReleaseConversationLock(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID)

	Push(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error)
	PushUnboxed(ctx context.Context, convID chat1.ConversationID,
		uid gregor1.UID, msg []chat1.MessageUnboxed) error
	Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, reason chat1.GetThreadReason,
		query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error)
	PullLocalOnly(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		query *chat1.GetThreadQuery, p *chat1.Pagination, maxPlaceholders int) (chat1.ThreadView, error)
	PullFull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, reason chat1.GetThreadReason,
		query *chat1.GetThreadQuery, maxPages *int) (chat1.ThreadView, error)
	GetMessages(ctx context.Context, conv UnboxConversationInfo, uid gregor1.UID, msgIDs []chat1.MessageID,
		reason *chat1.GetThreadReason) ([]chat1.MessageUnboxed, error)
	GetMessagesWithRemotes(ctx context.Context, conv chat1.Conversation, uid gregor1.UID,
		msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error)
	GetUnreadline(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
		readMsgID chat1.MessageID) (*chat1.MessageID, error)
	Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error
	TransformSupersedes(ctx context.Context, unboxInfo UnboxConversationInfo, uid gregor1.UID,
		msgs []chat1.MessageUnboxed, q *chat1.GetThreadQuery, superXform SupersedesTransform,
		replyFiller ReplyFiller) ([]chat1.MessageUnboxed, error)
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
		outboxID *chat1.OutboxID, sendOpts *chat1.SenderSendOptions,
		prepareOpts *chat1.SenderPrepareOptions, identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, error)
	ForceDeliverLoop(ctx context.Context)
	ActiveDeliveries(ctx context.Context) ([]chat1.OutboxRecord, error)
	NextFailure() (chan []chat1.OutboxRecord, func())
}

type RegexpSearcher interface {
	Search(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		re *regexp.Regexp, uiCh chan chat1.ChatSearchHit, opts chat1.SearchOpts) ([]chat1.ChatSearchHit, []chat1.MessageUnboxed, error)
}

type Indexer interface {
	Resumable
	Suspendable
	BackgroundRunnable

	Search(ctx context.Context, uid gregor1.UID, query, origQuery string, opts chat1.SearchOpts,
		hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus) (*chat1.ChatSearchInboxResults, error)
	// Add/update the index with the given messages
	Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error
	// Remove the given messages from the index
	Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error
	FullyIndexed(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (bool, error)
	PercentIndexed(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (int, error)
	SearchableConvs(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID) ([]RemoteConversation, error)
	OnDbNuke(mctx libkb.MetaContext) error
	// For devel/testing
	IndexInbox(ctx context.Context, uid gregor1.UID) (map[string]chat1.ProfileSearchConvStats, error)
}

type Sender interface {
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
		clientPrev chat1.MessageID, outboxID *chat1.OutboxID,
		sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions) (chat1.OutboxID, *chat1.MessageBoxed, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, membersType chat1.ConversationMembersType,
		conv *chat1.ConversationLocal, opts *chat1.SenderPrepareOptions) (SenderPrepareResult, error)
}

type InboxSource interface {
	Offlinable
	Resumable
	Suspendable
	badges.LocalChatState

	Clear(ctx context.Context, uid gregor1.UID) error
	Read(ctx context.Context, uid gregor1.UID, localizeTyp ConversationLocalizerTyp,
		dataSource InboxSourceDataSourceTyp, maxLocalize *int, query *chat1.GetInboxLocalQuery,
		p *chat1.Pagination) (Inbox, chan AsyncInboxResult, error)
	ReadUnverified(ctx context.Context, uid gregor1.UID, dataSource InboxSourceDataSourceTyp,
		query *chat1.GetInboxQuery, p *chat1.Pagination) (Inbox, error)
	Localize(ctx context.Context, uid gregor1.UID, convs []RemoteConversation,
		localizeTyp ConversationLocalizerTyp) ([]chat1.ConversationLocal, chan AsyncInboxResult, error)
	RemoteSetConversationStatus(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		status chat1.ConversationStatus) error
	Search(ctx context.Context, uid gregor1.UID, query string, limit int) ([]RemoteConversation, error)
	MarkAsRead(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID) error
	Draft(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, text *string) error

	NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		conv chat1.Conversation) error
	IsMember(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (bool, error)
	IsTeam(ctx context.Context, uid gregor1.UID, item string) (bool, error)
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
	ConversationsUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
		convUpdates []chat1.ConversationUpdate) error
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
	UpdateInboxVersion(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers) error

	GetInboxQueryLocalToRemote(ctx context.Context,
		lquery *chat1.GetInboxLocalQuery) (*chat1.GetInboxQuery, NameInfo, error)

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

	Failure(ctx context.Context, uid gregor1.UID, desc RetryDescription)
	Success(ctx context.Context, uid gregor1.UID, desc RetryDescription)
	Force(ctx context.Context)
	Rekey(ctx context.Context, name string, membersType chat1.ConversationMembersType,
		public bool)
}

type ConvLoader interface {
	Resumable
	Suspendable
	BackgroundRunnable

	Queue(ctx context.Context, job ConvLoaderJob) error
}

type OobmHandler interface {
	HandleOobm(context.Context, gregor.OutOfBandMessage) (bool, error)
}

type PushHandler interface {
	TlfFinalize(context.Context, gregor.OutOfBandMessage) error
	TlfResolve(context.Context, gregor.OutOfBandMessage) error
	Activity(context.Context, gregor.OutOfBandMessage) error
	Typing(context.Context, gregor.OutOfBandMessage) error
	MembershipUpdate(context.Context, gregor.OutOfBandMessage) error
	UpgradeKBFSToImpteam(ctx context.Context, m gregor.OutOfBandMessage) error
	OobmHandler
}

type MobileAppState interface {
	State() keybase1.MobileAppState
	NextUpdate() chan keybase1.MobileAppState
}

type TeamChannelSource interface {
	GetChannelsFull(context.Context, gregor1.UID, chat1.TLFID, chat1.TopicType) ([]chat1.ConversationLocal, error)
	GetChannelsTopicName(ctx context.Context, uid gregor1.UID,
		teamID chat1.TLFID, topicType chat1.TopicType) ([]chat1.ChannelNameMention, error)
	GetChannelTopicName(ctx context.Context, uid gregor1.UID,
		tlfID chat1.TLFID, topicType chat1.TopicType, convID chat1.ConversationID) (string, error)
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

type KeyFinder interface {
	FindForEncryption(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (CryptKey, NameInfo, error)
	FindForDecryption(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, keyGeneration int,
		kbfsEncrypted bool, botUID *gregor1.UID) (CryptKey, error)
	EphemeralKeyForEncryption(mctx libkb.MetaContext, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID) (EphemeralCryptKey, error)
	EphemeralKeyForDecryption(mctx libkb.MetaContext, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool, botUID *gregor1.UID,
		generation keybase1.EkGeneration, contentCtime *gregor1.Time) (EphemeralCryptKey, error)
	ShouldPairwiseMAC(ctx context.Context, tlfName string, teamID chat1.TLFID,
		membersType chat1.ConversationMembersType, public bool) (bool, []keybase1.KID, error)
	Reset()
}

type UPAKFinder interface {
	LookupUsernameAndDevice(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (username libkb.NormalizedUsername, deviceName string, deviceType string, err error)
	CheckKIDForUID(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool, err error)
}

type ContextFactory interface {
	NewKeyFinder() KeyFinder
	NewUPAKFinder() UPAKFinder
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
	OnDbNuke(mctx libkb.MetaContext) error
	OnStart(mctx libkb.MetaContext)
}

type AttachmentURLSrv interface {
	GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
		preview bool) string
	GetPendingPreviewURL(ctx context.Context, outboxID chat1.OutboxID) string
	GetUnfurlAssetURL(ctx context.Context, convID chat1.ConversationID, asset chat1.Asset) string
	GetGiphyURL(ctx context.Context, giphyURL string) string
	GetGiphyGalleryURL(ctx context.Context, convID chat1.ConversationID,
		tlfName string, results []chat1.GiphySearchResult) string
	GetAttachmentFetcher() AttachmentFetcher
	OnDbNuke(mctx libkb.MetaContext) error
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
	OnDbNuke(mctx libkb.MetaContext) error
}

type NativeVideoHelper interface {
	ThumbnailAndDuration(ctx context.Context, filename string) ([]byte, int, error)
}

type StellarLoader interface {
	LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo
	LoadRequest(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo
}

type StellarSender interface {
	ParsePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		body string) []ParsedStellarPayment
	DescribePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		payments []ParsedStellarPayment) (chat1.UIChatPaymentSummary, []ParsedStellarPayment, error)
	DecorateWithPayments(ctx context.Context, body string, payments []chat1.TextPayment) string
	SendPayments(ctx context.Context, convID chat1.ConversationID, payments []ParsedStellarPayment) ([]chat1.TextPayment, error)
}

type ConversationBackedStorage interface {
	Put(ctx context.Context, uid gregor1.UID, name string, data interface{}) error
	Get(ctx context.Context, uid gregor1.UID, name string, res interface{}) (bool, error)
}

type WhitelistExemption interface {
	Use() bool
	Matches(convID chat1.ConversationID, msgID chat1.MessageID, domain string) bool
	Domain() string
}

type Unfurler interface {
	UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		msg chat1.MessageUnboxed)
	Prefetch(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, msgText string) int
	Status(ctx context.Context, outboxID chat1.OutboxID) (UnfurlerTaskStatus, *chat1.UnfurlResult, error)
	Retry(ctx context.Context, outboxID chat1.OutboxID)
	Complete(ctx context.Context, outboxID chat1.OutboxID)

	GetSettings(ctx context.Context, uid gregor1.UID) (chat1.UnfurlSettings, error)
	SetSettings(ctx context.Context, uid gregor1.UID, settings chat1.UnfurlSettings) error
	WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) error
	WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) error
	WhitelistAddExemption(ctx context.Context, uid gregor1.UID, exemption WhitelistExemption)
	SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) error
}

type ConversationCommand interface {
	Match(ctx context.Context, text string) bool
	Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, tlfName, text string,
		replyTo *chat1.MessageID) error
	Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, tflName, text string)
	Name() string
	Usage() string
	Description() string
	HasHelpText() bool
	Export() chat1.ConversationCommand
}

type ConversationCommandsSpec interface {
	GetMembersType() chat1.ConversationMembersType
	GetTeamType() chat1.TeamType
	GetTopicName() string
}

type ConversationCommandsSource interface {
	ListCommands(ctx context.Context, uid gregor1.UID, conv ConversationCommandsSpec) (chat1.ConversationCommandGroups, error)
	GetBuiltins(ctx context.Context) []chat1.BuiltinCommandGroup
	GetBuiltinCommandType(ctx context.Context, c ConversationCommandsSpec) chat1.ConversationBuiltinCommandTyp
	AttemptBuiltinCommand(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		tlfName string, body chat1.MessageBody, replyTo *chat1.MessageID) (bool, error)
	PreviewBuiltinCommand(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
		tlfName, text string)
}

type CoinFlipManager interface {
	Resumable
	StartFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID, tlfName, text string,
		outboxID *chat1.OutboxID) error
	MaybeInjectFlipMessage(ctx context.Context, boxedMsg chat1.MessageBoxed, inboxVers chat1.InboxVers,
		uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) bool
	LoadFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID, hostMsgID chat1.MessageID,
		flipConvID chat1.ConversationID, gameID chat1.FlipGameID) (chan chat1.UICoinFlipStatus, chan error)
	DescribeFlipText(ctx context.Context, text string) string
	HasActiveGames(ctx context.Context) bool
	IsFlipConversationCreated(ctx context.Context, outboxID chat1.OutboxID) (chat1.ConversationID, FlipSendStatus)
}

type TeamMentionLoader interface {
	Resumable
	LoadTeamMention(ctx context.Context, uid gregor1.UID,
		maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention,
		forceRemote bool) error
	IsTeamMention(ctx context.Context, uid gregor1.UID,
		maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention) bool
}

type ExternalAPIKeySource interface {
	GetKey(ctx context.Context, typ chat1.ExternalAPIKeyTyp) (chat1.ExternalAPIKey, error)
	GetAllKeys(ctx context.Context) ([]chat1.ExternalAPIKey, error)
}

type LiveLocationKey string

type LiveLocationTracker interface {
	Resumable
	GetCurrentPosition(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID)
	StartTracking(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, endTime time.Time)
	LocationUpdate(ctx context.Context, coord chat1.Coordinate)
	GetCoordinates(ctx context.Context, key LiveLocationKey) []chat1.Coordinate
	ActivelyTracking(ctx context.Context) bool
	StopAllTracking(ctx context.Context)
}

type BotCommandManager interface {
	Resumable
	Advertise(ctx context.Context, alias *string, ads []chat1.AdvertiseCommandsParam) error
	Clear(ctx context.Context) error
	ListCommands(ctx context.Context, convID chat1.ConversationID) ([]chat1.UserBotCommandOutput, error)
	UpdateCommands(ctx context.Context, convID chat1.ConversationID, info *chat1.BotInfo) (chan error, error)
}

type SupersedesTransform interface {
	Run(ctx context.Context, conv UnboxConversationInfo, uid gregor1.UID,
		originalMsgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error)
}

type ReplyFiller interface {
	Fill(ctx context.Context, uid gregor1.UID, conv UnboxConversationInfo,
		msgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error)
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
	ToStatus() keybase1.Status
}

var _ error = (UnboxingError)(nil)
