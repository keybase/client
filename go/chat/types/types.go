package types

import (
	"errors"
	"fmt"
	"io"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	context "golang.org/x/net/context"
)

const (
	ActionNewConversation            = "newConversation"
	ActionNewMessage                 = "newMessage"
	ActionReadMessage                = "readMessage"
	ActionSetStatus                  = "setStatus"
	ActionSetAppNotificationSettings = "setAppNotificationSettings"
	ActionTeamType                   = "teamType"
	ActionExpunge                    = "expunge"

	PushActivity            = "chat.activity"
	PushTyping              = "chat.typing"
	PushMembershipUpdate    = "chat.membershipUpdate"
	PushTLFFinalize         = "chat.tlffinalize"
	PushTLFResolve          = "chat.tlfresolve"
	PushTeamChannels        = "chat.teamchannels"
	PushKBFSUpgrade         = "chat.kbfsupgrade"
	PushConvRetention       = "chat.convretention"
	PushTeamRetention       = "chat.teamretention"
	PushConvSettings        = "chat.convsettings"
	PushSubteamRename       = "chat.subteamrename"
	PushConversationsUpdate = "chat.conversationsupdate"

	MapsDomain = "keybasemaps"
)

func NewAllCryptKeys() AllCryptKeys {
	return make(AllCryptKeys)
}

type NameInfo struct {
	ID            chat1.TLFID
	CanonicalName string
}

func NewNameInfo() *NameInfo {
	return &NameInfo{}
}

type MembershipUpdateRes struct {
	UserJoinedConvs    []chat1.ConversationLocal
	UserRemovedConvs   []chat1.ConversationMember
	UserResetConvs     []chat1.ConversationMember
	OthersJoinedConvs  []chat1.ConversationMember
	OthersRemovedConvs []chat1.ConversationMember
	OthersResetConvs   []chat1.ConversationMember
}

func (m MembershipUpdateRes) AllOtherUsers() (res []gregor1.UID) {
	for _, cm := range append(m.OthersResetConvs, append(m.OthersJoinedConvs, m.OthersRemovedConvs...)...) {
		res = append(res, cm.Uid)
	}
	return res
}

type InboxSourceDataSourceTyp int

const (
	InboxSourceDataSourceAll InboxSourceDataSourceTyp = iota
	InboxSourceDataSourceRemoteOnly
	InboxSourceDataSourceLocalOnly
)

type RemoteConversationMetadata struct {
	Name              string   `codec:"n"`
	TopicName         string   `codec:"t"`
	Snippet           string   `codec:"s"`
	SnippetDecoration string   `codec:"d"`
	Headline          string   `codec:"h"`
	WriterNames       []string `codec:"w"`
	ResetParticipants []string `codec:"r"`
}

type RemoteConversation struct {
	Conv           chat1.Conversation          `codec:"c"`
	LocalMetadata  *RemoteConversationMetadata `codec:"l"`
	LocalReadMsgID chat1.MessageID             `codec:"r"`
	LocalDraft     *string                     `codec:"d"`
}

func (rc RemoteConversation) GetMtime() gregor1.Time {
	return rc.Conv.GetMtime()
}

func (rc RemoteConversation) GetConvID() chat1.ConversationID {
	return rc.Conv.GetConvID()
}

func (rc RemoteConversation) GetVersion() chat1.ConversationVers {
	return rc.Conv.Metadata.Version
}

func (rc RemoteConversation) GetMembersType() chat1.ConversationMembersType {
	return rc.Conv.GetMembersType()
}

func (rc RemoteConversation) GetTeamType() chat1.TeamType {
	return rc.Conv.GetTeamType()
}

func (rc RemoteConversation) GetTopicName() string {
	if rc.LocalMetadata != nil {
		return rc.LocalMetadata.TopicName
	}
	return ""
}

func (rc RemoteConversation) GetTLFName() string {
	if len(rc.Conv.MaxMsgSummaries) == 0 {
		return ""
	}
	return rc.Conv.MaxMsgSummaries[0].TlfName
}

