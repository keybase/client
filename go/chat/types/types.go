package types

import (
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

var ActionNewConversation = "newConversation"
var ActionNewMessage = "newMessage"
var ActionReadMessage = "readMessage"
var ActionSetStatus = "setStatus"
var ActionSetAppNotificationSettings = "setAppNotificationSettings"

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
