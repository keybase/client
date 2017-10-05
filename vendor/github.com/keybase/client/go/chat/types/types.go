package types

import (
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

var ActionNewConversation = "newConversation"
var ActionNewMessage = "newMessage"
var ActionReadMessage = "readMessage"
var ActionSetStatus = "setStatus"
var ActionSetAppNotificationSettings = "setAppNotificationSettings"
var ActionTeamType = "teamType"

var PushActivity = "chat.activity"
var PushTyping = "chat.typing"
var PushMembershipUpdate = "chat.membershipUpdate"
var PushTLFFinalize = "chat.tlffinalize"
var PushTLFResolve = "chat.tlfresolve"

type NameInfo struct {
	ID               chat1.TLFID
	CanonicalName    string
	IdentifyFailures []keybase1.TLFIdentifyFailure
	CryptKeys        []CryptKey
}

type MembershipUpdateRes struct {
	UserJoinedConvs    []chat1.ConversationLocal
	UserRemovedConvs   []chat1.ConversationID
	OthersJoinedConvs  []chat1.ConversationMember
	OthersRemovedConvs []chat1.ConversationMember
}

type RemoteConversationMetadata struct {
	TopicName   string   `codec:"t"`
	Snippet     string   `codec:"s"`
	Headline    string   `codec:"h"`
	WriterNames []string `codec:"w"`
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

type Inbox struct {
	Version         chat1.InboxVers
	ConvsUnverified []RemoteConversation
	Convs           []chat1.ConversationLocal
	Pagination      *chat1.Pagination
}