func (rc RemoteConversation) GetName() string {
	switch rc.Conv.Metadata.TeamType {
	case chat1.TeamType_COMPLEX:
		if rc.LocalMetadata != nil && len(rc.Conv.MaxMsgSummaries) > 0 {
			return fmt.Sprintf("%s#%s", rc.Conv.MaxMsgSummaries[0].TlfName, rc.LocalMetadata.TopicName)
		}
		fallthrough
	default:
		if len(rc.Conv.MaxMsgSummaries) == 0 {
			return ""
		}
		return rc.Conv.MaxMsgSummaries[0].TlfName
	}
}

func (rc RemoteConversation) GetTopicType() chat1.TopicType {
	return rc.Conv.GetTopicType()
}

func (rc RemoteConversation) IsLocallyRead() bool {
	return rc.LocalReadMsgID >= rc.Conv.MaxVisibleMsgID()
}

type UnboxMode int

const (
	UnboxModeFull UnboxMode = iota
	UnboxModeQuick
)

func (m UnboxMode) ShouldCache() bool {
	switch m {
	case UnboxModeFull:
		return true
	case UnboxModeQuick:
		return false
	}
	return true
}

type Inbox struct {
	Version         chat1.InboxVers
	ConvsUnverified []RemoteConversation
	Convs           []chat1.ConversationLocal
	Pagination      *chat1.Pagination
}

type ConvLoaderPriority int

var (
	ConvLoaderPriorityHighest ConvLoaderPriority = 10
	ConvLoaderPriorityHigh    ConvLoaderPriority = 7
	ConvLoaderPriorityMedium  ConvLoaderPriority = 5
	ConvLoaderPriorityLow     ConvLoaderPriority = 3
	ConvLoaderPriorityLowest  ConvLoaderPriority
)

func (c ConvLoaderPriority) HigherThan(c2 ConvLoaderPriority) bool {
	return int(c) > int(c2)
}

type ConvLoaderJob struct {
	ConvID       chat1.ConversationID
	Query        *chat1.GetThreadQuery
	Pagination   *chat1.Pagination
	Priority     ConvLoaderPriority
	PostLoadHook func(context.Context, chat1.ThreadView, ConvLoaderJob)
}

func (j ConvLoaderJob) HigherPriorityThan(j2 ConvLoaderJob) bool {
	return j.Priority.HigherThan(j2.Priority)
}

func (j ConvLoaderJob) String() string {
	return fmt.Sprintf("[convID: %s pagination: %s]", j.ConvID, j.Pagination)
}

func NewConvLoaderJob(convID chat1.ConversationID, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination, priority ConvLoaderPriority,
	postLoadHook func(context.Context, chat1.ThreadView, ConvLoaderJob)) ConvLoaderJob {
	return ConvLoaderJob{
		ConvID:       convID,
		Query:        query,
		Pagination:   pagination,
		Priority:     priority,
		PostLoadHook: postLoadHook,
	}
}

type AsyncInboxResult struct {
	Conv      RemoteConversation
	ConvLocal chat1.ConversationLocal
	InboxRes  *Inbox // set if we are returning the whole inbox
}

type ConversationLocalizerTyp int

const (
	ConversationLocalizerBlocking ConversationLocalizerTyp = iota
	ConversationLocalizerNonblocking
)

type AttachmentUploaderTaskStatus int

const (
	AttachmentUploaderTaskStatusUploading AttachmentUploaderTaskStatus = iota
	AttachmentUploaderTaskStatusSuccess
	AttachmentUploaderTaskStatusFailed
)

type FlipSendStatus int

const (
	FlipSendStatusInProgress FlipSendStatus = iota
	FlipSendStatusSent
	FlipSendStatusError
)

type AttachmentUploadResult struct {
	Error    *string
	Object   chat1.Asset
	Preview  *chat1.Asset
	Metadata []byte
}

