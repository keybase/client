package types

import (
	"fmt"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

var ActionNewConversation = "newConversation"
var ActionNewMessage = "newMessage"
var ActionReadMessage = "readMessage"
var ActionSetStatus = "setStatus"
var ActionSetAppNotificationSettings = "setAppNotificationSettings"
var ActionTeamType = "teamType"
var ActionExpunge = "expunge"

var PushActivity = "chat.activity"
var PushTyping = "chat.typing"
var PushMembershipUpdate = "chat.membershipUpdate"
var PushTLFFinalize = "chat.tlffinalize"
var PushTLFResolve = "chat.tlfresolve"
var PushTeamChannels = "chat.teamchannels"
var PushKBFSUpgrade = "chat.kbfsupgrade"
var PushConvRetention = "chat.convretention"
var PushTeamRetention = "chat.teamretention"

func NewAllCryptKeys() AllCryptKeys {
	return make(AllCryptKeys)
}

type NameInfo struct {
	ID               chat1.TLFID
	CanonicalName    string
	IdentifyFailures []keybase1.TLFIdentifyFailure
	CryptKeys        map[chat1.ConversationMembersType][]CryptKey
}

func NewNameInfo() *NameInfo {
	return &NameInfo{
		CryptKeys: make(map[chat1.ConversationMembersType][]CryptKey),
	}
}

type MembershipUpdateRes struct {
	UserJoinedConvs    []chat1.ConversationLocal
	UserRemovedConvs   []chat1.ConversationID
	UserResetConvs     []chat1.ConversationID
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
