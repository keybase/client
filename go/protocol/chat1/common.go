// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/common.avdl

package chat1

import (
	"errors"
	"fmt"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type ThreadID []byte

func (o ThreadID) DeepCopy() ThreadID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type MessageID uint

func (o MessageID) DeepCopy() MessageID {
	return o
}

type TLFConvOrdinal uint

func (o TLFConvOrdinal) DeepCopy() TLFConvOrdinal {
	return o
}

type TopicID []byte

func (o TopicID) DeepCopy() TopicID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type ConversationID []byte

func (o ConversationID) DeepCopy() ConversationID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type TLFID []byte

func (o TLFID) DeepCopy() TLFID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type Hash []byte

func (o Hash) DeepCopy() Hash {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type InboxVers uint64

func (o InboxVers) DeepCopy() InboxVers {
	return o
}

type LocalConversationVers uint64

func (o LocalConversationVers) DeepCopy() LocalConversationVers {
	return o
}

type ConversationVers uint64

func (o ConversationVers) DeepCopy() ConversationVers {
	return o
}

type OutboxID []byte

func (o OutboxID) DeepCopy() OutboxID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type TopicNameState []byte

func (o TopicNameState) DeepCopy() TopicNameState {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type FlipGameID []byte

func (o FlipGameID) DeepCopy() FlipGameID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type InboxVersInfo struct {
	Uid  gregor1.UID `codec:"uid" json:"uid"`
	Vers InboxVers   `codec:"vers" json:"vers"`
}

func (o InboxVersInfo) DeepCopy() InboxVersInfo {
	return InboxVersInfo{
		Uid:  o.Uid.DeepCopy(),
		Vers: o.Vers.DeepCopy(),
	}
}

type ConversationExistence int

const (
	ConversationExistence_ACTIVE    ConversationExistence = 0
	ConversationExistence_ARCHIVED  ConversationExistence = 1
	ConversationExistence_DELETED   ConversationExistence = 2
	ConversationExistence_ABANDONED ConversationExistence = 3
)

func (o ConversationExistence) DeepCopy() ConversationExistence { return o }

var ConversationExistenceMap = map[string]ConversationExistence{
	"ACTIVE":    0,
	"ARCHIVED":  1,
	"DELETED":   2,
	"ABANDONED": 3,
}

var ConversationExistenceRevMap = map[ConversationExistence]string{
	0: "ACTIVE",
	1: "ARCHIVED",
	2: "DELETED",
	3: "ABANDONED",
}

func (e ConversationExistence) String() string {
	if v, ok := ConversationExistenceRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConversationMembersType int

const (
	ConversationMembersType_KBFS           ConversationMembersType = 0
	ConversationMembersType_TEAM           ConversationMembersType = 1
	ConversationMembersType_IMPTEAMNATIVE  ConversationMembersType = 2
	ConversationMembersType_IMPTEAMUPGRADE ConversationMembersType = 3
)

func (o ConversationMembersType) DeepCopy() ConversationMembersType { return o }

var ConversationMembersTypeMap = map[string]ConversationMembersType{
	"KBFS":           0,
	"TEAM":           1,
	"IMPTEAMNATIVE":  2,
	"IMPTEAMUPGRADE": 3,
}

var ConversationMembersTypeRevMap = map[ConversationMembersType]string{
	0: "KBFS",
	1: "TEAM",
	2: "IMPTEAMNATIVE",
	3: "IMPTEAMUPGRADE",
}

func (e ConversationMembersType) String() string {
	if v, ok := ConversationMembersTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SyncInboxResType int

const (
	SyncInboxResType_CURRENT     SyncInboxResType = 0
	SyncInboxResType_INCREMENTAL SyncInboxResType = 1
	SyncInboxResType_CLEAR       SyncInboxResType = 2
)

func (o SyncInboxResType) DeepCopy() SyncInboxResType { return o }

var SyncInboxResTypeMap = map[string]SyncInboxResType{
	"CURRENT":     0,
	"INCREMENTAL": 1,
	"CLEAR":       2,
}

var SyncInboxResTypeRevMap = map[SyncInboxResType]string{
	0: "CURRENT",
	1: "INCREMENTAL",
	2: "CLEAR",
}

func (e SyncInboxResType) String() string {
	if v, ok := SyncInboxResTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MessageType int

const (
	MessageType_NONE               MessageType = 0
	MessageType_TEXT               MessageType = 1
	MessageType_ATTACHMENT         MessageType = 2
	MessageType_EDIT               MessageType = 3
	MessageType_DELETE             MessageType = 4
	MessageType_METADATA           MessageType = 5
	MessageType_TLFNAME            MessageType = 6
	MessageType_HEADLINE           MessageType = 7
	MessageType_ATTACHMENTUPLOADED MessageType = 8
	MessageType_JOIN               MessageType = 9
	MessageType_LEAVE              MessageType = 10
	MessageType_SYSTEM             MessageType = 11
	MessageType_DELETEHISTORY      MessageType = 12
	MessageType_REACTION           MessageType = 13
	MessageType_SENDPAYMENT        MessageType = 14
	MessageType_REQUESTPAYMENT     MessageType = 15
	MessageType_UNFURL             MessageType = 16
	MessageType_FLIP               MessageType = 17
	MessageType_PIN                MessageType = 18
)

func (o MessageType) DeepCopy() MessageType { return o }

var MessageTypeMap = map[string]MessageType{
	"NONE":               0,
	"TEXT":               1,
	"ATTACHMENT":         2,
	"EDIT":               3,
	"DELETE":             4,
	"METADATA":           5,
	"TLFNAME":            6,
	"HEADLINE":           7,
	"ATTACHMENTUPLOADED": 8,
	"JOIN":               9,
	"LEAVE":              10,
	"SYSTEM":             11,
	"DELETEHISTORY":      12,
	"REACTION":           13,
	"SENDPAYMENT":        14,
	"REQUESTPAYMENT":     15,
	"UNFURL":             16,
	"FLIP":               17,
	"PIN":                18,
}

var MessageTypeRevMap = map[MessageType]string{
	0:  "NONE",
	1:  "TEXT",
	2:  "ATTACHMENT",
	3:  "EDIT",
	4:  "DELETE",
	5:  "METADATA",
	6:  "TLFNAME",
	7:  "HEADLINE",
	8:  "ATTACHMENTUPLOADED",
	9:  "JOIN",
	10: "LEAVE",
	11: "SYSTEM",
	12: "DELETEHISTORY",
	13: "REACTION",
	14: "SENDPAYMENT",
	15: "REQUESTPAYMENT",
	16: "UNFURL",
	17: "FLIP",
	18: "PIN",
}

type TopicType int

const (
	TopicType_NONE         TopicType = 0
	TopicType_CHAT         TopicType = 1
	TopicType_DEV          TopicType = 2
	TopicType_KBFSFILEEDIT TopicType = 3
)

func (o TopicType) DeepCopy() TopicType { return o }

var TopicTypeMap = map[string]TopicType{
	"NONE":         0,
	"CHAT":         1,
	"DEV":          2,
	"KBFSFILEEDIT": 3,
}

var TopicTypeRevMap = map[TopicType]string{
	0: "NONE",
	1: "CHAT",
	2: "DEV",
	3: "KBFSFILEEDIT",
}

type TeamType int

const (
	TeamType_NONE    TeamType = 0
	TeamType_SIMPLE  TeamType = 1
	TeamType_COMPLEX TeamType = 2
)

func (o TeamType) DeepCopy() TeamType { return o }

var TeamTypeMap = map[string]TeamType{
	"NONE":    0,
	"SIMPLE":  1,
	"COMPLEX": 2,
}

var TeamTypeRevMap = map[TeamType]string{
	0: "NONE",
	1: "SIMPLE",
	2: "COMPLEX",
}

func (e TeamType) String() string {
	if v, ok := TeamTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type NotificationKind int

const (
	NotificationKind_GENERIC   NotificationKind = 0
	NotificationKind_ATMENTION NotificationKind = 1
)

func (o NotificationKind) DeepCopy() NotificationKind { return o }

var NotificationKindMap = map[string]NotificationKind{
	"GENERIC":   0,
	"ATMENTION": 1,
}

var NotificationKindRevMap = map[NotificationKind]string{
	0: "GENERIC",
	1: "ATMENTION",
}

type GlobalAppNotificationSetting int

const (
	GlobalAppNotificationSetting_NEWMESSAGES        GlobalAppNotificationSetting = 0
	GlobalAppNotificationSetting_PLAINTEXTMOBILE    GlobalAppNotificationSetting = 1
	GlobalAppNotificationSetting_PLAINTEXTDESKTOP   GlobalAppNotificationSetting = 2
	GlobalAppNotificationSetting_DEFAULTSOUNDMOBILE GlobalAppNotificationSetting = 3
	GlobalAppNotificationSetting_DISABLETYPING      GlobalAppNotificationSetting = 4
)

func (o GlobalAppNotificationSetting) DeepCopy() GlobalAppNotificationSetting { return o }

var GlobalAppNotificationSettingMap = map[string]GlobalAppNotificationSetting{
	"NEWMESSAGES":        0,
	"PLAINTEXTMOBILE":    1,
	"PLAINTEXTDESKTOP":   2,
	"DEFAULTSOUNDMOBILE": 3,
	"DISABLETYPING":      4,
}

var GlobalAppNotificationSettingRevMap = map[GlobalAppNotificationSetting]string{
	0: "NEWMESSAGES",
	1: "PLAINTEXTMOBILE",
	2: "PLAINTEXTDESKTOP",
	3: "DEFAULTSOUNDMOBILE",
	4: "DISABLETYPING",
}

func (e GlobalAppNotificationSetting) String() string {
	if v, ok := GlobalAppNotificationSettingRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GlobalAppNotificationSettings struct {
	Settings map[GlobalAppNotificationSetting]bool `codec:"settings" json:"settings"`
}

func (o GlobalAppNotificationSettings) DeepCopy() GlobalAppNotificationSettings {
	return GlobalAppNotificationSettings{
		Settings: (func(x map[GlobalAppNotificationSetting]bool) map[GlobalAppNotificationSetting]bool {
			if x == nil {
				return nil
			}
			ret := make(map[GlobalAppNotificationSetting]bool, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Settings),
	}
}

type ConversationStatus int

const (
	ConversationStatus_UNFILED  ConversationStatus = 0
	ConversationStatus_FAVORITE ConversationStatus = 1
	ConversationStatus_IGNORED  ConversationStatus = 2
	ConversationStatus_BLOCKED  ConversationStatus = 3
	ConversationStatus_MUTED    ConversationStatus = 4
	ConversationStatus_REPORTED ConversationStatus = 5
)

func (o ConversationStatus) DeepCopy() ConversationStatus { return o }

var ConversationStatusMap = map[string]ConversationStatus{
	"UNFILED":  0,
	"FAVORITE": 1,
	"IGNORED":  2,
	"BLOCKED":  3,
	"MUTED":    4,
	"REPORTED": 5,
}

var ConversationStatusRevMap = map[ConversationStatus]string{
	0: "UNFILED",
	1: "FAVORITE",
	2: "IGNORED",
	3: "BLOCKED",
	4: "MUTED",
	5: "REPORTED",
}

func (e ConversationStatus) String() string {
	if v, ok := ConversationStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConversationMember struct {
	Uid       gregor1.UID    `codec:"uid" json:"uid"`
	ConvID    ConversationID `codec:"convID" json:"convID"`
	TopicType TopicType      `codec:"topicType" json:"topicType"`
}

func (o ConversationMember) DeepCopy() ConversationMember {
	return ConversationMember{
		Uid:       o.Uid.DeepCopy(),
		ConvID:    o.ConvID.DeepCopy(),
		TopicType: o.TopicType.DeepCopy(),
	}
}

type ConversationIDMessageIDPair struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	MsgID  MessageID      `codec:"msgID" json:"msgID"`
}

func (o ConversationIDMessageIDPair) DeepCopy() ConversationIDMessageIDPair {
	return ConversationIDMessageIDPair{
		ConvID: o.ConvID.DeepCopy(),
		MsgID:  o.MsgID.DeepCopy(),
	}
}

type ConversationIDMessageIDPairs struct {
	Pairs []ConversationIDMessageIDPair `codec:"pairs" json:"pairs"`
}

func (o ConversationIDMessageIDPairs) DeepCopy() ConversationIDMessageIDPairs {
	return ConversationIDMessageIDPairs{
		Pairs: (func(x []ConversationIDMessageIDPair) []ConversationIDMessageIDPair {
			if x == nil {
				return nil
			}
			ret := make([]ConversationIDMessageIDPair, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Pairs),
	}
}

type ChannelNameMention struct {
	ConvID    ConversationID `codec:"convID" json:"convID"`
	TopicName string         `codec:"topicName" json:"topicName"`
}

func (o ChannelNameMention) DeepCopy() ChannelNameMention {
	return ChannelNameMention{
		ConvID:    o.ConvID.DeepCopy(),
		TopicName: o.TopicName,
	}
}

type KBFSPath struct {
	StartIndex   int                   `codec:"startIndex" json:"startIndex"`
	RawPath      string                `codec:"rawPath" json:"rawPath"`
	StandardPath string                `codec:"standardPath" json:"standardPath"`
	PathInfo     keybase1.KBFSPathInfo `codec:"pathInfo" json:"pathInfo"`
}

func (o KBFSPath) DeepCopy() KBFSPath {
	return KBFSPath{
		StartIndex:   o.StartIndex,
		RawPath:      o.RawPath,
		StandardPath: o.StandardPath,
		PathInfo:     o.PathInfo.DeepCopy(),
	}
}

type ConversationMemberStatus int

const (
	ConversationMemberStatus_ACTIVE       ConversationMemberStatus = 0
	ConversationMemberStatus_REMOVED      ConversationMemberStatus = 1
	ConversationMemberStatus_LEFT         ConversationMemberStatus = 2
	ConversationMemberStatus_PREVIEW      ConversationMemberStatus = 3
	ConversationMemberStatus_RESET        ConversationMemberStatus = 4
	ConversationMemberStatus_NEVER_JOINED ConversationMemberStatus = 5
)

func (o ConversationMemberStatus) DeepCopy() ConversationMemberStatus { return o }

var ConversationMemberStatusMap = map[string]ConversationMemberStatus{
	"ACTIVE":       0,
	"REMOVED":      1,
	"LEFT":         2,
	"PREVIEW":      3,
	"RESET":        4,
	"NEVER_JOINED": 5,
}

var ConversationMemberStatusRevMap = map[ConversationMemberStatus]string{
	0: "ACTIVE",
	1: "REMOVED",
	2: "LEFT",
	3: "PREVIEW",
	4: "RESET",
	5: "NEVER_JOINED",
}

func (e ConversationMemberStatus) String() string {
	if v, ok := ConversationMemberStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Pagination struct {
	Next           []byte `codec:"next,omitempty" json:"next,omitempty"`
	Previous       []byte `codec:"previous,omitempty" json:"previous,omitempty"`
	Num            int    `codec:"num" json:"num"`
	Last           bool   `codec:"last,omitempty" json:"last,omitempty"`
	ForceFirstPage bool   `codec:"forceFirstPage,omitempty" json:"forceFirstPage,omitempty"`
}

func (o Pagination) DeepCopy() Pagination {
	return Pagination{
		Next: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Next),
		Previous: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Previous),
		Num:            o.Num,
		Last:           o.Last,
		ForceFirstPage: o.ForceFirstPage,
	}
}

type RateLimit struct {
	Name           string `codec:"name" json:"name"`
	CallsRemaining int    `codec:"callsRemaining" json:"callsRemaining"`
	WindowReset    int    `codec:"windowReset" json:"windowReset"`
	MaxCalls       int    `codec:"maxCalls" json:"maxCalls"`
}

func (o RateLimit) DeepCopy() RateLimit {
	return RateLimit{
		Name:           o.Name,
		CallsRemaining: o.CallsRemaining,
		WindowReset:    o.WindowReset,
		MaxCalls:       o.MaxCalls,
	}
}

type InboxParticipantsMode int

const (
	InboxParticipantsMode_ALL        InboxParticipantsMode = 0
	InboxParticipantsMode_SKIP_TEAMS InboxParticipantsMode = 1
)

func (o InboxParticipantsMode) DeepCopy() InboxParticipantsMode { return o }

var InboxParticipantsModeMap = map[string]InboxParticipantsMode{
	"ALL":        0,
	"SKIP_TEAMS": 1,
}

var InboxParticipantsModeRevMap = map[InboxParticipantsMode]string{
	0: "ALL",
	1: "SKIP_TEAMS",
}

func (e InboxParticipantsMode) String() string {
	if v, ok := InboxParticipantsModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GetInboxQuery struct {
	ConvID            *ConversationID            `codec:"convID,omitempty" json:"convID,omitempty"`
	TopicType         *TopicType                 `codec:"topicType,omitempty" json:"topicType,omitempty"`
	TlfID             *TLFID                     `codec:"tlfID,omitempty" json:"tlfID,omitempty"`
	TlfVisibility     *keybase1.TLFVisibility    `codec:"tlfVisibility,omitempty" json:"tlfVisibility,omitempty"`
	Before            *gregor1.Time              `codec:"before,omitempty" json:"before,omitempty"`
	After             *gregor1.Time              `codec:"after,omitempty" json:"after,omitempty"`
	OneChatTypePerTLF *bool                      `codec:"oneChatTypePerTLF,omitempty" json:"oneChatTypePerTLF,omitempty"`
	TopicName         *string                    `codec:"topicName,omitempty" json:"topicName,omitempty"`
	Status            []ConversationStatus       `codec:"status" json:"status"`
	MemberStatus      []ConversationMemberStatus `codec:"memberStatus" json:"memberStatus"`
	Existences        []ConversationExistence    `codec:"existences" json:"existences"`
	MembersTypes      []ConversationMembersType  `codec:"membersTypes" json:"membersTypes"`
	ConvIDs           []ConversationID           `codec:"convIDs" json:"convIDs"`
	UnreadOnly        bool                       `codec:"unreadOnly" json:"unreadOnly"`
	ReadOnly          bool                       `codec:"readOnly" json:"readOnly"`
	ComputeActiveList bool                       `codec:"computeActiveList" json:"computeActiveList"`
	SummarizeMaxMsgs  bool                       `codec:"summarizeMaxMsgs" json:"summarizeMaxMsgs"`
	ParticipantsMode  InboxParticipantsMode      `codec:"participantsMode" json:"participantsMode"`
	SkipBgLoads       bool                       `codec:"skipBgLoads" json:"skipBgLoads"`
	AllowUnseenQuery  bool                       `codec:"allowUnseenQuery" json:"allowUnseenQuery"`
}

func (o GetInboxQuery) DeepCopy() GetInboxQuery {
	return GetInboxQuery{
		ConvID: (func(x *ConversationID) *ConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvID),
		TopicType: (func(x *TopicType) *TopicType {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TopicType),
		TlfID: (func(x *TLFID) *TLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfID),
		TlfVisibility: (func(x *keybase1.TLFVisibility) *keybase1.TLFVisibility {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfVisibility),
		Before: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Before),
		After: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.After),
		OneChatTypePerTLF: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.OneChatTypePerTLF),
		TopicName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.TopicName),
		Status: (func(x []ConversationStatus) []ConversationStatus {
			if x == nil {
				return nil
			}
			ret := make([]ConversationStatus, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Status),
		MemberStatus: (func(x []ConversationMemberStatus) []ConversationMemberStatus {
			if x == nil {
				return nil
			}
			ret := make([]ConversationMemberStatus, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MemberStatus),
		Existences: (func(x []ConversationExistence) []ConversationExistence {
			if x == nil {
				return nil
			}
			ret := make([]ConversationExistence, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Existences),
		MembersTypes: (func(x []ConversationMembersType) []ConversationMembersType {
			if x == nil {
				return nil
			}
			ret := make([]ConversationMembersType, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MembersTypes),
		ConvIDs: (func(x []ConversationID) []ConversationID {
			if x == nil {
				return nil
			}
			ret := make([]ConversationID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ConvIDs),
		UnreadOnly:        o.UnreadOnly,
		ReadOnly:          o.ReadOnly,
		ComputeActiveList: o.ComputeActiveList,
		SummarizeMaxMsgs:  o.SummarizeMaxMsgs,
		ParticipantsMode:  o.ParticipantsMode.DeepCopy(),
		SkipBgLoads:       o.SkipBgLoads,
		AllowUnseenQuery:  o.AllowUnseenQuery,
	}
}

type ConversationIDTriple struct {
	Tlfid     TLFID     `codec:"tlfid" json:"tlfid"`
	TopicType TopicType `codec:"topicType" json:"topicType"`
	TopicID   TopicID   `codec:"topicID" json:"topicID"`
}

func (o ConversationIDTriple) DeepCopy() ConversationIDTriple {
	return ConversationIDTriple{
		Tlfid:     o.Tlfid.DeepCopy(),
		TopicType: o.TopicType.DeepCopy(),
		TopicID:   o.TopicID.DeepCopy(),
	}
}

type ConversationFinalizeInfo struct {
	ResetUser      string       `codec:"resetUser" json:"resetUser"`
	ResetDate      string       `codec:"resetDate" json:"resetDate"`
	ResetFull      string       `codec:"resetFull" json:"resetFull"`
	ResetTimestamp gregor1.Time `codec:"resetTimestamp" json:"resetTimestamp"`
}

func (o ConversationFinalizeInfo) DeepCopy() ConversationFinalizeInfo {
	return ConversationFinalizeInfo{
		ResetUser:      o.ResetUser,
		ResetDate:      o.ResetDate,
		ResetFull:      o.ResetFull,
		ResetTimestamp: o.ResetTimestamp.DeepCopy(),
	}
}

type ConversationResolveInfo struct {
	NewTLFName string `codec:"newTLFName" json:"newTLFName"`
}

func (o ConversationResolveInfo) DeepCopy() ConversationResolveInfo {
	return ConversationResolveInfo{
		NewTLFName: o.NewTLFName,
	}
}

type Expunge struct {
	Upto  MessageID `codec:"upto" json:"upto"`
	Basis MessageID `codec:"basis" json:"basis"`
}

func (o Expunge) DeepCopy() Expunge {
	return Expunge{
		Upto:  o.Upto.DeepCopy(),
		Basis: o.Basis.DeepCopy(),
	}
}

type ConversationMetadata struct {
	IdTriple       ConversationIDTriple      `codec:"idTriple" json:"idTriple"`
	ConversationID ConversationID            `codec:"conversationID" json:"conversationID"`
	Visibility     keybase1.TLFVisibility    `codec:"visibility" json:"visibility"`
	Status         ConversationStatus        `codec:"status" json:"status"`
	MembersType    ConversationMembersType   `codec:"membersType" json:"membersType"`
	TeamType       TeamType                  `codec:"teamType" json:"teamType"`
	Existence      ConversationExistence     `codec:"existence" json:"existence"`
	Version        ConversationVers          `codec:"version" json:"version"`
	LocalVersion   LocalConversationVers     `codec:"localVersion" json:"localVersion"`
	FinalizeInfo   *ConversationFinalizeInfo `codec:"finalizeInfo,omitempty" json:"finalizeInfo,omitempty"`
	Supersedes     []ConversationMetadata    `codec:"supersedes" json:"supersedes"`
	SupersededBy   []ConversationMetadata    `codec:"supersededBy" json:"supersededBy"`
	ActiveList     []gregor1.UID             `codec:"activeList" json:"activeList"`
	AllList        []gregor1.UID             `codec:"allList" json:"allList"`
	ResetList      []gregor1.UID             `codec:"resetList" json:"resetList"`
	IsDefaultConv  bool                      `codec:"d" json:"isDefaultConv"`
}

func (o ConversationMetadata) DeepCopy() ConversationMetadata {
	return ConversationMetadata{
		IdTriple:       o.IdTriple.DeepCopy(),
		ConversationID: o.ConversationID.DeepCopy(),
		Visibility:     o.Visibility.DeepCopy(),
		Status:         o.Status.DeepCopy(),
		MembersType:    o.MembersType.DeepCopy(),
		TeamType:       o.TeamType.DeepCopy(),
		Existence:      o.Existence.DeepCopy(),
		Version:        o.Version.DeepCopy(),
		LocalVersion:   o.LocalVersion.DeepCopy(),
		FinalizeInfo: (func(x *ConversationFinalizeInfo) *ConversationFinalizeInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FinalizeInfo),
		Supersedes: (func(x []ConversationMetadata) []ConversationMetadata {
			if x == nil {
				return nil
			}
			ret := make([]ConversationMetadata, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Supersedes),
		SupersededBy: (func(x []ConversationMetadata) []ConversationMetadata {
			if x == nil {
				return nil
			}
			ret := make([]ConversationMetadata, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SupersededBy),
		ActiveList: (func(x []gregor1.UID) []gregor1.UID {
			if x == nil {
				return nil
			}
			ret := make([]gregor1.UID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ActiveList),
		AllList: (func(x []gregor1.UID) []gregor1.UID {
			if x == nil {
				return nil
			}
			ret := make([]gregor1.UID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.AllList),
		ResetList: (func(x []gregor1.UID) []gregor1.UID {
			if x == nil {
				return nil
			}
			ret := make([]gregor1.UID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ResetList),
		IsDefaultConv: o.IsDefaultConv,
	}
}

type ConversationNotificationInfo struct {
	ChannelWide bool                                              `codec:"channelWide" json:"channelWide"`
	Settings    map[keybase1.DeviceType]map[NotificationKind]bool `codec:"settings" json:"settings"`
}

func (o ConversationNotificationInfo) DeepCopy() ConversationNotificationInfo {
	return ConversationNotificationInfo{
		ChannelWide: o.ChannelWide,
		Settings: (func(x map[keybase1.DeviceType]map[NotificationKind]bool) map[keybase1.DeviceType]map[NotificationKind]bool {
			if x == nil {
				return nil
			}
			ret := make(map[keybase1.DeviceType]map[NotificationKind]bool, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := (func(x map[NotificationKind]bool) map[NotificationKind]bool {
					if x == nil {
						return nil
					}
					ret := make(map[NotificationKind]bool, len(x))
					for k, v := range x {
						kCopy := k.DeepCopy()
						vCopy := v
						ret[kCopy] = vCopy
					}
					return ret
				})(v)
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Settings),
	}
}

type ConversationReaderInfo struct {
	Mtime             gregor1.Time                 `codec:"mtime" json:"mtime"`
	ReadMsgid         MessageID                    `codec:"readMsgid" json:"readMsgid"`
	MaxMsgid          MessageID                    `codec:"maxMsgid" json:"maxMsgid"`
	Status            ConversationMemberStatus     `codec:"status" json:"status"`
	UntrustedTeamRole keybase1.TeamRole            `codec:"untrustedTeamRole" json:"untrustedTeamRole"`
	LastSendTime      gregor1.Time                 `codec:"l" json:"l"`
	Journeycard       *ConversationJourneycardInfo `codec:"jc,omitempty" json:"jc,omitempty"`
}

func (o ConversationReaderInfo) DeepCopy() ConversationReaderInfo {
	return ConversationReaderInfo{
		Mtime:             o.Mtime.DeepCopy(),
		ReadMsgid:         o.ReadMsgid.DeepCopy(),
		MaxMsgid:          o.MaxMsgid.DeepCopy(),
		Status:            o.Status.DeepCopy(),
		UntrustedTeamRole: o.UntrustedTeamRole.DeepCopy(),
		LastSendTime:      o.LastSendTime.DeepCopy(),
		Journeycard: (func(x *ConversationJourneycardInfo) *ConversationJourneycardInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Journeycard),
	}
}

type ConversationJourneycardInfo struct {
	WelcomeEligible bool `codec:"w" json:"w"`
}

func (o ConversationJourneycardInfo) DeepCopy() ConversationJourneycardInfo {
	return ConversationJourneycardInfo{
		WelcomeEligible: o.WelcomeEligible,
	}
}

type ConversationCreatorInfo struct {
	Ctime gregor1.Time `codec:"ctime" json:"ctime"`
	Uid   gregor1.UID  `codec:"uid" json:"uid"`
}

func (o ConversationCreatorInfo) DeepCopy() ConversationCreatorInfo {
	return ConversationCreatorInfo{
		Ctime: o.Ctime.DeepCopy(),
		Uid:   o.Uid.DeepCopy(),
	}
}

type ConversationCreatorInfoLocal struct {
	Ctime    gregor1.Time `codec:"ctime" json:"ctime"`
	Username string       `codec:"username" json:"username"`
}

func (o ConversationCreatorInfoLocal) DeepCopy() ConversationCreatorInfoLocal {
	return ConversationCreatorInfoLocal{
		Ctime:    o.Ctime.DeepCopy(),
		Username: o.Username,
	}
}

type ConversationMinWriterRoleInfo struct {
	Uid  gregor1.UID       `codec:"uid" json:"uid"`
	Role keybase1.TeamRole `codec:"role" json:"role"`
}

func (o ConversationMinWriterRoleInfo) DeepCopy() ConversationMinWriterRoleInfo {
	return ConversationMinWriterRoleInfo{
		Uid:  o.Uid.DeepCopy(),
		Role: o.Role.DeepCopy(),
	}
}

type ConversationSettings struct {
	MinWriterRoleInfo *ConversationMinWriterRoleInfo `codec:"mwr,omitempty" json:"mwr,omitempty"`
}

func (o ConversationSettings) DeepCopy() ConversationSettings {
	return ConversationSettings{
		MinWriterRoleInfo: (func(x *ConversationMinWriterRoleInfo) *ConversationMinWriterRoleInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MinWriterRoleInfo),
	}
}

type Conversation struct {
	Metadata        ConversationMetadata          `codec:"metadata" json:"metadata"`
	ReaderInfo      *ConversationReaderInfo       `codec:"readerInfo,omitempty" json:"readerInfo,omitempty"`
	Notifications   *ConversationNotificationInfo `codec:"notifications,omitempty" json:"notifications,omitempty"`
	MaxMsgs         []MessageBoxed                `codec:"maxMsgs" json:"maxMsgs"`
	MaxMsgSummaries []MessageSummary              `codec:"maxMsgSummaries" json:"maxMsgSummaries"`
	CreatorInfo     *ConversationCreatorInfo      `codec:"creatorInfo,omitempty" json:"creatorInfo,omitempty"`
	PinnedMsg       *MessageID                    `codec:"pinnedMsg,omitempty" json:"pinnedMsg,omitempty"`
	Expunge         Expunge                       `codec:"expunge" json:"expunge"`
	ConvRetention   *RetentionPolicy              `codec:"convRetention,omitempty" json:"convRetention,omitempty"`
	TeamRetention   *RetentionPolicy              `codec:"teamRetention,omitempty" json:"teamRetention,omitempty"`
	ConvSettings    *ConversationSettings         `codec:"cs,omitempty" json:"cs,omitempty"`
}

func (o Conversation) DeepCopy() Conversation {
	return Conversation{
		Metadata: o.Metadata.DeepCopy(),
		ReaderInfo: (func(x *ConversationReaderInfo) *ConversationReaderInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReaderInfo),
		Notifications: (func(x *ConversationNotificationInfo) *ConversationNotificationInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Notifications),
		MaxMsgs: (func(x []MessageBoxed) []MessageBoxed {
			if x == nil {
				return nil
			}
			ret := make([]MessageBoxed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MaxMsgs),
		MaxMsgSummaries: (func(x []MessageSummary) []MessageSummary {
			if x == nil {
				return nil
			}
			ret := make([]MessageSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MaxMsgSummaries),
		CreatorInfo: (func(x *ConversationCreatorInfo) *ConversationCreatorInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.CreatorInfo),
		PinnedMsg: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PinnedMsg),
		Expunge: o.Expunge.DeepCopy(),
		ConvRetention: (func(x *RetentionPolicy) *RetentionPolicy {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvRetention),
		TeamRetention: (func(x *RetentionPolicy) *RetentionPolicy {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TeamRetention),
		ConvSettings: (func(x *ConversationSettings) *ConversationSettings {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvSettings),
	}
}

type MessageSummary struct {
	MsgID       MessageID    `codec:"msgID" json:"msgID"`
	MessageType MessageType  `codec:"messageType" json:"messageType"`
	TlfName     string       `codec:"tlfName" json:"tlfName"`
	TlfPublic   bool         `codec:"tlfPublic" json:"tlfPublic"`
	Ctime       gregor1.Time `codec:"ctime" json:"ctime"`
}

func (o MessageSummary) DeepCopy() MessageSummary {
	return MessageSummary{
		MsgID:       o.MsgID.DeepCopy(),
		MessageType: o.MessageType.DeepCopy(),
		TlfName:     o.TlfName,
		TlfPublic:   o.TlfPublic,
		Ctime:       o.Ctime.DeepCopy(),
	}
}

type Reaction struct {
	Ctime         gregor1.Time `codec:"ctime" json:"ctime"`
	ReactionMsgID MessageID    `codec:"reactionMsgID" json:"reactionMsgID"`
}

func (o Reaction) DeepCopy() Reaction {
	return Reaction{
		Ctime:         o.Ctime.DeepCopy(),
		ReactionMsgID: o.ReactionMsgID.DeepCopy(),
	}
}

type ReactionMap struct {
	Reactions map[string]map[string]Reaction `codec:"reactions" json:"reactions"`
}

func (o ReactionMap) DeepCopy() ReactionMap {
	return ReactionMap{
		Reactions: (func(x map[string]map[string]Reaction) map[string]map[string]Reaction {
			if x == nil {
				return nil
			}
			ret := make(map[string]map[string]Reaction, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := (func(x map[string]Reaction) map[string]Reaction {
					if x == nil {
						return nil
					}
					ret := make(map[string]Reaction, len(x))
					for k, v := range x {
						kCopy := k
						vCopy := v.DeepCopy()
						ret[kCopy] = vCopy
					}
					return ret
				})(v)
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Reactions),
	}
}

type MessageServerHeader struct {
	MessageID    MessageID     `codec:"messageID" json:"messageID"`
	SupersededBy MessageID     `codec:"supersededBy" json:"supersededBy"`
	ReactionIDs  []MessageID   `codec:"r" json:"r"`
	UnfurlIDs    []MessageID   `codec:"u" json:"u"`
	Replies      []MessageID   `codec:"replies" json:"replies"`
	Ctime        gregor1.Time  `codec:"ctime" json:"ctime"`
	Now          gregor1.Time  `codec:"n" json:"n"`
	Rtime        *gregor1.Time `codec:"rt,omitempty" json:"rt,omitempty"`
}

func (o MessageServerHeader) DeepCopy() MessageServerHeader {
	return MessageServerHeader{
		MessageID:    o.MessageID.DeepCopy(),
		SupersededBy: o.SupersededBy.DeepCopy(),
		ReactionIDs: (func(x []MessageID) []MessageID {
			if x == nil {
				return nil
			}
			ret := make([]MessageID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ReactionIDs),
		UnfurlIDs: (func(x []MessageID) []MessageID {
			if x == nil {
				return nil
			}
			ret := make([]MessageID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UnfurlIDs),
		Replies: (func(x []MessageID) []MessageID {
			if x == nil {
				return nil
			}
			ret := make([]MessageID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Replies),
		Ctime: o.Ctime.DeepCopy(),
		Now:   o.Now.DeepCopy(),
		Rtime: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Rtime),
	}
}

type MessagePreviousPointer struct {
	Id   MessageID `codec:"id" json:"id"`
	Hash Hash      `codec:"hash" json:"hash"`
}

func (o MessagePreviousPointer) DeepCopy() MessagePreviousPointer {
	return MessagePreviousPointer{
		Id:   o.Id.DeepCopy(),
		Hash: o.Hash.DeepCopy(),
	}
}

type OutboxInfo struct {
	Prev        MessageID    `codec:"prev" json:"prev"`
	ComposeTime gregor1.Time `codec:"composeTime" json:"composeTime"`
}

func (o OutboxInfo) DeepCopy() OutboxInfo {
	return OutboxInfo{
		Prev:        o.Prev.DeepCopy(),
		ComposeTime: o.ComposeTime.DeepCopy(),
	}
}

type MsgEphemeralMetadata struct {
	Lifetime   gregor1.DurationSec   `codec:"l" json:"l"`
	Generation keybase1.EkGeneration `codec:"g" json:"g"`
	ExplodedBy *string               `codec:"u,omitempty" json:"u,omitempty"`
}

func (o MsgEphemeralMetadata) DeepCopy() MsgEphemeralMetadata {
	return MsgEphemeralMetadata{
		Lifetime:   o.Lifetime.DeepCopy(),
		Generation: o.Generation.DeepCopy(),
		ExplodedBy: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ExplodedBy),
	}
}

type EphemeralPurgeInfo struct {
	ConvID          ConversationID `codec:"c" json:"c"`
	IsActive        bool           `codec:"a" json:"a"`
	NextPurgeTime   gregor1.Time   `codec:"n" json:"n"`
	MinUnexplodedID MessageID      `codec:"e" json:"e"`
}

func (o EphemeralPurgeInfo) DeepCopy() EphemeralPurgeInfo {
	return EphemeralPurgeInfo{
		ConvID:          o.ConvID.DeepCopy(),
		IsActive:        o.IsActive,
		NextPurgeTime:   o.NextPurgeTime.DeepCopy(),
		MinUnexplodedID: o.MinUnexplodedID.DeepCopy(),
	}
}

type MessageClientHeader struct {
	Conv              ConversationIDTriple     `codec:"conv" json:"conv"`
	TlfName           string                   `codec:"tlfName" json:"tlfName"`
	TlfPublic         bool                     `codec:"tlfPublic" json:"tlfPublic"`
	MessageType       MessageType              `codec:"messageType" json:"messageType"`
	Supersedes        MessageID                `codec:"supersedes" json:"supersedes"`
	KbfsCryptKeysUsed *bool                    `codec:"kbfsCryptKeysUsed,omitempty" json:"kbfsCryptKeysUsed,omitempty"`
	Deletes           []MessageID              `codec:"deletes" json:"deletes"`
	Prev              []MessagePreviousPointer `codec:"prev" json:"prev"`
	DeleteHistory     *MessageDeleteHistory    `codec:"deleteHistory,omitempty" json:"deleteHistory,omitempty"`
	Sender            gregor1.UID              `codec:"sender" json:"sender"`
	SenderDevice      gregor1.DeviceID         `codec:"senderDevice" json:"senderDevice"`
	MerkleRoot        *MerkleRoot              `codec:"merkleRoot,omitempty" json:"merkleRoot,omitempty"`
	OutboxID          *OutboxID                `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	OutboxInfo        *OutboxInfo              `codec:"outboxInfo,omitempty" json:"outboxInfo,omitempty"`
	EphemeralMetadata *MsgEphemeralMetadata    `codec:"em,omitempty" json:"em,omitempty"`
	PairwiseMacs      map[keybase1.KID][]byte  `codec:"pm" json:"pm"`
	BotUID            *gregor1.UID             `codec:"b,omitempty" json:"b,omitempty"`
}

func (o MessageClientHeader) DeepCopy() MessageClientHeader {
	return MessageClientHeader{
		Conv:        o.Conv.DeepCopy(),
		TlfName:     o.TlfName,
		TlfPublic:   o.TlfPublic,
		MessageType: o.MessageType.DeepCopy(),
		Supersedes:  o.Supersedes.DeepCopy(),
		KbfsCryptKeysUsed: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.KbfsCryptKeysUsed),
		Deletes: (func(x []MessageID) []MessageID {
			if x == nil {
				return nil
			}
			ret := make([]MessageID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Deletes),
		Prev: (func(x []MessagePreviousPointer) []MessagePreviousPointer {
			if x == nil {
				return nil
			}
			ret := make([]MessagePreviousPointer, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Prev),
		DeleteHistory: (func(x *MessageDeleteHistory) *MessageDeleteHistory {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.DeleteHistory),
		Sender:       o.Sender.DeepCopy(),
		SenderDevice: o.SenderDevice.DeepCopy(),
		MerkleRoot: (func(x *MerkleRoot) *MerkleRoot {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MerkleRoot),
		OutboxID: (func(x *OutboxID) *OutboxID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxID),
		OutboxInfo: (func(x *OutboxInfo) *OutboxInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxInfo),
		EphemeralMetadata: (func(x *MsgEphemeralMetadata) *MsgEphemeralMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EphemeralMetadata),
		PairwiseMacs: (func(x map[keybase1.KID][]byte) map[keybase1.KID][]byte {
			if x == nil {
				return nil
			}
			ret := make(map[keybase1.KID][]byte, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := (func(x []byte) []byte {
					if x == nil {
						return nil
					}
					return append([]byte{}, x...)
				})(v)
				ret[kCopy] = vCopy
			}
			return ret
		})(o.PairwiseMacs),
		BotUID: (func(x *gregor1.UID) *gregor1.UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.BotUID),
	}
}

type MessageClientHeaderVerified struct {
	Conv              ConversationIDTriple     `codec:"conv" json:"conv"`
	TlfName           string                   `codec:"tlfName" json:"tlfName"`
	TlfPublic         bool                     `codec:"tlfPublic" json:"tlfPublic"`
	MessageType       MessageType              `codec:"messageType" json:"messageType"`
	Prev              []MessagePreviousPointer `codec:"prev" json:"prev"`
	Sender            gregor1.UID              `codec:"sender" json:"sender"`
	SenderDevice      gregor1.DeviceID         `codec:"senderDevice" json:"senderDevice"`
	KbfsCryptKeysUsed *bool                    `codec:"kbfsCryptKeysUsed,omitempty" json:"kbfsCryptKeysUsed,omitempty"`
	MerkleRoot        *MerkleRoot              `codec:"merkleRoot,omitempty" json:"merkleRoot,omitempty"`
	OutboxID          *OutboxID                `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	OutboxInfo        *OutboxInfo              `codec:"outboxInfo,omitempty" json:"outboxInfo,omitempty"`
	EphemeralMetadata *MsgEphemeralMetadata    `codec:"em,omitempty" json:"em,omitempty"`
	Rtime             gregor1.Time             `codec:"rt" json:"rt"`
	HasPairwiseMacs   bool                     `codec:"pm" json:"pm"`
	BotUID            *gregor1.UID             `codec:"b,omitempty" json:"b,omitempty"`
}

func (o MessageClientHeaderVerified) DeepCopy() MessageClientHeaderVerified {
	return MessageClientHeaderVerified{
		Conv:        o.Conv.DeepCopy(),
		TlfName:     o.TlfName,
		TlfPublic:   o.TlfPublic,
		MessageType: o.MessageType.DeepCopy(),
		Prev: (func(x []MessagePreviousPointer) []MessagePreviousPointer {
			if x == nil {
				return nil
			}
			ret := make([]MessagePreviousPointer, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Prev),
		Sender:       o.Sender.DeepCopy(),
		SenderDevice: o.SenderDevice.DeepCopy(),
		KbfsCryptKeysUsed: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.KbfsCryptKeysUsed),
		MerkleRoot: (func(x *MerkleRoot) *MerkleRoot {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MerkleRoot),
		OutboxID: (func(x *OutboxID) *OutboxID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxID),
		OutboxInfo: (func(x *OutboxInfo) *OutboxInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxInfo),
		EphemeralMetadata: (func(x *MsgEphemeralMetadata) *MsgEphemeralMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EphemeralMetadata),
		Rtime:           o.Rtime.DeepCopy(),
		HasPairwiseMacs: o.HasPairwiseMacs,
		BotUID: (func(x *gregor1.UID) *gregor1.UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.BotUID),
	}
}

type EncryptedData struct {
	V int    `codec:"v" json:"v"`
	E []byte `codec:"e" json:"e"`
	N []byte `codec:"n" json:"n"`
}

func (o EncryptedData) DeepCopy() EncryptedData {
	return EncryptedData{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.N),
	}
}

type SignEncryptedData struct {
	V int    `codec:"v" json:"v"`
	E []byte `codec:"e" json:"e"`
	N []byte `codec:"n" json:"n"`
}

func (o SignEncryptedData) DeepCopy() SignEncryptedData {
	return SignEncryptedData{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.N),
	}
}

type SealedData struct {
	V int    `codec:"v" json:"v"`
	E []byte `codec:"e" json:"e"`
	N []byte `codec:"n" json:"n"`
}

func (o SealedData) DeepCopy() SealedData {
	return SealedData{
		V: o.V,
		E: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.E),
		N: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.N),
	}
}

type SignatureInfo struct {
	V int    `codec:"v" json:"v"`
	S []byte `codec:"s" json:"s"`
	K []byte `codec:"k" json:"k"`
}

func (o SignatureInfo) DeepCopy() SignatureInfo {
	return SignatureInfo{
		V: o.V,
		S: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.S),
		K: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.K),
	}
}

type MerkleRoot struct {
	Seqno int64  `codec:"seqno" json:"seqno"`
	Hash  []byte `codec:"hash" json:"hash"`
}

func (o MerkleRoot) DeepCopy() MerkleRoot {
	return MerkleRoot{
		Seqno: o.Seqno,
		Hash: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Hash),
	}
}

type InboxResType int

const (
	InboxResType_VERSIONHIT InboxResType = 0
	InboxResType_FULL       InboxResType = 1
)

func (o InboxResType) DeepCopy() InboxResType { return o }

var InboxResTypeMap = map[string]InboxResType{
	"VERSIONHIT": 0,
	"FULL":       1,
}

var InboxResTypeRevMap = map[InboxResType]string{
	0: "VERSIONHIT",
	1: "FULL",
}

func (e InboxResType) String() string {
	if v, ok := InboxResTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type InboxViewFull struct {
	Vers          InboxVers      `codec:"vers" json:"vers"`
	Conversations []Conversation `codec:"conversations" json:"conversations"`
	Pagination    *Pagination    `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

func (o InboxViewFull) DeepCopy() InboxViewFull {
	return InboxViewFull{
		Vers: o.Vers.DeepCopy(),
		Conversations: (func(x []Conversation) []Conversation {
			if x == nil {
				return nil
			}
			ret := make([]Conversation, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		Pagination: (func(x *Pagination) *Pagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pagination),
	}
}

type InboxView struct {
	Rtype__ InboxResType   `codec:"rtype" json:"rtype"`
	Full__  *InboxViewFull `codec:"full,omitempty" json:"full,omitempty"`
}

func (o *InboxView) Rtype() (ret InboxResType, err error) {
	switch o.Rtype__ {
	case InboxResType_FULL:
		if o.Full__ == nil {
			err = errors.New("unexpected nil value for Full__")
			return ret, err
		}
	}
	return o.Rtype__, nil
}

func (o InboxView) Full() (res InboxViewFull) {
	if o.Rtype__ != InboxResType_FULL {
		panic("wrong case accessed")
	}
	if o.Full__ == nil {
		return
	}
	return *o.Full__
}

func NewInboxViewWithVersionhit() InboxView {
	return InboxView{
		Rtype__: InboxResType_VERSIONHIT,
	}
}

func NewInboxViewWithFull(v InboxViewFull) InboxView {
	return InboxView{
		Rtype__: InboxResType_FULL,
		Full__:  &v,
	}
}

func (o InboxView) DeepCopy() InboxView {
	return InboxView{
		Rtype__: o.Rtype__.DeepCopy(),
		Full__: (func(x *InboxViewFull) *InboxViewFull {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Full__),
	}
}

type RetentionPolicyType int

const (
	RetentionPolicyType_NONE      RetentionPolicyType = 0
	RetentionPolicyType_RETAIN    RetentionPolicyType = 1
	RetentionPolicyType_EXPIRE    RetentionPolicyType = 2
	RetentionPolicyType_INHERIT   RetentionPolicyType = 3
	RetentionPolicyType_EPHEMERAL RetentionPolicyType = 4
)

func (o RetentionPolicyType) DeepCopy() RetentionPolicyType { return o }

var RetentionPolicyTypeMap = map[string]RetentionPolicyType{
	"NONE":      0,
	"RETAIN":    1,
	"EXPIRE":    2,
	"INHERIT":   3,
	"EPHEMERAL": 4,
}

var RetentionPolicyTypeRevMap = map[RetentionPolicyType]string{
	0: "NONE",
	1: "RETAIN",
	2: "EXPIRE",
	3: "INHERIT",
	4: "EPHEMERAL",
}

func (e RetentionPolicyType) String() string {
	if v, ok := RetentionPolicyTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type RetentionPolicy struct {
	Typ__       RetentionPolicyType `codec:"typ" json:"typ"`
	Retain__    *RpRetain           `codec:"retain,omitempty" json:"retain,omitempty"`
	Expire__    *RpExpire           `codec:"expire,omitempty" json:"expire,omitempty"`
	Inherit__   *RpInherit          `codec:"inherit,omitempty" json:"inherit,omitempty"`
	Ephemeral__ *RpEphemeral        `codec:"ephemeral,omitempty" json:"ephemeral,omitempty"`
}

func (o *RetentionPolicy) Typ() (ret RetentionPolicyType, err error) {
	switch o.Typ__ {
	case RetentionPolicyType_RETAIN:
		if o.Retain__ == nil {
			err = errors.New("unexpected nil value for Retain__")
			return ret, err
		}
	case RetentionPolicyType_EXPIRE:
		if o.Expire__ == nil {
			err = errors.New("unexpected nil value for Expire__")
			return ret, err
		}
	case RetentionPolicyType_INHERIT:
		if o.Inherit__ == nil {
			err = errors.New("unexpected nil value for Inherit__")
			return ret, err
		}
	case RetentionPolicyType_EPHEMERAL:
		if o.Ephemeral__ == nil {
			err = errors.New("unexpected nil value for Ephemeral__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o RetentionPolicy) Retain() (res RpRetain) {
	if o.Typ__ != RetentionPolicyType_RETAIN {
		panic("wrong case accessed")
	}
	if o.Retain__ == nil {
		return
	}
	return *o.Retain__
}

func (o RetentionPolicy) Expire() (res RpExpire) {
	if o.Typ__ != RetentionPolicyType_EXPIRE {
		panic("wrong case accessed")
	}
	if o.Expire__ == nil {
		return
	}
	return *o.Expire__
}

func (o RetentionPolicy) Inherit() (res RpInherit) {
	if o.Typ__ != RetentionPolicyType_INHERIT {
		panic("wrong case accessed")
	}
	if o.Inherit__ == nil {
		return
	}
	return *o.Inherit__
}

func (o RetentionPolicy) Ephemeral() (res RpEphemeral) {
	if o.Typ__ != RetentionPolicyType_EPHEMERAL {
		panic("wrong case accessed")
	}
	if o.Ephemeral__ == nil {
		return
	}
	return *o.Ephemeral__
}

func NewRetentionPolicyWithRetain(v RpRetain) RetentionPolicy {
	return RetentionPolicy{
		Typ__:    RetentionPolicyType_RETAIN,
		Retain__: &v,
	}
}

func NewRetentionPolicyWithExpire(v RpExpire) RetentionPolicy {
	return RetentionPolicy{
		Typ__:    RetentionPolicyType_EXPIRE,
		Expire__: &v,
	}
}

func NewRetentionPolicyWithInherit(v RpInherit) RetentionPolicy {
	return RetentionPolicy{
		Typ__:     RetentionPolicyType_INHERIT,
		Inherit__: &v,
	}
}

func NewRetentionPolicyWithEphemeral(v RpEphemeral) RetentionPolicy {
	return RetentionPolicy{
		Typ__:       RetentionPolicyType_EPHEMERAL,
		Ephemeral__: &v,
	}
}

func (o RetentionPolicy) DeepCopy() RetentionPolicy {
	return RetentionPolicy{
		Typ__: o.Typ__.DeepCopy(),
		Retain__: (func(x *RpRetain) *RpRetain {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Retain__),
		Expire__: (func(x *RpExpire) *RpExpire {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Expire__),
		Inherit__: (func(x *RpInherit) *RpInherit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Inherit__),
		Ephemeral__: (func(x *RpEphemeral) *RpEphemeral {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Ephemeral__),
	}
}

type RpRetain struct {
}

func (o RpRetain) DeepCopy() RpRetain {
	return RpRetain{}
}

type RpExpire struct {
	Age gregor1.DurationSec `codec:"age" json:"age"`
}

func (o RpExpire) DeepCopy() RpExpire {
	return RpExpire{
		Age: o.Age.DeepCopy(),
	}
}

type RpInherit struct {
}

func (o RpInherit) DeepCopy() RpInherit {
	return RpInherit{}
}

type RpEphemeral struct {
	Age gregor1.DurationSec `codec:"age" json:"age"`
}

func (o RpEphemeral) DeepCopy() RpEphemeral {
	return RpEphemeral{
		Age: o.Age.DeepCopy(),
	}
}

type GetThreadReason int

const (
	GetThreadReason_GENERAL            GetThreadReason = 0
	GetThreadReason_PUSH               GetThreadReason = 1
	GetThreadReason_FOREGROUND         GetThreadReason = 2
	GetThreadReason_BACKGROUNDCONVLOAD GetThreadReason = 3
	GetThreadReason_FIXRETRY           GetThreadReason = 4
	GetThreadReason_PREPARE            GetThreadReason = 5
	GetThreadReason_SEARCHER           GetThreadReason = 6
	GetThreadReason_INDEXED_SEARCH     GetThreadReason = 7
	GetThreadReason_KBFSFILEACTIVITY   GetThreadReason = 8
	GetThreadReason_COINFLIP           GetThreadReason = 9
	GetThreadReason_BOTCOMMANDS        GetThreadReason = 10
)

func (o GetThreadReason) DeepCopy() GetThreadReason { return o }

var GetThreadReasonMap = map[string]GetThreadReason{
	"GENERAL":            0,
	"PUSH":               1,
	"FOREGROUND":         2,
	"BACKGROUNDCONVLOAD": 3,
	"FIXRETRY":           4,
	"PREPARE":            5,
	"SEARCHER":           6,
	"INDEXED_SEARCH":     7,
	"KBFSFILEACTIVITY":   8,
	"COINFLIP":           9,
	"BOTCOMMANDS":        10,
}

var GetThreadReasonRevMap = map[GetThreadReason]string{
	0:  "GENERAL",
	1:  "PUSH",
	2:  "FOREGROUND",
	3:  "BACKGROUNDCONVLOAD",
	4:  "FIXRETRY",
	5:  "PREPARE",
	6:  "SEARCHER",
	7:  "INDEXED_SEARCH",
	8:  "KBFSFILEACTIVITY",
	9:  "COINFLIP",
	10: "BOTCOMMANDS",
}

func (e GetThreadReason) String() string {
	if v, ok := GetThreadReasonRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ReIndexingMode int

const (
	ReIndexingMode_NONE            ReIndexingMode = 0
	ReIndexingMode_PRESEARCH_SYNC  ReIndexingMode = 1
	ReIndexingMode_POSTSEARCH_SYNC ReIndexingMode = 2
)

func (o ReIndexingMode) DeepCopy() ReIndexingMode { return o }

var ReIndexingModeMap = map[string]ReIndexingMode{
	"NONE":            0,
	"PRESEARCH_SYNC":  1,
	"POSTSEARCH_SYNC": 2,
}

var ReIndexingModeRevMap = map[ReIndexingMode]string{
	0: "NONE",
	1: "PRESEARCH_SYNC",
	2: "POSTSEARCH_SYNC",
}

func (e ReIndexingMode) String() string {
	if v, ok := ReIndexingModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SearchOpts struct {
	IsRegex           bool            `codec:"isRegex" json:"isRegex"`
	SentBy            string          `codec:"sentBy" json:"sentBy"`
	SentTo            string          `codec:"sentTo" json:"sentTo"`
	MatchMentions     bool            `codec:"matchMentions" json:"matchMentions"`
	SentBefore        gregor1.Time    `codec:"sentBefore" json:"sentBefore"`
	SentAfter         gregor1.Time    `codec:"sentAfter" json:"sentAfter"`
	MaxHits           int             `codec:"maxHits" json:"maxHits"`
	MaxMessages       int             `codec:"maxMessages" json:"maxMessages"`
	BeforeContext     int             `codec:"beforeContext" json:"beforeContext"`
	AfterContext      int             `codec:"afterContext" json:"afterContext"`
	InitialPagination *Pagination     `codec:"initialPagination,omitempty" json:"initialPagination,omitempty"`
	ReindexMode       ReIndexingMode  `codec:"reindexMode" json:"reindexMode"`
	MaxConvsSearched  int             `codec:"maxConvsSearched" json:"maxConvsSearched"`
	MaxConvsHit       int             `codec:"maxConvsHit" json:"maxConvsHit"`
	ConvID            *ConversationID `codec:"convID,omitempty" json:"convID,omitempty"`
	MaxNameConvs      int             `codec:"maxNameConvs" json:"maxNameConvs"`
	MaxTeams          int             `codec:"maxTeams" json:"maxTeams"`
}

func (o SearchOpts) DeepCopy() SearchOpts {
	return SearchOpts{
		IsRegex:       o.IsRegex,
		SentBy:        o.SentBy,
		SentTo:        o.SentTo,
		MatchMentions: o.MatchMentions,
		SentBefore:    o.SentBefore.DeepCopy(),
		SentAfter:     o.SentAfter.DeepCopy(),
		MaxHits:       o.MaxHits,
		MaxMessages:   o.MaxMessages,
		BeforeContext: o.BeforeContext,
		AfterContext:  o.AfterContext,
		InitialPagination: (func(x *Pagination) *Pagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.InitialPagination),
		ReindexMode:      o.ReindexMode.DeepCopy(),
		MaxConvsSearched: o.MaxConvsSearched,
		MaxConvsHit:      o.MaxConvsHit,
		ConvID: (func(x *ConversationID) *ConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvID),
		MaxNameConvs: o.MaxNameConvs,
		MaxTeams:     o.MaxTeams,
	}
}

type EmptyStruct struct {
}

func (o EmptyStruct) DeepCopy() EmptyStruct {
	return EmptyStruct{}
}

type ChatSearchMatch struct {
	StartIndex int    `codec:"startIndex" json:"startIndex"`
	EndIndex   int    `codec:"endIndex" json:"endIndex"`
	Match      string `codec:"match" json:"match"`
}

func (o ChatSearchMatch) DeepCopy() ChatSearchMatch {
	return ChatSearchMatch{
		StartIndex: o.StartIndex,
		EndIndex:   o.EndIndex,
		Match:      o.Match,
	}
}

type ChatSearchHit struct {
	BeforeMessages []UIMessage       `codec:"beforeMessages" json:"beforeMessages"`
	HitMessage     UIMessage         `codec:"hitMessage" json:"hitMessage"`
	AfterMessages  []UIMessage       `codec:"afterMessages" json:"afterMessages"`
	Matches        []ChatSearchMatch `codec:"matches" json:"matches"`
}

func (o ChatSearchHit) DeepCopy() ChatSearchHit {
	return ChatSearchHit{
		BeforeMessages: (func(x []UIMessage) []UIMessage {
			if x == nil {
				return nil
			}
			ret := make([]UIMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.BeforeMessages),
		HitMessage: o.HitMessage.DeepCopy(),
		AfterMessages: (func(x []UIMessage) []UIMessage {
			if x == nil {
				return nil
			}
			ret := make([]UIMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.AfterMessages),
		Matches: (func(x []ChatSearchMatch) []ChatSearchMatch {
			if x == nil {
				return nil
			}
			ret := make([]ChatSearchMatch, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Matches),
	}
}

type ChatSearchInboxHit struct {
	ConvID   ConversationID  `codec:"convID" json:"convID"`
	TeamType TeamType        `codec:"teamType" json:"teamType"`
	ConvName string          `codec:"convName" json:"convName"`
	Query    string          `codec:"query" json:"query"`
	Time     gregor1.Time    `codec:"time" json:"time"`
	Hits     []ChatSearchHit `codec:"hits" json:"hits"`
}

func (o ChatSearchInboxHit) DeepCopy() ChatSearchInboxHit {
	return ChatSearchInboxHit{
		ConvID:   o.ConvID.DeepCopy(),
		TeamType: o.TeamType.DeepCopy(),
		ConvName: o.ConvName,
		Query:    o.Query,
		Time:     o.Time.DeepCopy(),
		Hits: (func(x []ChatSearchHit) []ChatSearchHit {
			if x == nil {
				return nil
			}
			ret := make([]ChatSearchHit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Hits),
	}
}

type ChatSearchInboxResults struct {
	Hits           []ChatSearchInboxHit `codec:"hits" json:"hits"`
	PercentIndexed int                  `codec:"percentIndexed" json:"percentIndexed"`
}

func (o ChatSearchInboxResults) DeepCopy() ChatSearchInboxResults {
	return ChatSearchInboxResults{
		Hits: (func(x []ChatSearchInboxHit) []ChatSearchInboxHit {
			if x == nil {
				return nil
			}
			ret := make([]ChatSearchInboxHit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Hits),
		PercentIndexed: o.PercentIndexed,
	}
}

type ChatSearchInboxDone struct {
	NumHits        int  `codec:"numHits" json:"numHits"`
	NumConvs       int  `codec:"numConvs" json:"numConvs"`
	PercentIndexed int  `codec:"percentIndexed" json:"percentIndexed"`
	Delegated      bool `codec:"delegated" json:"delegated"`
}

func (o ChatSearchInboxDone) DeepCopy() ChatSearchInboxDone {
	return ChatSearchInboxDone{
		NumHits:        o.NumHits,
		NumConvs:       o.NumConvs,
		PercentIndexed: o.PercentIndexed,
		Delegated:      o.Delegated,
	}
}

type ChatSearchIndexStatus struct {
	PercentIndexed int `codec:"percentIndexed" json:"percentIndexed"`
}

func (o ChatSearchIndexStatus) DeepCopy() ChatSearchIndexStatus {
	return ChatSearchIndexStatus{
		PercentIndexed: o.PercentIndexed,
	}
}

type AssetMetadataImage struct {
	Width     int       `codec:"width" json:"width"`
	Height    int       `codec:"height" json:"height"`
	AudioAmps []float64 `codec:"audioAmps" json:"audioAmps"`
}

func (o AssetMetadataImage) DeepCopy() AssetMetadataImage {
	return AssetMetadataImage{
		Width:  o.Width,
		Height: o.Height,
		AudioAmps: (func(x []float64) []float64 {
			if x == nil {
				return nil
			}
			ret := make([]float64, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.AudioAmps),
	}
}

type AssetMetadataVideo struct {
	Width      int  `codec:"width" json:"width"`
	Height     int  `codec:"height" json:"height"`
	DurationMs int  `codec:"durationMs" json:"durationMs"`
	IsAudio    bool `codec:"isAudio" json:"isAudio"`
}

func (o AssetMetadataVideo) DeepCopy() AssetMetadataVideo {
	return AssetMetadataVideo{
		Width:      o.Width,
		Height:     o.Height,
		DurationMs: o.DurationMs,
		IsAudio:    o.IsAudio,
	}
}

type AssetMetadataType int

const (
	AssetMetadataType_NONE  AssetMetadataType = 0
	AssetMetadataType_IMAGE AssetMetadataType = 1
	AssetMetadataType_VIDEO AssetMetadataType = 2
)

func (o AssetMetadataType) DeepCopy() AssetMetadataType { return o }

var AssetMetadataTypeMap = map[string]AssetMetadataType{
	"NONE":  0,
	"IMAGE": 1,
	"VIDEO": 2,
}

var AssetMetadataTypeRevMap = map[AssetMetadataType]string{
	0: "NONE",
	1: "IMAGE",
	2: "VIDEO",
}

type AssetMetadata struct {
	AssetType__ AssetMetadataType   `codec:"assetType" json:"assetType"`
	Image__     *AssetMetadataImage `codec:"image,omitempty" json:"image,omitempty"`
	Video__     *AssetMetadataVideo `codec:"video,omitempty" json:"video,omitempty"`
}

func (o *AssetMetadata) AssetType() (ret AssetMetadataType, err error) {
	switch o.AssetType__ {
	case AssetMetadataType_IMAGE:
		if o.Image__ == nil {
			err = errors.New("unexpected nil value for Image__")
			return ret, err
		}
	case AssetMetadataType_VIDEO:
		if o.Video__ == nil {
			err = errors.New("unexpected nil value for Video__")
			return ret, err
		}
	}
	return o.AssetType__, nil
}

func (o AssetMetadata) Image() (res AssetMetadataImage) {
	if o.AssetType__ != AssetMetadataType_IMAGE {
		panic("wrong case accessed")
	}
	if o.Image__ == nil {
		return
	}
	return *o.Image__
}

func (o AssetMetadata) Video() (res AssetMetadataVideo) {
	if o.AssetType__ != AssetMetadataType_VIDEO {
		panic("wrong case accessed")
	}
	if o.Video__ == nil {
		return
	}
	return *o.Video__
}

func NewAssetMetadataWithImage(v AssetMetadataImage) AssetMetadata {
	return AssetMetadata{
		AssetType__: AssetMetadataType_IMAGE,
		Image__:     &v,
	}
}

func NewAssetMetadataWithVideo(v AssetMetadataVideo) AssetMetadata {
	return AssetMetadata{
		AssetType__: AssetMetadataType_VIDEO,
		Video__:     &v,
	}
}

func (o AssetMetadata) DeepCopy() AssetMetadata {
	return AssetMetadata{
		AssetType__: o.AssetType__.DeepCopy(),
		Image__: (func(x *AssetMetadataImage) *AssetMetadataImage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Image__),
		Video__: (func(x *AssetMetadataVideo) *AssetMetadataVideo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Video__),
	}
}

type AssetTag int

const (
	AssetTag_PRIMARY AssetTag = 0
)

func (o AssetTag) DeepCopy() AssetTag { return o }

var AssetTagMap = map[string]AssetTag{
	"PRIMARY": 0,
}

var AssetTagRevMap = map[AssetTag]string{
	0: "PRIMARY",
}

type Asset struct {
	Filename  string        `codec:"filename" json:"filename"`
	Region    string        `codec:"region" json:"region"`
	Endpoint  string        `codec:"endpoint" json:"endpoint"`
	Bucket    string        `codec:"bucket" json:"bucket"`
	Path      string        `codec:"path" json:"path"`
	Size      int64         `codec:"size" json:"size"`
	MimeType  string        `codec:"mimeType" json:"mimeType"`
	EncHash   Hash          `codec:"encHash" json:"encHash"`
	Key       []byte        `codec:"key" json:"key"`
	VerifyKey []byte        `codec:"verifyKey" json:"verifyKey"`
	Title     string        `codec:"title" json:"title"`
	Nonce     []byte        `codec:"nonce" json:"nonce"`
	Metadata  AssetMetadata `codec:"metadata" json:"metadata"`
	Tag       AssetTag      `codec:"tag" json:"tag"`
}

func (o Asset) DeepCopy() Asset {
	return Asset{
		Filename: o.Filename,
		Region:   o.Region,
		Endpoint: o.Endpoint,
		Bucket:   o.Bucket,
		Path:     o.Path,
		Size:     o.Size,
		MimeType: o.MimeType,
		EncHash:  o.EncHash.DeepCopy(),
		Key: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Key),
		VerifyKey: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.VerifyKey),
		Title: o.Title,
		Nonce: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Nonce),
		Metadata: o.Metadata.DeepCopy(),
		Tag:      o.Tag.DeepCopy(),
	}
}

type BotCommandsAdvertisementTyp int

const (
	BotCommandsAdvertisementTyp_PUBLIC        BotCommandsAdvertisementTyp = 0
	BotCommandsAdvertisementTyp_TLFID_MEMBERS BotCommandsAdvertisementTyp = 1
	BotCommandsAdvertisementTyp_TLFID_CONVS   BotCommandsAdvertisementTyp = 2
)

func (o BotCommandsAdvertisementTyp) DeepCopy() BotCommandsAdvertisementTyp { return o }

var BotCommandsAdvertisementTypMap = map[string]BotCommandsAdvertisementTyp{
	"PUBLIC":        0,
	"TLFID_MEMBERS": 1,
	"TLFID_CONVS":   2,
}

var BotCommandsAdvertisementTypRevMap = map[BotCommandsAdvertisementTyp]string{
	0: "PUBLIC",
	1: "TLFID_MEMBERS",
	2: "TLFID_CONVS",
}

func (e BotCommandsAdvertisementTyp) String() string {
	if v, ok := BotCommandsAdvertisementTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type TeamMember struct {
	Uid    gregor1.UID               `codec:"uid" json:"uid"`
	Role   keybase1.TeamRole         `codec:"role" json:"role"`
	Status keybase1.TeamMemberStatus `codec:"status" json:"status"`
}

func (o TeamMember) DeepCopy() TeamMember {
	return TeamMember{
		Uid:    o.Uid.DeepCopy(),
		Role:   o.Role.DeepCopy(),
		Status: o.Status.DeepCopy(),
	}
}

type LastActiveStatus int

const (
	LastActiveStatus_NONE            LastActiveStatus = 0
	LastActiveStatus_ACTIVE          LastActiveStatus = 1
	LastActiveStatus_RECENTLY_ACTIVE LastActiveStatus = 2
)

func (o LastActiveStatus) DeepCopy() LastActiveStatus { return o }

var LastActiveStatusMap = map[string]LastActiveStatus{
	"NONE":            0,
	"ACTIVE":          1,
	"RECENTLY_ACTIVE": 2,
}

var LastActiveStatusRevMap = map[LastActiveStatus]string{
	0: "NONE",
	1: "ACTIVE",
	2: "RECENTLY_ACTIVE",
}

func (e LastActiveStatus) String() string {
	if v, ok := LastActiveStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type CommonInterface interface {
}

func CommonProtocol(i CommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "chat.1.common",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type CommonClient struct {
	Cli rpc.GenericClient
}