type BoxerEncryptionInfo struct {
	Key                   CryptKey
	SigningKeyPair        libkb.NaclSigningKeyPair
	EphemeralKey          EphemeralCryptKey
	PairwiseMACRecipients []keybase1.KID
	Version               chat1.MessageBoxedVersion
}

type SenderPrepareOptions struct {
	SkipTopicNameState bool
}

type SenderPrepareResult struct {
	Boxed               chat1.MessageBoxed
	EncryptionInfo      BoxerEncryptionInfo
	PendingAssetDeletes []chat1.Asset
	AtMentions          []gregor1.UID
	ChannelMention      chat1.ChannelMention
	TopicNameState      *chat1.TopicNameState
}

type ParsedStellarPayment struct {
	Username libkb.NormalizedUsername
	Full     string
	Amount   string
	Currency string
}

func (p ParsedStellarPayment) ToMini() libkb.MiniChatPayment {
	return libkb.MiniChatPayment{
		Username: p.Username,
		Amount:   p.Amount,
		Currency: p.Currency,
	}
}

type DummyAttachmentFetcher struct{}

var _ AttachmentFetcher = (*DummyAttachmentFetcher)(nil)

func (d DummyAttachmentFetcher) FetchAttachment(ctx context.Context, w io.Writer,
	convID chat1.ConversationID, asset chat1.Asset, r func() chat1.RemoteInterface, signer s3.Signer,
	progress ProgressReporter) error {
	return nil
}

