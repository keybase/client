// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/chat1/notify.avdl

package chat1

import (
	"errors"
	"fmt"

	keybase1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
)

type ChatActivitySource int

const (
	ChatActivitySource_LOCAL  ChatActivitySource = 0
	ChatActivitySource_REMOTE ChatActivitySource = 1
)

func (o ChatActivitySource) DeepCopy() ChatActivitySource { return o }

var ChatActivitySourceMap = map[string]ChatActivitySource{
	"LOCAL":  0,
	"REMOTE": 1,
}

var ChatActivitySourceRevMap = map[ChatActivitySource]string{
	0: "LOCAL",
	1: "REMOTE",
}

func (e ChatActivitySource) String() string {
	if v, ok := ChatActivitySourceRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ChatActivityType int

const (
	ChatActivityType_RESERVED                      ChatActivityType = 0
	ChatActivityType_INCOMING_MESSAGE              ChatActivityType = 1
	ChatActivityType_READ_MESSAGE                  ChatActivityType = 2
	ChatActivityType_NEW_CONVERSATION              ChatActivityType = 3
	ChatActivityType_SET_STATUS                    ChatActivityType = 4
	ChatActivityType_FAILED_MESSAGE                ChatActivityType = 5
	ChatActivityType_MEMBERS_UPDATE                ChatActivityType = 6
	ChatActivityType_SET_APP_NOTIFICATION_SETTINGS ChatActivityType = 7
	ChatActivityType_TEAMTYPE                      ChatActivityType = 8
	ChatActivityType_EXPUNGE                       ChatActivityType = 9
	ChatActivityType_EPHEMERAL_PURGE               ChatActivityType = 10
	ChatActivityType_REACTION_UPDATE               ChatActivityType = 11
	ChatActivityType_MESSAGES_UPDATED              ChatActivityType = 12
)

func (o ChatActivityType) DeepCopy() ChatActivityType { return o }

var ChatActivityTypeMap = map[string]ChatActivityType{
	"RESERVED":                      0,
	"INCOMING_MESSAGE":              1,
	"READ_MESSAGE":                  2,
	"NEW_CONVERSATION":              3,
	"SET_STATUS":                    4,
	"FAILED_MESSAGE":                5,
	"MEMBERS_UPDATE":                6,
	"SET_APP_NOTIFICATION_SETTINGS": 7,
	"TEAMTYPE":                      8,
	"EXPUNGE":                       9,
	"EPHEMERAL_PURGE":               10,
	"REACTION_UPDATE":               11,
	"MESSAGES_UPDATED":              12,
}

var ChatActivityTypeRevMap = map[ChatActivityType]string{
	0:  "RESERVED",
	1:  "INCOMING_MESSAGE",
	2:  "READ_MESSAGE",
	3:  "NEW_CONVERSATION",
	4:  "SET_STATUS",
	5:  "FAILED_MESSAGE",
	6:  "MEMBERS_UPDATE",
	7:  "SET_APP_NOTIFICATION_SETTINGS",
	8:  "TEAMTYPE",
	9:  "EXPUNGE",
	10: "EPHEMERAL_PURGE",
	11: "REACTION_UPDATE",
	12: "MESSAGES_UPDATED",
}

func (e ChatActivityType) String() string {
	if v, ok := ChatActivityTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type IncomingMessage struct {
	Message                    UIMessage      `codec:"message" json:"message"`
	ModifiedMessage            *UIMessage     `codec:"modifiedMessage,omitempty" json:"modifiedMessage,omitempty"`
	ConvID                     ConversationID `codec:"convID" json:"convID"`
	DisplayDesktopNotification bool           `codec:"displayDesktopNotification" json:"displayDesktopNotification"`
	DesktopNotificationSnippet string         `codec:"desktopNotificationSnippet" json:"desktopNotificationSnippet"`
	Conv                       *InboxUIItem   `codec:"conv,omitempty" json:"conv,omitempty"`
	Pagination                 *UIPagination  `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

func (o IncomingMessage) DeepCopy() IncomingMessage {
	return IncomingMessage{
		Message: o.Message.DeepCopy(),
		ModifiedMessage: (func(x *UIMessage) *UIMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ModifiedMessage),
		ConvID:                     o.ConvID.DeepCopy(),
		DisplayDesktopNotification: o.DisplayDesktopNotification,
		DesktopNotificationSnippet: o.DesktopNotificationSnippet,
		Conv: (func(x *InboxUIItem) *InboxUIItem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
		Pagination: (func(x *UIPagination) *UIPagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pagination),
	}
}

type ReadMessageInfo struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	MsgID  MessageID      `codec:"msgID" json:"msgID"`
	Conv   *InboxUIItem   `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o ReadMessageInfo) DeepCopy() ReadMessageInfo {
	return ReadMessageInfo{
		ConvID: o.ConvID.DeepCopy(),
		MsgID:  o.MsgID.DeepCopy(),
		Conv: (func(x *InboxUIItem) *InboxUIItem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
	}
}

type NewConversationInfo struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Conv   *InboxUIItem   `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o NewConversationInfo) DeepCopy() NewConversationInfo {
	return NewConversationInfo{
		ConvID: o.ConvID.DeepCopy(),
		Conv: (func(x *InboxUIItem) *InboxUIItem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
	}
}

type SetStatusInfo struct {
	ConvID ConversationID     `codec:"convID" json:"convID"`
	Status ConversationStatus `codec:"status" json:"status"`
	Conv   *InboxUIItem       `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o SetStatusInfo) DeepCopy() SetStatusInfo {
	return SetStatusInfo{
		ConvID: o.ConvID.DeepCopy(),
		Status: o.Status.DeepCopy(),
		Conv: (func(x *InboxUIItem) *InboxUIItem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
	}
}

type SetAppNotificationSettingsInfo struct {
	ConvID   ConversationID               `codec:"convID" json:"convID"`
	Settings ConversationNotificationInfo `codec:"settings" json:"settings"`
}

func (o SetAppNotificationSettingsInfo) DeepCopy() SetAppNotificationSettingsInfo {
	return SetAppNotificationSettingsInfo{
		ConvID:   o.ConvID.DeepCopy(),
		Settings: o.Settings.DeepCopy(),
	}
}

type FailedMessageInfo struct {
	OutboxRecords    []OutboxRecord `codec:"outboxRecords" json:"outboxRecords"`
	IsEphemeralPurge bool           `codec:"isEphemeralPurge" json:"isEphemeralPurge"`
	Conv             *InboxUIItem   `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o FailedMessageInfo) DeepCopy() FailedMessageInfo {
	return FailedMessageInfo{
		OutboxRecords: (func(x []OutboxRecord) []OutboxRecord {
			if x == nil {
				return nil
			}
			ret := make([]OutboxRecord, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.OutboxRecords),
		IsEphemeralPurge: o.IsEphemeralPurge,
		Conv: (func(x *InboxUIItem) *InboxUIItem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
	}
}

type MemberInfo struct {
	Member string                   `codec:"member" json:"member"`
	Status ConversationMemberStatus `codec:"status" json:"status"`
}

func (o MemberInfo) DeepCopy() MemberInfo {
	return MemberInfo{
		Member: o.Member,
		Status: o.Status.DeepCopy(),
	}
}

type MembersUpdateInfo struct {
	ConvID  ConversationID `codec:"convID" json:"convID"`
	Members []MemberInfo   `codec:"members" json:"members"`
}

func (o MembersUpdateInfo) DeepCopy() MembersUpdateInfo {
	return MembersUpdateInfo{
		ConvID: o.ConvID.DeepCopy(),
		Members: (func(x []MemberInfo) []MemberInfo {
			if x == nil {
				return nil
			}
			ret := make([]MemberInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Members),
	}
}

type TeamTypeInfo struct {
	ConvID   ConversationID `codec:"convID" json:"convID"`
	TeamType TeamType       `codec:"teamType" json:"teamType"`
	Conv     *InboxUIItem   `codec:"conv,omitempty" json:"conv,omitempty"`
}

func (o TeamTypeInfo) DeepCopy() TeamTypeInfo {
	return TeamTypeInfo{
		ConvID:   o.ConvID.DeepCopy(),
		TeamType: o.TeamType.DeepCopy(),
		Conv: (func(x *InboxUIItem) *InboxUIItem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
	}
}

type ExpungeInfo struct {
	ConvID  ConversationID `codec:"convID" json:"convID"`
	Expunge Expunge        `codec:"expunge" json:"expunge"`
}

func (o ExpungeInfo) DeepCopy() ExpungeInfo {
	return ExpungeInfo{
		ConvID:  o.ConvID.DeepCopy(),
		Expunge: o.Expunge.DeepCopy(),
	}
}

type EphemeralPurgeNotifInfo struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Msgs   []UIMessage    `codec:"msgs" json:"msgs"`
}

func (o EphemeralPurgeNotifInfo) DeepCopy() EphemeralPurgeNotifInfo {
	return EphemeralPurgeNotifInfo{
		ConvID: o.ConvID.DeepCopy(),
		Msgs: (func(x []UIMessage) []UIMessage {
			if x == nil {
				return nil
			}
			ret := make([]UIMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Msgs),
	}
}

type ReactionUpdate struct {
	Reactions   ReactionMap `codec:"reactions" json:"reactions"`
	TargetMsgID MessageID   `codec:"targetMsgID" json:"targetMsgID"`
}

func (o ReactionUpdate) DeepCopy() ReactionUpdate {
	return ReactionUpdate{
		Reactions:   o.Reactions.DeepCopy(),
		TargetMsgID: o.TargetMsgID.DeepCopy(),
	}
}

type ReactionUpdateNotif struct {
	ConvID          ConversationID       `codec:"convID" json:"convID"`
	UserReacjis     keybase1.UserReacjis `codec:"userReacjis" json:"userReacjis"`
	ReactionUpdates []ReactionUpdate     `codec:"reactionUpdates" json:"reactionUpdates"`
}

func (o ReactionUpdateNotif) DeepCopy() ReactionUpdateNotif {
	return ReactionUpdateNotif{
		ConvID:      o.ConvID.DeepCopy(),
		UserReacjis: o.UserReacjis.DeepCopy(),
		ReactionUpdates: (func(x []ReactionUpdate) []ReactionUpdate {
			if x == nil {
				return nil
			}
			ret := make([]ReactionUpdate, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ReactionUpdates),
	}
}

type MessagesUpdated struct {
	ConvID  ConversationID `codec:"convID" json:"convID"`
	Updates []UIMessage    `codec:"updates" json:"updates"`
}

func (o MessagesUpdated) DeepCopy() MessagesUpdated {
	return MessagesUpdated{
		ConvID: o.ConvID.DeepCopy(),
		Updates: (func(x []UIMessage) []UIMessage {
			if x == nil {
				return nil
			}
			ret := make([]UIMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Updates),
	}
}

type ChatActivity struct {
	ActivityType__               ChatActivityType                `codec:"activityType" json:"activityType"`
	IncomingMessage__            *IncomingMessage                `codec:"incomingMessage,omitempty" json:"incomingMessage,omitempty"`
	ReadMessage__                *ReadMessageInfo                `codec:"readMessage,omitempty" json:"readMessage,omitempty"`
	NewConversation__            *NewConversationInfo            `codec:"newConversation,omitempty" json:"newConversation,omitempty"`
	SetStatus__                  *SetStatusInfo                  `codec:"setStatus,omitempty" json:"setStatus,omitempty"`
	FailedMessage__              *FailedMessageInfo              `codec:"failedMessage,omitempty" json:"failedMessage,omitempty"`
	MembersUpdate__              *MembersUpdateInfo              `codec:"membersUpdate,omitempty" json:"membersUpdate,omitempty"`
	SetAppNotificationSettings__ *SetAppNotificationSettingsInfo `codec:"setAppNotificationSettings,omitempty" json:"setAppNotificationSettings,omitempty"`
	Teamtype__                   *TeamTypeInfo                   `codec:"teamtype,omitempty" json:"teamtype,omitempty"`
	Expunge__                    *ExpungeInfo                    `codec:"expunge,omitempty" json:"expunge,omitempty"`
	EphemeralPurge__             *EphemeralPurgeNotifInfo        `codec:"ephemeralPurge,omitempty" json:"ephemeralPurge,omitempty"`
	ReactionUpdate__             *ReactionUpdateNotif            `codec:"reactionUpdate,omitempty" json:"reactionUpdate,omitempty"`
	MessagesUpdated__            *MessagesUpdated                `codec:"messagesUpdated,omitempty" json:"messagesUpdated,omitempty"`
}

func (o *ChatActivity) ActivityType() (ret ChatActivityType, err error) {
	switch o.ActivityType__ {
	case ChatActivityType_INCOMING_MESSAGE:
		if o.IncomingMessage__ == nil {
			err = errors.New("unexpected nil value for IncomingMessage__")
			return ret, err
		}
	case ChatActivityType_READ_MESSAGE:
		if o.ReadMessage__ == nil {
			err = errors.New("unexpected nil value for ReadMessage__")
			return ret, err
		}
	case ChatActivityType_NEW_CONVERSATION:
		if o.NewConversation__ == nil {
			err = errors.New("unexpected nil value for NewConversation__")
			return ret, err
		}
	case ChatActivityType_SET_STATUS:
		if o.SetStatus__ == nil {
			err = errors.New("unexpected nil value for SetStatus__")
			return ret, err
		}
	case ChatActivityType_FAILED_MESSAGE:
		if o.FailedMessage__ == nil {
			err = errors.New("unexpected nil value for FailedMessage__")
			return ret, err
		}
	case ChatActivityType_MEMBERS_UPDATE:
		if o.MembersUpdate__ == nil {
			err = errors.New("unexpected nil value for MembersUpdate__")
			return ret, err
		}
	case ChatActivityType_SET_APP_NOTIFICATION_SETTINGS:
		if o.SetAppNotificationSettings__ == nil {
			err = errors.New("unexpected nil value for SetAppNotificationSettings__")
			return ret, err
		}
	case ChatActivityType_TEAMTYPE:
		if o.Teamtype__ == nil {
			err = errors.New("unexpected nil value for Teamtype__")
			return ret, err
		}
	case ChatActivityType_EXPUNGE:
		if o.Expunge__ == nil {
			err = errors.New("unexpected nil value for Expunge__")
			return ret, err
		}
	case ChatActivityType_EPHEMERAL_PURGE:
		if o.EphemeralPurge__ == nil {
			err = errors.New("unexpected nil value for EphemeralPurge__")
			return ret, err
		}
	case ChatActivityType_REACTION_UPDATE:
		if o.ReactionUpdate__ == nil {
			err = errors.New("unexpected nil value for ReactionUpdate__")
			return ret, err
		}
	case ChatActivityType_MESSAGES_UPDATED:
		if o.MessagesUpdated__ == nil {
			err = errors.New("unexpected nil value for MessagesUpdated__")
			return ret, err
		}
	}
	return o.ActivityType__, nil
}

func (o ChatActivity) IncomingMessage() (res IncomingMessage) {
	if o.ActivityType__ != ChatActivityType_INCOMING_MESSAGE {
		panic("wrong case accessed")
	}
	if o.IncomingMessage__ == nil {
		return
	}
	return *o.IncomingMessage__
}

func (o ChatActivity) ReadMessage() (res ReadMessageInfo) {
	if o.ActivityType__ != ChatActivityType_READ_MESSAGE {
		panic("wrong case accessed")
	}
	if o.ReadMessage__ == nil {
		return
	}
	return *o.ReadMessage__
}

func (o ChatActivity) NewConversation() (res NewConversationInfo) {
	if o.ActivityType__ != ChatActivityType_NEW_CONVERSATION {
		panic("wrong case accessed")
	}
	if o.NewConversation__ == nil {
		return
	}
	return *o.NewConversation__
}

func (o ChatActivity) SetStatus() (res SetStatusInfo) {
	if o.ActivityType__ != ChatActivityType_SET_STATUS {
		panic("wrong case accessed")
	}
	if o.SetStatus__ == nil {
		return
	}
	return *o.SetStatus__
}

func (o ChatActivity) FailedMessage() (res FailedMessageInfo) {
	if o.ActivityType__ != ChatActivityType_FAILED_MESSAGE {
		panic("wrong case accessed")
	}
	if o.FailedMessage__ == nil {
		return
	}
	return *o.FailedMessage__
}

func (o ChatActivity) MembersUpdate() (res MembersUpdateInfo) {
	if o.ActivityType__ != ChatActivityType_MEMBERS_UPDATE {
		panic("wrong case accessed")
	}
	if o.MembersUpdate__ == nil {
		return
	}
	return *o.MembersUpdate__
}

func (o ChatActivity) SetAppNotificationSettings() (res SetAppNotificationSettingsInfo) {
	if o.ActivityType__ != ChatActivityType_SET_APP_NOTIFICATION_SETTINGS {
		panic("wrong case accessed")
	}
	if o.SetAppNotificationSettings__ == nil {
		return
	}
	return *o.SetAppNotificationSettings__
}

func (o ChatActivity) Teamtype() (res TeamTypeInfo) {
	if o.ActivityType__ != ChatActivityType_TEAMTYPE {
		panic("wrong case accessed")
	}
	if o.Teamtype__ == nil {
		return
	}
	return *o.Teamtype__
}

func (o ChatActivity) Expunge() (res ExpungeInfo) {
	if o.ActivityType__ != ChatActivityType_EXPUNGE {
		panic("wrong case accessed")
	}
	if o.Expunge__ == nil {
		return
	}
	return *o.Expunge__
}

func (o ChatActivity) EphemeralPurge() (res EphemeralPurgeNotifInfo) {
	if o.ActivityType__ != ChatActivityType_EPHEMERAL_PURGE {
		panic("wrong case accessed")
	}
	if o.EphemeralPurge__ == nil {
		return
	}
	return *o.EphemeralPurge__
}

func (o ChatActivity) ReactionUpdate() (res ReactionUpdateNotif) {
	if o.ActivityType__ != ChatActivityType_REACTION_UPDATE {
		panic("wrong case accessed")
	}
	if o.ReactionUpdate__ == nil {
		return
	}
	return *o.ReactionUpdate__
}

func (o ChatActivity) MessagesUpdated() (res MessagesUpdated) {
	if o.ActivityType__ != ChatActivityType_MESSAGES_UPDATED {
		panic("wrong case accessed")
	}
	if o.MessagesUpdated__ == nil {
		return
	}
	return *o.MessagesUpdated__
}

func NewChatActivityWithIncomingMessage(v IncomingMessage) ChatActivity {
	return ChatActivity{
		ActivityType__:    ChatActivityType_INCOMING_MESSAGE,
		IncomingMessage__: &v,
	}
}

func NewChatActivityWithReadMessage(v ReadMessageInfo) ChatActivity {
	return ChatActivity{
		ActivityType__: ChatActivityType_READ_MESSAGE,
		ReadMessage__:  &v,
	}
}

func NewChatActivityWithNewConversation(v NewConversationInfo) ChatActivity {
	return ChatActivity{
		ActivityType__:    ChatActivityType_NEW_CONVERSATION,
		NewConversation__: &v,
	}
}

func NewChatActivityWithSetStatus(v SetStatusInfo) ChatActivity {
	return ChatActivity{
		ActivityType__: ChatActivityType_SET_STATUS,
		SetStatus__:    &v,
	}
}

func NewChatActivityWithFailedMessage(v FailedMessageInfo) ChatActivity {
	return ChatActivity{
		ActivityType__:  ChatActivityType_FAILED_MESSAGE,
		FailedMessage__: &v,
	}
}

func NewChatActivityWithMembersUpdate(v MembersUpdateInfo) ChatActivity {
	return ChatActivity{
		ActivityType__:  ChatActivityType_MEMBERS_UPDATE,
		MembersUpdate__: &v,
	}
}

func NewChatActivityWithSetAppNotificationSettings(v SetAppNotificationSettingsInfo) ChatActivity {
	return ChatActivity{
		ActivityType__:               ChatActivityType_SET_APP_NOTIFICATION_SETTINGS,
		SetAppNotificationSettings__: &v,
	}
}

func NewChatActivityWithTeamtype(v TeamTypeInfo) ChatActivity {
	return ChatActivity{
		ActivityType__: ChatActivityType_TEAMTYPE,
		Teamtype__:     &v,
	}
}

func NewChatActivityWithExpunge(v ExpungeInfo) ChatActivity {
	return ChatActivity{
		ActivityType__: ChatActivityType_EXPUNGE,
		Expunge__:      &v,
	}
}

func NewChatActivityWithEphemeralPurge(v EphemeralPurgeNotifInfo) ChatActivity {
	return ChatActivity{
		ActivityType__:   ChatActivityType_EPHEMERAL_PURGE,
		EphemeralPurge__: &v,
	}
}

func NewChatActivityWithReactionUpdate(v ReactionUpdateNotif) ChatActivity {
	return ChatActivity{
		ActivityType__:   ChatActivityType_REACTION_UPDATE,
		ReactionUpdate__: &v,
	}
}

func NewChatActivityWithMessagesUpdated(v MessagesUpdated) ChatActivity {
	return ChatActivity{
		ActivityType__:    ChatActivityType_MESSAGES_UPDATED,
		MessagesUpdated__: &v,
	}
}

func (o ChatActivity) DeepCopy() ChatActivity {
	return ChatActivity{
		ActivityType__: o.ActivityType__.DeepCopy(),
		IncomingMessage__: (func(x *IncomingMessage) *IncomingMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.IncomingMessage__),
		ReadMessage__: (func(x *ReadMessageInfo) *ReadMessageInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReadMessage__),
		NewConversation__: (func(x *NewConversationInfo) *NewConversationInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.NewConversation__),
		SetStatus__: (func(x *SetStatusInfo) *SetStatusInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SetStatus__),
		FailedMessage__: (func(x *FailedMessageInfo) *FailedMessageInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FailedMessage__),
		MembersUpdate__: (func(x *MembersUpdateInfo) *MembersUpdateInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MembersUpdate__),
		SetAppNotificationSettings__: (func(x *SetAppNotificationSettingsInfo) *SetAppNotificationSettingsInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SetAppNotificationSettings__),
		Teamtype__: (func(x *TeamTypeInfo) *TeamTypeInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Teamtype__),
		Expunge__: (func(x *ExpungeInfo) *ExpungeInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Expunge__),
		EphemeralPurge__: (func(x *EphemeralPurgeNotifInfo) *EphemeralPurgeNotifInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EphemeralPurge__),
		ReactionUpdate__: (func(x *ReactionUpdateNotif) *ReactionUpdateNotif {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReactionUpdate__),
		MessagesUpdated__: (func(x *MessagesUpdated) *MessagesUpdated {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MessagesUpdated__),
	}
}

type TyperInfo struct {
	Uid        keybase1.UID      `codec:"uid" json:"uid"`
	Username   string            `codec:"username" json:"username"`
	DeviceID   keybase1.DeviceID `codec:"deviceID" json:"deviceID"`
	DeviceName string            `codec:"deviceName" json:"deviceName"`
	DeviceType string            `codec:"deviceType" json:"deviceType"`
}

func (o TyperInfo) DeepCopy() TyperInfo {
	return TyperInfo{
		Uid:        o.Uid.DeepCopy(),
		Username:   o.Username,
		DeviceID:   o.DeviceID.DeepCopy(),
		DeviceName: o.DeviceName,
		DeviceType: o.DeviceType,
	}
}

type ConvTypingUpdate struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Typers []TyperInfo    `codec:"typers" json:"typers"`
}

func (o ConvTypingUpdate) DeepCopy() ConvTypingUpdate {
	return ConvTypingUpdate{
		ConvID: o.ConvID.DeepCopy(),
		Typers: (func(x []TyperInfo) []TyperInfo {
			if x == nil {
				return nil
			}
			ret := make([]TyperInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Typers),
	}
}

type StaleUpdateType int

const (
	StaleUpdateType_CLEAR       StaleUpdateType = 0
	StaleUpdateType_NEWACTIVITY StaleUpdateType = 1
)

func (o StaleUpdateType) DeepCopy() StaleUpdateType { return o }

var StaleUpdateTypeMap = map[string]StaleUpdateType{
	"CLEAR":       0,
	"NEWACTIVITY": 1,
}

var StaleUpdateTypeRevMap = map[StaleUpdateType]string{
	0: "CLEAR",
	1: "NEWACTIVITY",
}

func (e StaleUpdateType) String() string {
	if v, ok := StaleUpdateTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConversationStaleUpdate struct {
	ConvID     ConversationID  `codec:"convID" json:"convID"`
	UpdateType StaleUpdateType `codec:"updateType" json:"updateType"`
}

func (o ConversationStaleUpdate) DeepCopy() ConversationStaleUpdate {
	return ConversationStaleUpdate{
		ConvID:     o.ConvID.DeepCopy(),
		UpdateType: o.UpdateType.DeepCopy(),
	}
}

type ChatSyncIncrementalConv struct {
	Conv        UnverifiedInboxUIItem `codec:"conv" json:"conv"`
	ShouldUnbox bool                  `codec:"shouldUnbox" json:"shouldUnbox"`
}

func (o ChatSyncIncrementalConv) DeepCopy() ChatSyncIncrementalConv {
	return ChatSyncIncrementalConv{
		Conv:        o.Conv.DeepCopy(),
		ShouldUnbox: o.ShouldUnbox,
	}
}

type ChatSyncIncrementalInfo struct {
	Items    []ChatSyncIncrementalConv `codec:"items" json:"items"`
	Removals []string                  `codec:"removals" json:"removals"`
}

func (o ChatSyncIncrementalInfo) DeepCopy() ChatSyncIncrementalInfo {
	return ChatSyncIncrementalInfo{
		Items: (func(x []ChatSyncIncrementalConv) []ChatSyncIncrementalConv {
			if x == nil {
				return nil
			}
			ret := make([]ChatSyncIncrementalConv, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Items),
		Removals: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Removals),
	}
}

type ChatSyncResult struct {
	SyncType__    SyncInboxResType         `codec:"syncType" json:"syncType"`
	Incremental__ *ChatSyncIncrementalInfo `codec:"incremental,omitempty" json:"incremental,omitempty"`
}

func (o *ChatSyncResult) SyncType() (ret SyncInboxResType, err error) {
	switch o.SyncType__ {
	case SyncInboxResType_INCREMENTAL:
		if o.Incremental__ == nil {
			err = errors.New("unexpected nil value for Incremental__")
			return ret, err
		}
	}
	return o.SyncType__, nil
}

func (o ChatSyncResult) Incremental() (res ChatSyncIncrementalInfo) {
	if o.SyncType__ != SyncInboxResType_INCREMENTAL {
		panic("wrong case accessed")
	}
	if o.Incremental__ == nil {
		return
	}
	return *o.Incremental__
}

func NewChatSyncResultWithCurrent() ChatSyncResult {
	return ChatSyncResult{
		SyncType__: SyncInboxResType_CURRENT,
	}
}

func NewChatSyncResultWithClear() ChatSyncResult {
	return ChatSyncResult{
		SyncType__: SyncInboxResType_CLEAR,
	}
}

func NewChatSyncResultWithIncremental(v ChatSyncIncrementalInfo) ChatSyncResult {
	return ChatSyncResult{
		SyncType__:    SyncInboxResType_INCREMENTAL,
		Incremental__: &v,
	}
}

func (o ChatSyncResult) DeepCopy() ChatSyncResult {
	return ChatSyncResult{
		SyncType__: o.SyncType__.DeepCopy(),
		Incremental__: (func(x *ChatSyncIncrementalInfo) *ChatSyncIncrementalInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Incremental__),
	}
}
