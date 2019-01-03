package types

import (
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

	PushActivity         = "chat.activity"
	PushTyping           = "chat.typing"
	PushMembershipUpdate = "chat.membershipUpdate"
	PushTLFFinalize      = "chat.tlffinalize"
	PushTLFResolve       = "chat.tlfresolve"
	PushTeamChannels     = "chat.teamchannels"
	PushKBFSUpgrade      = "chat.kbfsupgrade"
	PushConvRetention    = "chat.convretention"
	PushTeamRetention    = "chat.teamretention"
	PushConvSettings     = "chat.convsettings"
	PushSubteamRename    = "chat.subteamrename"
)

func NewAllCryptKeys() AllCryptKeys {
	return make(AllCryptKeys)
}

type NameInfo struct {
	ID               chat1.TLFID
	CanonicalName    string
	IdentifyFailures []keybase1.TLFIdentifyFailure
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
	Conv          chat1.Conversation          `codec:"c"`
	LocalMetadata *RemoteConversationMetadata `codec:"l"`
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
	Conv      chat1.Conversation
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

type AttachmentUploadResult struct {
	Error    *string
	Object   chat1.Asset
	Preview  *chat1.Asset
	Metadata []byte
}

type BoxerEncryptionInfo struct {
	Key                   CryptKey
	SigningKeyPair        libkb.NaclSigningKeyPair
	EphemeralSeed         *keybase1.TeamEk
	PairwiseMACRecipients []keybase1.KID
	Version               chat1.MessageBoxedVersion
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

type DummyAttachmentHTTPSrv struct{}

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

type DummyStellarLoader struct{}

func (d DummyStellarLoader) LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo {
	return nil
}

func (d DummyStellarLoader) LoadRequest(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo {
	return nil
}

type DummyEphemeralPurger struct{}

func (d DummyEphemeralPurger) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyEphemeralPurger) Stop(ctx context.Context) chan struct{} {
	return nil
}
func (d DummyEphemeralPurger) Queue(ctx context.Context, purgeInfo chat1.EphemeralPurgeInfo) error {
	return nil
}

type DummyIndexer struct{}

func (d DummyIndexer) Start(ctx context.Context, uid gregor1.UID) {}
func (d DummyIndexer) Stop(ctx context.Context) chan struct{} {
	return nil
}
func (d DummyIndexer) Search(ctx context.Context, uid gregor1.UID, query string, opts chat1.SearchOpts,
	hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus) (*chat1.ChatSearchInboxResults, error) {
	return nil, nil
}
func (d DummyIndexer) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error {
	return nil
}
func (d DummyIndexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msg []chat1.MessageUnboxed) error {
	return nil
}
func (d DummyIndexer) IndexInbox(ctx context.Context, uid gregor1.UID) (map[string]chat1.ProfileSearchConvStats, error) {
	return nil, nil
}

type DummyNativeVideoHelper struct{}

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