func (d DummyAttachmentFetcher) StreamAttachment(ctx context.Context, convID chat1.ConversationID,
	asset chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (io.ReadSeeker, error) {
	return nil, nil
}

func (d DummyAttachmentFetcher) DeleteAssets(ctx context.Context,
	convID chat1.ConversationID, assets []chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (err error) {
	return nil
}

func (d DummyAttachmentFetcher) PutUploadedAsset(ctx context.Context, filename string, asset chat1.Asset) error {
	return nil
}

func (d DummyAttachmentFetcher) IsAssetLocal(ctx context.Context, asset chat1.Asset) (bool, error) {
	return false, nil
}
func (d DummyAttachmentFetcher) OnDbNuke(mctx libkb.MetaContext) error { return nil }
func (d DummyAttachmentFetcher) OnStart(mctx libkb.MetaContext)        {}

type DummyAttachmentHTTPSrv struct{}

var _ AttachmentURLSrv = (*DummyAttachmentHTTPSrv)(nil)

func (d DummyAttachmentHTTPSrv) GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
	preview bool) string {
	return ""
}

func (d DummyAttachmentHTTPSrv) GetPendingPreviewURL(ctx context.Context, outboxID chat1.OutboxID) string {
	return ""
}

func (d DummyAttachmentHTTPSrv) GetUnfurlAssetURL(ctx context.Context, convID chat1.ConversationID,
	asset chat1.Asset) string {
	return ""
}

func (d DummyAttachmentHTTPSrv) GetAttachmentFetcher() AttachmentFetcher {
	return DummyAttachmentFetcher{}
}

func (d DummyAttachmentHTTPSrv) GetGiphyURL(ctx context.Context, giphyURL string) string {
	return ""
}
func (d DummyAttachmentHTTPSrv) GetGiphyGalleryURL(ctx context.Context, convID chat1.ConversationID,
	tlfName string, results []chat1.GiphySearchResult) string {
	return ""
}
func (d DummyAttachmentHTTPSrv) OnDbNuke(mctx libkb.MetaContext) error { return nil }

type DummyStellarLoader struct{}

var _ StellarLoader = (*DummyStellarLoader)(nil)

func (d DummyStellarLoader) LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo {
	return nil
}

func (d DummyStellarLoader) LoadRequest(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo {
	return nil
}

type DummyEphemeralPurger struct{}

var _ EphemeralPurger = (*DummyEphemeralPurger)(nil)

func (d DummyEphemeralPurger) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyEphemeralPurger) Stop(ctx context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}
func (d DummyEphemeralPurger) Queue(ctx context.Context, purgeInfo chat1.EphemeralPurgeInfo) error {
	return nil
}

type DummyIndexer struct{}

var _ Indexer = (*DummyIndexer)(nil)

func (d DummyIndexer) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyIndexer) Stop(ctx context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}
func (d DummyIndexer) Suspend(ctx context.Context) bool {
	return false
}
func (d DummyIndexer) Resume(ctx context.Context) bool {
	return false
}
func (d DummyIndexer) Search(ctx context.Context, uid gregor1.UID, query, origQuery string,
	opts chat1.SearchOpts, hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus) (*chat1.ChatSearchInboxResults, error) {
	return nil, nil
}
func (d DummyIndexer) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error {
	return nil
}
func (d DummyIndexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error {
	return nil
}
func (d DummyIndexer) SearchableConvs(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID) ([]RemoteConversation, error) {
	return nil, nil
}
func (d DummyIndexer) IndexInbox(ctx context.Context, uid gregor1.UID) (map[string]chat1.ProfileSearchConvStats, error) {
	return nil, nil
}
func (d DummyIndexer) IsBackgroundActive() bool { return false }
func (d DummyIndexer) ClearCache()              {}
func (d DummyIndexer) OnLogout(mctx libkb.MetaContext) error {
	return nil
}
func (d DummyIndexer) OnDbNuke(mctx libkb.MetaContext) error {
	return nil
}
func (d DummyIndexer) FullyIndexed(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (bool, error) {
	return false, nil
}
func (d DummyIndexer) PercentIndexed(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (int, error) {
	return 0, nil
}

type DummyNativeVideoHelper struct{}

var _ NativeVideoHelper = (*DummyNativeVideoHelper)(nil)

func (d DummyNativeVideoHelper) ThumbnailAndDuration(ctx context.Context, filename string) ([]byte, int, error) {
	return nil, 0, nil
}

type UnfurlerTaskStatus int

const (
	UnfurlerTaskStatusUnfurling UnfurlerTaskStatus = iota
	UnfurlerTaskStatusSuccess
	UnfurlerTaskStatusFailed
	UnfurlerTaskStatusPermFailed
)

type DummyUnfurler struct{}

var _ Unfurler = (*DummyUnfurler)(nil)

func (d DummyUnfurler) UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) {
}
func (d DummyUnfurler) Prefetch(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, msgText string) int {
	return 0
}
func (d DummyUnfurler) Status(ctx context.Context, outboxID chat1.OutboxID) (UnfurlerTaskStatus, *chat1.UnfurlResult, error) {
	return UnfurlerTaskStatusFailed, nil, nil
}
func (d DummyUnfurler) Retry(ctx context.Context, outboxID chat1.OutboxID)    {}
func (d DummyUnfurler) Complete(ctx context.Context, outboxID chat1.OutboxID) {}

func (d DummyUnfurler) GetSettings(ctx context.Context, uid gregor1.UID) (res chat1.UnfurlSettings, err error) {
	return res, nil
}

func (d DummyUnfurler) WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) error {
	return nil
}

func (d DummyUnfurler) WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) error {
	return nil
}

func (d DummyUnfurler) WhitelistAddExemption(ctx context.Context, uid gregor1.UID,
	exemption WhitelistExemption) {
}

func (d DummyUnfurler) SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) error {
	return nil
}

func (d DummyUnfurler) SetSettings(ctx context.Context, uid gregor1.UID, settings chat1.UnfurlSettings) error {
	return nil
}

type DummyStellarSender struct{}

var _ StellarSender = (*DummyStellarSender)(nil)

func (d DummyStellarSender) ParsePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	body string) []ParsedStellarPayment {
	return nil
}

func (d DummyStellarSender) DescribePayments(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, payments []ParsedStellarPayment) (res chat1.UIChatPaymentSummary, toSend []ParsedStellarPayment, err error) {
	return res, toSend, nil
}

