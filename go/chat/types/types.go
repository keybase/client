package types

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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

type NameInfoUntrusted struct {
	ID            chat1.TLFID
	CanonicalName string
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

func NewConvLoaderJob(convID chat1.ConversationID, pagination *chat1.Pagination, priority ConvLoaderPriority,
	postLoadHook func(context.Context, chat1.ThreadView, ConvLoaderJob)) ConvLoaderJob {
	return ConvLoaderJob{
		ConvID:       convID,
		Pagination:   pagination,
		Priority:     priority,
		PostLoadHook: postLoadHook,
	}
}

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

func (d DummyAttachmentHTTPSrv) GetAttachmentFetcher() AttachmentFetcher {
	return DummyAttachmentFetcher{}
}