func (d DummyStellarSender) SendPayments(ctx context.Context, convID chat1.ConversationID, payments []ParsedStellarPayment) ([]chat1.TextPayment, error) {
	return nil, nil
}

func (d DummyStellarSender) DecorateWithPayments(ctx context.Context, body string,
	payments []chat1.TextPayment) string {
	return body
}

type DummyCoinFlipManager struct{}

var _ CoinFlipManager = (*DummyCoinFlipManager)(nil)

func (d DummyCoinFlipManager) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyCoinFlipManager) Stop(ctx context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}
func (d DummyCoinFlipManager) StartFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID, tlfName, text string, outboxID *chat1.OutboxID) error {
	return nil
}
func (d DummyCoinFlipManager) MaybeInjectFlipMessage(ctx context.Context, boxedMsg chat1.MessageBoxed,
	inboxVers chat1.InboxVers, uid gregor1.UID, convID chat1.ConversationID, topicType chat1.TopicType) bool {
	return false
}

func (d DummyCoinFlipManager) LoadFlip(ctx context.Context, uid gregor1.UID, hostConvID chat1.ConversationID,
	hostMsgID chat1.MessageID, flipConvID chat1.ConversationID, gameID chat1.FlipGameID) (chan chat1.UICoinFlipStatus, chan error) {
	return nil, nil
}

func (d DummyCoinFlipManager) DescribeFlipText(ctx context.Context, text string) string { return "" }

func (d DummyCoinFlipManager) HasActiveGames(ctx context.Context) bool {
	return false
}

func (d DummyCoinFlipManager) IsFlipConversationCreated(ctx context.Context, outboxID chat1.OutboxID) (chat1.ConversationID, FlipSendStatus) {
	return nil, FlipSendStatusError
}

type DummyTeamMentionLoader struct{}

func (d DummyTeamMentionLoader) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyTeamMentionLoader) Stop(ctx context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}

func (d DummyTeamMentionLoader) LoadTeamMention(ctx context.Context, uid gregor1.UID,
	maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention,
	forceRemote bool) error {
	return nil
}

func (d DummyTeamMentionLoader) IsTeamMention(ctx context.Context, uid gregor1.UID,
	maybeMention chat1.MaybeMention, knownTeamMentions []chat1.KnownTeamMention) bool {
	return false
}

type DummyExternalAPIKeySource struct{}

func (d DummyExternalAPIKeySource) GetKey(ctx context.Context, typ chat1.ExternalAPIKeyTyp) (res chat1.ExternalAPIKey, err error) {
	switch typ {
	case chat1.ExternalAPIKeyTyp_GIPHY:
		return chat1.NewExternalAPIKeyWithGiphy(""), nil
	case chat1.ExternalAPIKeyTyp_GOOGLEMAPS:
		return chat1.NewExternalAPIKeyWithGooglemaps(""), nil
	}
	return res, errors.New("dummy doesnt know about key typ")
}

func (d DummyExternalAPIKeySource) GetAllKeys(ctx context.Context) (res []chat1.ExternalAPIKey, err error) {
	return res, nil
}

type DummyBotCommandManager struct{}

func (d DummyBotCommandManager) Advertise(ctx context.Context, alias *string,
	ads []chat1.AdvertiseCommandsParam) error {
	return nil
}

func (d DummyBotCommandManager) Clear(context.Context) error { return nil }

func (d DummyBotCommandManager) ListCommands(ctx context.Context, convID chat1.ConversationID) ([]chat1.UserBotCommandOutput, error) {
	return nil, nil
}

func (d DummyBotCommandManager) UpdateCommands(ctx context.Context, convID chat1.ConversationID,
	info *chat1.BotInfo) (chan error, error) {
	ch := make(chan error, 1)
	ch <- nil
	return ch, nil
}

func (d DummyBotCommandManager) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyBotCommandManager) Stop(ctx context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}
