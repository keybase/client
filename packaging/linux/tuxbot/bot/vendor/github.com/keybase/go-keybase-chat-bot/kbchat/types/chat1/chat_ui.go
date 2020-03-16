// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/chat1/chat_ui.avdl

package chat1

import (
	"errors"
	"fmt"

	gregor1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/gregor1"
	keybase1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
	stellar1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/stellar1"
)

type UIPagination struct {
	Next     string `codec:"next" json:"next"`
	Previous string `codec:"previous" json:"previous"`
	Num      int    `codec:"num" json:"num"`
	Last     bool   `codec:"last" json:"last"`
}

func (o UIPagination) DeepCopy() UIPagination {
	return UIPagination{
		Next:     o.Next,
		Previous: o.Previous,
		Num:      o.Num,
		Last:     o.Last,
	}
}

type UIInboxSmallTeamRow struct {
	ConvID            ConvIDStr         `codec:"convID" json:"convID"`
	Name              string            `codec:"name" json:"name"`
	Time              gregor1.Time      `codec:"time" json:"time"`
	Snippet           *string           `codec:"snippet,omitempty" json:"snippet,omitempty"`
	SnippetDecoration SnippetDecoration `codec:"snippetDecoration" json:"snippetDecoration"`
	Draft             *string           `codec:"draft,omitempty" json:"draft,omitempty"`
	IsMuted           bool              `codec:"isMuted" json:"isMuted"`
	IsTeam            bool              `codec:"isTeam" json:"isTeam"`
}

func (o UIInboxSmallTeamRow) DeepCopy() UIInboxSmallTeamRow {
	return UIInboxSmallTeamRow{
		ConvID: o.ConvID.DeepCopy(),
		Name:   o.Name,
		Time:   o.Time.DeepCopy(),
		Snippet: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Snippet),
		SnippetDecoration: o.SnippetDecoration.DeepCopy(),
		Draft: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Draft),
		IsMuted: o.IsMuted,
		IsTeam:  o.IsTeam,
	}
}

type UIInboxBigTeamRowTyp int

const (
	UIInboxBigTeamRowTyp_LABEL   UIInboxBigTeamRowTyp = 1
	UIInboxBigTeamRowTyp_CHANNEL UIInboxBigTeamRowTyp = 2
)

func (o UIInboxBigTeamRowTyp) DeepCopy() UIInboxBigTeamRowTyp { return o }

var UIInboxBigTeamRowTypMap = map[string]UIInboxBigTeamRowTyp{
	"LABEL":   1,
	"CHANNEL": 2,
}

var UIInboxBigTeamRowTypRevMap = map[UIInboxBigTeamRowTyp]string{
	1: "LABEL",
	2: "CHANNEL",
}

func (e UIInboxBigTeamRowTyp) String() string {
	if v, ok := UIInboxBigTeamRowTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIInboxBigTeamChannelRow struct {
	ConvID      ConvIDStr `codec:"convID" json:"convID"`
	Teamname    string    `codec:"teamname" json:"teamname"`
	Channelname string    `codec:"channelname" json:"channelname"`
	Draft       *string   `codec:"draft,omitempty" json:"draft,omitempty"`
	IsMuted     bool      `codec:"isMuted" json:"isMuted"`
}

func (o UIInboxBigTeamChannelRow) DeepCopy() UIInboxBigTeamChannelRow {
	return UIInboxBigTeamChannelRow{
		ConvID:      o.ConvID.DeepCopy(),
		Teamname:    o.Teamname,
		Channelname: o.Channelname,
		Draft: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Draft),
		IsMuted: o.IsMuted,
	}
}

type UIInboxBigTeamLabelRow struct {
	Name string   `codec:"name" json:"name"`
	Id   TLFIDStr `codec:"id" json:"id"`
}

func (o UIInboxBigTeamLabelRow) DeepCopy() UIInboxBigTeamLabelRow {
	return UIInboxBigTeamLabelRow{
		Name: o.Name,
		Id:   o.Id.DeepCopy(),
	}
}

type UIInboxBigTeamRow struct {
	State__   UIInboxBigTeamRowTyp      `codec:"state" json:"state"`
	Label__   *UIInboxBigTeamLabelRow   `codec:"label,omitempty" json:"label,omitempty"`
	Channel__ *UIInboxBigTeamChannelRow `codec:"channel,omitempty" json:"channel,omitempty"`
}

func (o *UIInboxBigTeamRow) State() (ret UIInboxBigTeamRowTyp, err error) {
	switch o.State__ {
	case UIInboxBigTeamRowTyp_LABEL:
		if o.Label__ == nil {
			err = errors.New("unexpected nil value for Label__")
			return ret, err
		}
	case UIInboxBigTeamRowTyp_CHANNEL:
		if o.Channel__ == nil {
			err = errors.New("unexpected nil value for Channel__")
			return ret, err
		}
	}
	return o.State__, nil
}

func (o UIInboxBigTeamRow) Label() (res UIInboxBigTeamLabelRow) {
	if o.State__ != UIInboxBigTeamRowTyp_LABEL {
		panic("wrong case accessed")
	}
	if o.Label__ == nil {
		return
	}
	return *o.Label__
}

func (o UIInboxBigTeamRow) Channel() (res UIInboxBigTeamChannelRow) {
	if o.State__ != UIInboxBigTeamRowTyp_CHANNEL {
		panic("wrong case accessed")
	}
	if o.Channel__ == nil {
		return
	}
	return *o.Channel__
}

func NewUIInboxBigTeamRowWithLabel(v UIInboxBigTeamLabelRow) UIInboxBigTeamRow {
	return UIInboxBigTeamRow{
		State__: UIInboxBigTeamRowTyp_LABEL,
		Label__: &v,
	}
}

func NewUIInboxBigTeamRowWithChannel(v UIInboxBigTeamChannelRow) UIInboxBigTeamRow {
	return UIInboxBigTeamRow{
		State__:   UIInboxBigTeamRowTyp_CHANNEL,
		Channel__: &v,
	}
}

func (o UIInboxBigTeamRow) DeepCopy() UIInboxBigTeamRow {
	return UIInboxBigTeamRow{
		State__: o.State__.DeepCopy(),
		Label__: (func(x *UIInboxBigTeamLabelRow) *UIInboxBigTeamLabelRow {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Label__),
		Channel__: (func(x *UIInboxBigTeamChannelRow) *UIInboxBigTeamChannelRow {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Channel__),
	}
}

type UIInboxReselectInfo struct {
	OldConvID ConvIDStr  `codec:"oldConvID" json:"oldConvID"`
	NewConvID *ConvIDStr `codec:"newConvID,omitempty" json:"newConvID,omitempty"`
}

func (o UIInboxReselectInfo) DeepCopy() UIInboxReselectInfo {
	return UIInboxReselectInfo{
		OldConvID: o.OldConvID.DeepCopy(),
		NewConvID: (func(x *ConvIDStr) *ConvIDStr {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.NewConvID),
	}
}

type UIInboxLayout struct {
	TotalSmallTeams int                   `codec:"totalSmallTeams" json:"totalSmallTeams"`
	SmallTeams      []UIInboxSmallTeamRow `codec:"smallTeams" json:"smallTeams"`
	BigTeams        []UIInboxBigTeamRow   `codec:"bigTeams" json:"bigTeams"`
	ReselectInfo    *UIInboxReselectInfo  `codec:"reselectInfo,omitempty" json:"reselectInfo,omitempty"`
	WidgetList      []UIInboxSmallTeamRow `codec:"widgetList" json:"widgetList"`
}

func (o UIInboxLayout) DeepCopy() UIInboxLayout {
	return UIInboxLayout{
		TotalSmallTeams: o.TotalSmallTeams,
		SmallTeams: (func(x []UIInboxSmallTeamRow) []UIInboxSmallTeamRow {
			if x == nil {
				return nil
			}
			ret := make([]UIInboxSmallTeamRow, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SmallTeams),
		BigTeams: (func(x []UIInboxBigTeamRow) []UIInboxBigTeamRow {
			if x == nil {
				return nil
			}
			ret := make([]UIInboxBigTeamRow, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.BigTeams),
		ReselectInfo: (func(x *UIInboxReselectInfo) *UIInboxReselectInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReselectInfo),
		WidgetList: (func(x []UIInboxSmallTeamRow) []UIInboxSmallTeamRow {
			if x == nil {
				return nil
			}
			ret := make([]UIInboxSmallTeamRow, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.WidgetList),
	}
}

type UnverifiedInboxUIItemMetadata struct {
	ChannelName       string            `codec:"channelName" json:"channelName"`
	Headline          string            `codec:"headline" json:"headline"`
	HeadlineDecorated string            `codec:"headlineDecorated" json:"headlineDecorated"`
	Snippet           string            `codec:"snippet" json:"snippet"`
	SnippetDecoration SnippetDecoration `codec:"snippetDecoration" json:"snippetDecoration"`
	WriterNames       []string          `codec:"writerNames" json:"writerNames"`
	ResetParticipants []string          `codec:"resetParticipants" json:"resetParticipants"`
}

func (o UnverifiedInboxUIItemMetadata) DeepCopy() UnverifiedInboxUIItemMetadata {
	return UnverifiedInboxUIItemMetadata{
		ChannelName:       o.ChannelName,
		Headline:          o.Headline,
		HeadlineDecorated: o.HeadlineDecorated,
		Snippet:           o.Snippet,
		SnippetDecoration: o.SnippetDecoration.DeepCopy(),
		WriterNames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.WriterNames),
		ResetParticipants: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ResetParticipants),
	}
}

type UnverifiedInboxUIItem struct {
	ConvID          ConvIDStr                      `codec:"convID" json:"convID"`
	TlfID           TLFIDStr                       `codec:"tlfID" json:"tlfID"`
	TopicType       TopicType                      `codec:"topicType" json:"topicType"`
	IsPublic        bool                           `codec:"isPublic" json:"isPublic"`
	IsDefaultConv   bool                           `codec:"isDefaultConv" json:"isDefaultConv"`
	Name            string                         `codec:"name" json:"name"`
	Visibility      keybase1.TLFVisibility         `codec:"visibility" json:"visibility"`
	Status          ConversationStatus             `codec:"status" json:"status"`
	MembersType     ConversationMembersType        `codec:"membersType" json:"membersType"`
	MemberStatus    ConversationMemberStatus       `codec:"memberStatus" json:"memberStatus"`
	TeamType        TeamType                       `codec:"teamType" json:"teamType"`
	Notifications   *ConversationNotificationInfo  `codec:"notifications,omitempty" json:"notifications,omitempty"`
	Time            gregor1.Time                   `codec:"time" json:"time"`
	Version         ConversationVers               `codec:"version" json:"version"`
	LocalVersion    LocalConversationVers          `codec:"localVersion" json:"localVersion"`
	ConvRetention   *RetentionPolicy               `codec:"convRetention,omitempty" json:"convRetention,omitempty"`
	TeamRetention   *RetentionPolicy               `codec:"teamRetention,omitempty" json:"teamRetention,omitempty"`
	MaxMsgID        MessageID                      `codec:"maxMsgID" json:"maxMsgID"`
	MaxVisibleMsgID MessageID                      `codec:"maxVisibleMsgID" json:"maxVisibleMsgID"`
	ReadMsgID       MessageID                      `codec:"readMsgID" json:"readMsgID"`
	LocalMetadata   *UnverifiedInboxUIItemMetadata `codec:"localMetadata,omitempty" json:"localMetadata,omitempty"`
	Draft           *string                        `codec:"draft,omitempty" json:"draft,omitempty"`
	FinalizeInfo    *ConversationFinalizeInfo      `codec:"finalizeInfo,omitempty" json:"finalizeInfo,omitempty"`
	Supersedes      []ConversationMetadata         `codec:"supersedes" json:"supersedes"`
	SupersededBy    []ConversationMetadata         `codec:"supersededBy" json:"supersededBy"`
	Commands        ConversationCommandGroups      `codec:"commands" json:"commands"`
}

func (o UnverifiedInboxUIItem) DeepCopy() UnverifiedInboxUIItem {
	return UnverifiedInboxUIItem{
		ConvID:        o.ConvID.DeepCopy(),
		TlfID:         o.TlfID.DeepCopy(),
		TopicType:     o.TopicType.DeepCopy(),
		IsPublic:      o.IsPublic,
		IsDefaultConv: o.IsDefaultConv,
		Name:          o.Name,
		Visibility:    o.Visibility.DeepCopy(),
		Status:        o.Status.DeepCopy(),
		MembersType:   o.MembersType.DeepCopy(),
		MemberStatus:  o.MemberStatus.DeepCopy(),
		TeamType:      o.TeamType.DeepCopy(),
		Notifications: (func(x *ConversationNotificationInfo) *ConversationNotificationInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Notifications),
		Time:         o.Time.DeepCopy(),
		Version:      o.Version.DeepCopy(),
		LocalVersion: o.LocalVersion.DeepCopy(),
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
		MaxMsgID:        o.MaxMsgID.DeepCopy(),
		MaxVisibleMsgID: o.MaxVisibleMsgID.DeepCopy(),
		ReadMsgID:       o.ReadMsgID.DeepCopy(),
		LocalMetadata: (func(x *UnverifiedInboxUIItemMetadata) *UnverifiedInboxUIItemMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.LocalMetadata),
		Draft: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Draft),
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
		Commands: o.Commands.DeepCopy(),
	}
}

type UnverifiedInboxUIItems struct {
	Items   []UnverifiedInboxUIItem `codec:"items" json:"items"`
	Offline bool                    `codec:"offline" json:"offline"`
}

func (o UnverifiedInboxUIItems) DeepCopy() UnverifiedInboxUIItems {
	return UnverifiedInboxUIItems{
		Items: (func(x []UnverifiedInboxUIItem) []UnverifiedInboxUIItem {
			if x == nil {
				return nil
			}
			ret := make([]UnverifiedInboxUIItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Items),
		Offline: o.Offline,
	}
}

type UIParticipantType int

const (
	UIParticipantType_NONE    UIParticipantType = 0
	UIParticipantType_USER    UIParticipantType = 1
	UIParticipantType_PHONENO UIParticipantType = 2
	UIParticipantType_EMAIL   UIParticipantType = 3
)

func (o UIParticipantType) DeepCopy() UIParticipantType { return o }

var UIParticipantTypeMap = map[string]UIParticipantType{
	"NONE":    0,
	"USER":    1,
	"PHONENO": 2,
	"EMAIL":   3,
}

var UIParticipantTypeRevMap = map[UIParticipantType]string{
	0: "NONE",
	1: "USER",
	2: "PHONENO",
	3: "EMAIL",
}

func (e UIParticipantType) String() string {
	if v, ok := UIParticipantTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIParticipant struct {
	Type        UIParticipantType `codec:"type" json:"type"`
	Assertion   string            `codec:"assertion" json:"assertion"`
	InConvName  bool              `codec:"inConvName" json:"inConvName"`
	FullName    *string           `codec:"fullName,omitempty" json:"fullName,omitempty"`
	ContactName *string           `codec:"contactName,omitempty" json:"contactName,omitempty"`
}

func (o UIParticipant) DeepCopy() UIParticipant {
	return UIParticipant{
		Type:       o.Type.DeepCopy(),
		Assertion:  o.Assertion,
		InConvName: o.InConvName,
		FullName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.FullName),
		ContactName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ContactName),
	}
}

type UIPinnedMessage struct {
	Message        UIMessage `codec:"message" json:"message"`
	PinnerUsername string    `codec:"pinnerUsername" json:"pinnerUsername"`
}

func (o UIPinnedMessage) DeepCopy() UIPinnedMessage {
	return UIPinnedMessage{
		Message:        o.Message.DeepCopy(),
		PinnerUsername: o.PinnerUsername,
	}
}

type InboxUIItem struct {
	ConvID            ConvIDStr                     `codec:"convID" json:"convID"`
	TlfID             TLFIDStr                      `codec:"tlfID" json:"tlfID"`
	TopicType         TopicType                     `codec:"topicType" json:"topicType"`
	IsPublic          bool                          `codec:"isPublic" json:"isPublic"`
	IsEmpty           bool                          `codec:"isEmpty" json:"isEmpty"`
	IsDefaultConv     bool                          `codec:"isDefaultConv" json:"isDefaultConv"`
	Name              string                        `codec:"name" json:"name"`
	Snippet           string                        `codec:"snippet" json:"snippet"`
	SnippetDecoration SnippetDecoration             `codec:"snippetDecoration" json:"snippetDecoration"`
	Channel           string                        `codec:"channel" json:"channel"`
	Headline          string                        `codec:"headline" json:"headline"`
	HeadlineDecorated string                        `codec:"headlineDecorated" json:"headlineDecorated"`
	Draft             *string                       `codec:"draft,omitempty" json:"draft,omitempty"`
	Visibility        keybase1.TLFVisibility        `codec:"visibility" json:"visibility"`
	Participants      []UIParticipant               `codec:"participants" json:"participants"`
	ResetParticipants []string                      `codec:"resetParticipants" json:"resetParticipants"`
	Status            ConversationStatus            `codec:"status" json:"status"`
	MembersType       ConversationMembersType       `codec:"membersType" json:"membersType"`
	MemberStatus      ConversationMemberStatus      `codec:"memberStatus" json:"memberStatus"`
	TeamType          TeamType                      `codec:"teamType" json:"teamType"`
	Time              gregor1.Time                  `codec:"time" json:"time"`
	Notifications     *ConversationNotificationInfo `codec:"notifications,omitempty" json:"notifications,omitempty"`
	CreatorInfo       *ConversationCreatorInfoLocal `codec:"creatorInfo,omitempty" json:"creatorInfo,omitempty"`
	Version           ConversationVers              `codec:"version" json:"version"`
	LocalVersion      LocalConversationVers         `codec:"localVersion" json:"localVersion"`
	MaxMsgID          MessageID                     `codec:"maxMsgID" json:"maxMsgID"`
	MaxVisibleMsgID   MessageID                     `codec:"maxVisibleMsgID" json:"maxVisibleMsgID"`
	ReadMsgID         MessageID                     `codec:"readMsgID" json:"readMsgID"`
	ConvRetention     *RetentionPolicy              `codec:"convRetention,omitempty" json:"convRetention,omitempty"`
	TeamRetention     *RetentionPolicy              `codec:"teamRetention,omitempty" json:"teamRetention,omitempty"`
	ConvSettings      *ConversationSettingsLocal    `codec:"convSettings,omitempty" json:"convSettings,omitempty"`
	FinalizeInfo      *ConversationFinalizeInfo     `codec:"finalizeInfo,omitempty" json:"finalizeInfo,omitempty"`
	Supersedes        []ConversationMetadata        `codec:"supersedes" json:"supersedes"`
	SupersededBy      []ConversationMetadata        `codec:"supersededBy" json:"supersededBy"`
	Commands          ConversationCommandGroups     `codec:"commands" json:"commands"`
	BotCommands       ConversationCommandGroups     `codec:"botCommands" json:"botCommands"`
	BotAliases        map[string]string             `codec:"botAliases" json:"botAliases"`
	PinnedMsg         *UIPinnedMessage              `codec:"pinnedMsg,omitempty" json:"pinnedMsg,omitempty"`
}

func (o InboxUIItem) DeepCopy() InboxUIItem {
	return InboxUIItem{
		ConvID:            o.ConvID.DeepCopy(),
		TlfID:             o.TlfID.DeepCopy(),
		TopicType:         o.TopicType.DeepCopy(),
		IsPublic:          o.IsPublic,
		IsEmpty:           o.IsEmpty,
		IsDefaultConv:     o.IsDefaultConv,
		Name:              o.Name,
		Snippet:           o.Snippet,
		SnippetDecoration: o.SnippetDecoration.DeepCopy(),
		Channel:           o.Channel,
		Headline:          o.Headline,
		HeadlineDecorated: o.HeadlineDecorated,
		Draft: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Draft),
		Visibility: o.Visibility.DeepCopy(),
		Participants: (func(x []UIParticipant) []UIParticipant {
			if x == nil {
				return nil
			}
			ret := make([]UIParticipant, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Participants),
		ResetParticipants: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ResetParticipants),
		Status:       o.Status.DeepCopy(),
		MembersType:  o.MembersType.DeepCopy(),
		MemberStatus: o.MemberStatus.DeepCopy(),
		TeamType:     o.TeamType.DeepCopy(),
		Time:         o.Time.DeepCopy(),
		Notifications: (func(x *ConversationNotificationInfo) *ConversationNotificationInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Notifications),
		CreatorInfo: (func(x *ConversationCreatorInfoLocal) *ConversationCreatorInfoLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.CreatorInfo),
		Version:         o.Version.DeepCopy(),
		LocalVersion:    o.LocalVersion.DeepCopy(),
		MaxMsgID:        o.MaxMsgID.DeepCopy(),
		MaxVisibleMsgID: o.MaxVisibleMsgID.DeepCopy(),
		ReadMsgID:       o.ReadMsgID.DeepCopy(),
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
		ConvSettings: (func(x *ConversationSettingsLocal) *ConversationSettingsLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvSettings),
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
		Commands:    o.Commands.DeepCopy(),
		BotCommands: o.BotCommands.DeepCopy(),
		BotAliases: (func(x map[string]string) map[string]string {
			if x == nil {
				return nil
			}
			ret := make(map[string]string, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.BotAliases),
		PinnedMsg: (func(x *UIPinnedMessage) *UIPinnedMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PinnedMsg),
	}
}

type InboxUIItemError struct {
	Typ               ConversationErrorType   `codec:"typ" json:"typ"`
	Message           string                  `codec:"message" json:"message"`
	UnverifiedTLFName string                  `codec:"unverifiedTLFName" json:"unverifiedTLFName"`
	RekeyInfo         *ConversationErrorRekey `codec:"rekeyInfo,omitempty" json:"rekeyInfo,omitempty"`
	RemoteConv        UnverifiedInboxUIItem   `codec:"remoteConv" json:"remoteConv"`
}

func (o InboxUIItemError) DeepCopy() InboxUIItemError {
	return InboxUIItemError{
		Typ:               o.Typ.DeepCopy(),
		Message:           o.Message,
		UnverifiedTLFName: o.UnverifiedTLFName,
		RekeyInfo: (func(x *ConversationErrorRekey) *ConversationErrorRekey {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RekeyInfo),
		RemoteConv: o.RemoteConv.DeepCopy(),
	}
}

type InboxUIItems struct {
	Items   []InboxUIItem `codec:"items" json:"items"`
	Offline bool          `codec:"offline" json:"offline"`
}

func (o InboxUIItems) DeepCopy() InboxUIItems {
	return InboxUIItems{
		Items: (func(x []InboxUIItem) []InboxUIItem {
			if x == nil {
				return nil
			}
			ret := make([]InboxUIItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Items),
		Offline: o.Offline,
	}
}

type UIChannelNameMention struct {
	Name   string    `codec:"name" json:"name"`
	ConvID ConvIDStr `codec:"convID" json:"convID"`
}

func (o UIChannelNameMention) DeepCopy() UIChannelNameMention {
	return UIChannelNameMention{
		Name:   o.Name,
		ConvID: o.ConvID.DeepCopy(),
	}
}

type UIAssetUrlInfo struct {
	PreviewUrl          string  `codec:"previewUrl" json:"previewUrl"`
	FullUrl             string  `codec:"fullUrl" json:"fullUrl"`
	FullUrlCached       bool    `codec:"fullUrlCached" json:"fullUrlCached"`
	MimeType            string  `codec:"mimeType" json:"mimeType"`
	VideoDuration       *string `codec:"videoDuration,omitempty" json:"videoDuration,omitempty"`
	InlineVideoPlayable bool    `codec:"inlineVideoPlayable" json:"inlineVideoPlayable"`
}

func (o UIAssetUrlInfo) DeepCopy() UIAssetUrlInfo {
	return UIAssetUrlInfo{
		PreviewUrl:    o.PreviewUrl,
		FullUrl:       o.FullUrl,
		FullUrlCached: o.FullUrlCached,
		MimeType:      o.MimeType,
		VideoDuration: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.VideoDuration),
		InlineVideoPlayable: o.InlineVideoPlayable,
	}
}

type UIPaymentInfo struct {
	AccountID         *stellar1.AccountID    `codec:"accountID,omitempty" json:"accountID,omitempty"`
	AmountDescription string                 `codec:"amountDescription" json:"amountDescription"`
	Worth             string                 `codec:"worth" json:"worth"`
	WorthAtSendTime   string                 `codec:"worthAtSendTime" json:"worthAtSendTime"`
	Delta             stellar1.BalanceDelta  `codec:"delta" json:"delta"`
	Note              string                 `codec:"note" json:"note"`
	PaymentID         stellar1.PaymentID     `codec:"paymentID" json:"paymentID"`
	Status            stellar1.PaymentStatus `codec:"status" json:"status"`
	StatusDescription string                 `codec:"statusDescription" json:"statusDescription"`
	StatusDetail      string                 `codec:"statusDetail" json:"statusDetail"`
	ShowCancel        bool                   `codec:"showCancel" json:"showCancel"`
	FromUsername      string                 `codec:"fromUsername" json:"fromUsername"`
	ToUsername        string                 `codec:"toUsername" json:"toUsername"`
	SourceAmount      string                 `codec:"sourceAmount" json:"sourceAmount"`
	SourceAsset       stellar1.Asset         `codec:"sourceAsset" json:"sourceAsset"`
	IssuerDescription string                 `codec:"issuerDescription" json:"issuerDescription"`
}

func (o UIPaymentInfo) DeepCopy() UIPaymentInfo {
	return UIPaymentInfo{
		AccountID: (func(x *stellar1.AccountID) *stellar1.AccountID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.AccountID),
		AmountDescription: o.AmountDescription,
		Worth:             o.Worth,
		WorthAtSendTime:   o.WorthAtSendTime,
		Delta:             o.Delta.DeepCopy(),
		Note:              o.Note,
		PaymentID:         o.PaymentID.DeepCopy(),
		Status:            o.Status.DeepCopy(),
		StatusDescription: o.StatusDescription,
		StatusDetail:      o.StatusDetail,
		ShowCancel:        o.ShowCancel,
		FromUsername:      o.FromUsername,
		ToUsername:        o.ToUsername,
		SourceAmount:      o.SourceAmount,
		SourceAsset:       o.SourceAsset.DeepCopy(),
		IssuerDescription: o.IssuerDescription,
	}
}

type UIRequestInfo struct {
	Amount             string                        `codec:"amount" json:"amount"`
	AmountDescription  string                        `codec:"amountDescription" json:"amountDescription"`
	Asset              *stellar1.Asset               `codec:"asset,omitempty" json:"asset,omitempty"`
	Currency           *stellar1.OutsideCurrencyCode `codec:"currency,omitempty" json:"currency,omitempty"`
	WorthAtRequestTime string                        `codec:"worthAtRequestTime" json:"worthAtRequestTime"`
	Status             stellar1.RequestStatus        `codec:"status" json:"status"`
}

func (o UIRequestInfo) DeepCopy() UIRequestInfo {
	return UIRequestInfo{
		Amount:            o.Amount,
		AmountDescription: o.AmountDescription,
		Asset: (func(x *stellar1.Asset) *stellar1.Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Asset),
		Currency: (func(x *stellar1.OutsideCurrencyCode) *stellar1.OutsideCurrencyCode {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Currency),
		WorthAtRequestTime: o.WorthAtRequestTime,
		Status:             o.Status.DeepCopy(),
	}
}

type UIMessageUnfurlInfo struct {
	UnfurlMessageID MessageID     `codec:"unfurlMessageID" json:"unfurlMessageID"`
	Url             string        `codec:"url" json:"url"`
	Unfurl          UnfurlDisplay `codec:"unfurl" json:"unfurl"`
	IsCollapsed     bool          `codec:"isCollapsed" json:"isCollapsed"`
}

func (o UIMessageUnfurlInfo) DeepCopy() UIMessageUnfurlInfo {
	return UIMessageUnfurlInfo{
		UnfurlMessageID: o.UnfurlMessageID.DeepCopy(),
		Url:             o.Url,
		Unfurl:          o.Unfurl.DeepCopy(),
		IsCollapsed:     o.IsCollapsed,
	}
}

type UIMessageValid struct {
	MessageID             MessageID              `codec:"messageID" json:"messageID"`
	Ctime                 gregor1.Time           `codec:"ctime" json:"ctime"`
	OutboxID              *string                `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	MessageBody           MessageBody            `codec:"messageBody" json:"messageBody"`
	DecoratedTextBody     *string                `codec:"decoratedTextBody,omitempty" json:"decoratedTextBody,omitempty"`
	BodySummary           string                 `codec:"bodySummary" json:"bodySummary"`
	SenderUsername        string                 `codec:"senderUsername" json:"senderUsername"`
	SenderDeviceName      string                 `codec:"senderDeviceName" json:"senderDeviceName"`
	SenderDeviceType      string                 `codec:"senderDeviceType" json:"senderDeviceType"`
	SenderUID             gregor1.UID            `codec:"senderUID" json:"senderUID"`
	SenderDeviceID        gregor1.DeviceID       `codec:"senderDeviceID" json:"senderDeviceID"`
	Superseded            bool                   `codec:"superseded" json:"superseded"`
	AssetUrlInfo          *UIAssetUrlInfo        `codec:"assetUrlInfo,omitempty" json:"assetUrlInfo,omitempty"`
	SenderDeviceRevokedAt *gregor1.Time          `codec:"senderDeviceRevokedAt,omitempty" json:"senderDeviceRevokedAt,omitempty"`
	AtMentions            []string               `codec:"atMentions" json:"atMentions"`
	ChannelMention        ChannelMention         `codec:"channelMention" json:"channelMention"`
	ChannelNameMentions   []UIChannelNameMention `codec:"channelNameMentions" json:"channelNameMentions"`
	IsEphemeral           bool                   `codec:"isEphemeral" json:"isEphemeral"`
	IsEphemeralExpired    bool                   `codec:"isEphemeralExpired" json:"isEphemeralExpired"`
	ExplodedBy            *string                `codec:"explodedBy,omitempty" json:"explodedBy,omitempty"`
	Etime                 gregor1.Time           `codec:"etime" json:"etime"`
	Reactions             ReactionMap            `codec:"reactions" json:"reactions"`
	HasPairwiseMacs       bool                   `codec:"hasPairwiseMacs" json:"hasPairwiseMacs"`
	PaymentInfos          []UIPaymentInfo        `codec:"paymentInfos" json:"paymentInfos"`
	RequestInfo           *UIRequestInfo         `codec:"requestInfo,omitempty" json:"requestInfo,omitempty"`
	Unfurls               []UIMessageUnfurlInfo  `codec:"unfurls" json:"unfurls"`
	IsCollapsed           bool                   `codec:"isCollapsed" json:"isCollapsed"`
	FlipGameID            *FlipGameIDStr         `codec:"flipGameID,omitempty" json:"flipGameID,omitempty"`
	IsDeleteable          bool                   `codec:"isDeleteable" json:"isDeleteable"`
	IsEditable            bool                   `codec:"isEditable" json:"isEditable"`
	ReplyTo               *UIMessage             `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	PinnedMessageID       *MessageID             `codec:"pinnedMessageID,omitempty" json:"pinnedMessageID,omitempty"`
	BotUsername           string                 `codec:"botUsername" json:"botUsername"`
}

func (o UIMessageValid) DeepCopy() UIMessageValid {
	return UIMessageValid{
		MessageID: o.MessageID.DeepCopy(),
		Ctime:     o.Ctime.DeepCopy(),
		OutboxID: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.OutboxID),
		MessageBody: o.MessageBody.DeepCopy(),
		DecoratedTextBody: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DecoratedTextBody),
		BodySummary:      o.BodySummary,
		SenderUsername:   o.SenderUsername,
		SenderDeviceName: o.SenderDeviceName,
		SenderDeviceType: o.SenderDeviceType,
		SenderUID:        o.SenderUID.DeepCopy(),
		SenderDeviceID:   o.SenderDeviceID.DeepCopy(),
		Superseded:       o.Superseded,
		AssetUrlInfo: (func(x *UIAssetUrlInfo) *UIAssetUrlInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.AssetUrlInfo),
		SenderDeviceRevokedAt: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SenderDeviceRevokedAt),
		AtMentions: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.AtMentions),
		ChannelMention: o.ChannelMention.DeepCopy(),
		ChannelNameMentions: (func(x []UIChannelNameMention) []UIChannelNameMention {
			if x == nil {
				return nil
			}
			ret := make([]UIChannelNameMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ChannelNameMentions),
		IsEphemeral:        o.IsEphemeral,
		IsEphemeralExpired: o.IsEphemeralExpired,
		ExplodedBy: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ExplodedBy),
		Etime:           o.Etime.DeepCopy(),
		Reactions:       o.Reactions.DeepCopy(),
		HasPairwiseMacs: o.HasPairwiseMacs,
		PaymentInfos: (func(x []UIPaymentInfo) []UIPaymentInfo {
			if x == nil {
				return nil
			}
			ret := make([]UIPaymentInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.PaymentInfos),
		RequestInfo: (func(x *UIRequestInfo) *UIRequestInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RequestInfo),
		Unfurls: (func(x []UIMessageUnfurlInfo) []UIMessageUnfurlInfo {
			if x == nil {
				return nil
			}
			ret := make([]UIMessageUnfurlInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Unfurls),
		IsCollapsed: o.IsCollapsed,
		FlipGameID: (func(x *FlipGameIDStr) *FlipGameIDStr {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FlipGameID),
		IsDeleteable: o.IsDeleteable,
		IsEditable:   o.IsEditable,
		ReplyTo: (func(x *UIMessage) *UIMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyTo),
		PinnedMessageID: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PinnedMessageID),
		BotUsername: o.BotUsername,
	}
}

type UIMessageOutbox struct {
	State             OutboxState     `codec:"state" json:"state"`
	OutboxID          string          `codec:"outboxID" json:"outboxID"`
	MessageType       MessageType     `codec:"messageType" json:"messageType"`
	Body              string          `codec:"body" json:"body"`
	DecoratedTextBody *string         `codec:"decoratedTextBody,omitempty" json:"decoratedTextBody,omitempty"`
	Ctime             gregor1.Time    `codec:"ctime" json:"ctime"`
	Ordinal           float64         `codec:"ordinal" json:"ordinal"`
	IsEphemeral       bool            `codec:"isEphemeral" json:"isEphemeral"`
	FlipGameID        *FlipGameIDStr  `codec:"flipGameID,omitempty" json:"flipGameID,omitempty"`
	ReplyTo           *UIMessage      `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	Filename          string          `codec:"filename" json:"filename"`
	Title             string          `codec:"title" json:"title"`
	Preview           *MakePreviewRes `codec:"preview,omitempty" json:"preview,omitempty"`
}

func (o UIMessageOutbox) DeepCopy() UIMessageOutbox {
	return UIMessageOutbox{
		State:       o.State.DeepCopy(),
		OutboxID:    o.OutboxID,
		MessageType: o.MessageType.DeepCopy(),
		Body:        o.Body,
		DecoratedTextBody: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DecoratedTextBody),
		Ctime:       o.Ctime.DeepCopy(),
		Ordinal:     o.Ordinal,
		IsEphemeral: o.IsEphemeral,
		FlipGameID: (func(x *FlipGameIDStr) *FlipGameIDStr {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FlipGameID),
		ReplyTo: (func(x *UIMessage) *UIMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyTo),
		Filename: o.Filename,
		Title:    o.Title,
		Preview: (func(x *MakePreviewRes) *MakePreviewRes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Preview),
	}
}

type UIMessageJourneycard struct {
	Ordinal        float64         `codec:"ordinal" json:"ordinal"`
	CardType       JourneycardType `codec:"cardType" json:"cardType"`
	HighlightMsgID MessageID       `codec:"highlightMsgID" json:"highlightMsgID"`
	OpenTeam       bool            `codec:"openTeam" json:"openTeam"`
}

func (o UIMessageJourneycard) DeepCopy() UIMessageJourneycard {
	return UIMessageJourneycard{
		Ordinal:        o.Ordinal,
		CardType:       o.CardType.DeepCopy(),
		HighlightMsgID: o.HighlightMsgID.DeepCopy(),
		OpenTeam:       o.OpenTeam,
	}
}

type MessageUnboxedState int

const (
	MessageUnboxedState_VALID       MessageUnboxedState = 1
	MessageUnboxedState_ERROR       MessageUnboxedState = 2
	MessageUnboxedState_OUTBOX      MessageUnboxedState = 3
	MessageUnboxedState_PLACEHOLDER MessageUnboxedState = 4
	MessageUnboxedState_JOURNEYCARD MessageUnboxedState = 5
)

func (o MessageUnboxedState) DeepCopy() MessageUnboxedState { return o }

var MessageUnboxedStateMap = map[string]MessageUnboxedState{
	"VALID":       1,
	"ERROR":       2,
	"OUTBOX":      3,
	"PLACEHOLDER": 4,
	"JOURNEYCARD": 5,
}

var MessageUnboxedStateRevMap = map[MessageUnboxedState]string{
	1: "VALID",
	2: "ERROR",
	3: "OUTBOX",
	4: "PLACEHOLDER",
	5: "JOURNEYCARD",
}

func (e MessageUnboxedState) String() string {
	if v, ok := MessageUnboxedStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIMessage struct {
	State__       MessageUnboxedState        `codec:"state" json:"state"`
	Valid__       *UIMessageValid            `codec:"valid,omitempty" json:"valid,omitempty"`
	Error__       *MessageUnboxedError       `codec:"error,omitempty" json:"error,omitempty"`
	Outbox__      *UIMessageOutbox           `codec:"outbox,omitempty" json:"outbox,omitempty"`
	Placeholder__ *MessageUnboxedPlaceholder `codec:"placeholder,omitempty" json:"placeholder,omitempty"`
	Journeycard__ *UIMessageJourneycard      `codec:"journeycard,omitempty" json:"journeycard,omitempty"`
}

func (o *UIMessage) State() (ret MessageUnboxedState, err error) {
	switch o.State__ {
	case MessageUnboxedState_VALID:
		if o.Valid__ == nil {
			err = errors.New("unexpected nil value for Valid__")
			return ret, err
		}
	case MessageUnboxedState_ERROR:
		if o.Error__ == nil {
			err = errors.New("unexpected nil value for Error__")
			return ret, err
		}
	case MessageUnboxedState_OUTBOX:
		if o.Outbox__ == nil {
			err = errors.New("unexpected nil value for Outbox__")
			return ret, err
		}
	case MessageUnboxedState_PLACEHOLDER:
		if o.Placeholder__ == nil {
			err = errors.New("unexpected nil value for Placeholder__")
			return ret, err
		}
	case MessageUnboxedState_JOURNEYCARD:
		if o.Journeycard__ == nil {
			err = errors.New("unexpected nil value for Journeycard__")
			return ret, err
		}
	}
	return o.State__, nil
}

func (o UIMessage) Valid() (res UIMessageValid) {
	if o.State__ != MessageUnboxedState_VALID {
		panic("wrong case accessed")
	}
	if o.Valid__ == nil {
		return
	}
	return *o.Valid__
}

func (o UIMessage) Error() (res MessageUnboxedError) {
	if o.State__ != MessageUnboxedState_ERROR {
		panic("wrong case accessed")
	}
	if o.Error__ == nil {
		return
	}
	return *o.Error__
}

func (o UIMessage) Outbox() (res UIMessageOutbox) {
	if o.State__ != MessageUnboxedState_OUTBOX {
		panic("wrong case accessed")
	}
	if o.Outbox__ == nil {
		return
	}
	return *o.Outbox__
}

func (o UIMessage) Placeholder() (res MessageUnboxedPlaceholder) {
	if o.State__ != MessageUnboxedState_PLACEHOLDER {
		panic("wrong case accessed")
	}
	if o.Placeholder__ == nil {
		return
	}
	return *o.Placeholder__
}

func (o UIMessage) Journeycard() (res UIMessageJourneycard) {
	if o.State__ != MessageUnboxedState_JOURNEYCARD {
		panic("wrong case accessed")
	}
	if o.Journeycard__ == nil {
		return
	}
	return *o.Journeycard__
}

func NewUIMessageWithValid(v UIMessageValid) UIMessage {
	return UIMessage{
		State__: MessageUnboxedState_VALID,
		Valid__: &v,
	}
}

func NewUIMessageWithError(v MessageUnboxedError) UIMessage {
	return UIMessage{
		State__: MessageUnboxedState_ERROR,
		Error__: &v,
	}
}

func NewUIMessageWithOutbox(v UIMessageOutbox) UIMessage {
	return UIMessage{
		State__:  MessageUnboxedState_OUTBOX,
		Outbox__: &v,
	}
}

func NewUIMessageWithPlaceholder(v MessageUnboxedPlaceholder) UIMessage {
	return UIMessage{
		State__:       MessageUnboxedState_PLACEHOLDER,
		Placeholder__: &v,
	}
}

func NewUIMessageWithJourneycard(v UIMessageJourneycard) UIMessage {
	return UIMessage{
		State__:       MessageUnboxedState_JOURNEYCARD,
		Journeycard__: &v,
	}
}

func (o UIMessage) DeepCopy() UIMessage {
	return UIMessage{
		State__: o.State__.DeepCopy(),
		Valid__: (func(x *UIMessageValid) *UIMessageValid {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Valid__),
		Error__: (func(x *MessageUnboxedError) *MessageUnboxedError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Error__),
		Outbox__: (func(x *UIMessageOutbox) *UIMessageOutbox {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Outbox__),
		Placeholder__: (func(x *MessageUnboxedPlaceholder) *MessageUnboxedPlaceholder {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Placeholder__),
		Journeycard__: (func(x *UIMessageJourneycard) *UIMessageJourneycard {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Journeycard__),
	}
}

type UIMessages struct {
	Messages   []UIMessage   `codec:"messages" json:"messages"`
	Pagination *UIPagination `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

func (o UIMessages) DeepCopy() UIMessages {
	return UIMessages{
		Messages: (func(x []UIMessage) []UIMessage {
			if x == nil {
				return nil
			}
			ret := make([]UIMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Messages),
		Pagination: (func(x *UIPagination) *UIPagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pagination),
	}
}

type UITeamMention struct {
	InTeam       bool       `codec:"inTeam" json:"inTeam"`
	Open         bool       `codec:"open" json:"open"`
	Description  *string    `codec:"description,omitempty" json:"description,omitempty"`
	NumMembers   *int       `codec:"numMembers,omitempty" json:"numMembers,omitempty"`
	PublicAdmins []string   `codec:"publicAdmins" json:"publicAdmins"`
	ConvID       *ConvIDStr `codec:"convID,omitempty" json:"convID,omitempty"`
}

func (o UITeamMention) DeepCopy() UITeamMention {
	return UITeamMention{
		InTeam: o.InTeam,
		Open:   o.Open,
		Description: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Description),
		NumMembers: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.NumMembers),
		PublicAdmins: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.PublicAdmins),
		ConvID: (func(x *ConvIDStr) *ConvIDStr {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvID),
	}
}

type UITextDecorationTyp int

const (
	UITextDecorationTyp_PAYMENT            UITextDecorationTyp = 0
	UITextDecorationTyp_ATMENTION          UITextDecorationTyp = 1
	UITextDecorationTyp_CHANNELNAMEMENTION UITextDecorationTyp = 2
	UITextDecorationTyp_MAYBEMENTION       UITextDecorationTyp = 3
	UITextDecorationTyp_LINK               UITextDecorationTyp = 4
	UITextDecorationTyp_MAILTO             UITextDecorationTyp = 5
	UITextDecorationTyp_KBFSPATH           UITextDecorationTyp = 6
)

func (o UITextDecorationTyp) DeepCopy() UITextDecorationTyp { return o }

var UITextDecorationTypMap = map[string]UITextDecorationTyp{
	"PAYMENT":            0,
	"ATMENTION":          1,
	"CHANNELNAMEMENTION": 2,
	"MAYBEMENTION":       3,
	"LINK":               4,
	"MAILTO":             5,
	"KBFSPATH":           6,
}

var UITextDecorationTypRevMap = map[UITextDecorationTyp]string{
	0: "PAYMENT",
	1: "ATMENTION",
	2: "CHANNELNAMEMENTION",
	3: "MAYBEMENTION",
	4: "LINK",
	5: "MAILTO",
	6: "KBFSPATH",
}

func (e UITextDecorationTyp) String() string {
	if v, ok := UITextDecorationTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIMaybeMentionStatus int

const (
	UIMaybeMentionStatus_UNKNOWN UIMaybeMentionStatus = 0
	UIMaybeMentionStatus_USER    UIMaybeMentionStatus = 1
	UIMaybeMentionStatus_TEAM    UIMaybeMentionStatus = 2
	UIMaybeMentionStatus_NOTHING UIMaybeMentionStatus = 3
)

func (o UIMaybeMentionStatus) DeepCopy() UIMaybeMentionStatus { return o }

var UIMaybeMentionStatusMap = map[string]UIMaybeMentionStatus{
	"UNKNOWN": 0,
	"USER":    1,
	"TEAM":    2,
	"NOTHING": 3,
}

var UIMaybeMentionStatusRevMap = map[UIMaybeMentionStatus]string{
	0: "UNKNOWN",
	1: "USER",
	2: "TEAM",
	3: "NOTHING",
}

func (e UIMaybeMentionStatus) String() string {
	if v, ok := UIMaybeMentionStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UILinkDecoration struct {
	Url      string `codec:"url" json:"url"`
	Punycode string `codec:"punycode" json:"punycode"`
}

func (o UILinkDecoration) DeepCopy() UILinkDecoration {
	return UILinkDecoration{
		Url:      o.Url,
		Punycode: o.Punycode,
	}
}

type UIMaybeMentionInfo struct {
	Status__ UIMaybeMentionStatus `codec:"status" json:"status"`
	Team__   *UITeamMention       `codec:"team,omitempty" json:"team,omitempty"`
}

func (o *UIMaybeMentionInfo) Status() (ret UIMaybeMentionStatus, err error) {
	switch o.Status__ {
	case UIMaybeMentionStatus_TEAM:
		if o.Team__ == nil {
			err = errors.New("unexpected nil value for Team__")
			return ret, err
		}
	}
	return o.Status__, nil
}

func (o UIMaybeMentionInfo) Team() (res UITeamMention) {
	if o.Status__ != UIMaybeMentionStatus_TEAM {
		panic("wrong case accessed")
	}
	if o.Team__ == nil {
		return
	}
	return *o.Team__
}

func NewUIMaybeMentionInfoWithUnknown() UIMaybeMentionInfo {
	return UIMaybeMentionInfo{
		Status__: UIMaybeMentionStatus_UNKNOWN,
	}
}

func NewUIMaybeMentionInfoWithUser() UIMaybeMentionInfo {
	return UIMaybeMentionInfo{
		Status__: UIMaybeMentionStatus_USER,
	}
}

func NewUIMaybeMentionInfoWithTeam(v UITeamMention) UIMaybeMentionInfo {
	return UIMaybeMentionInfo{
		Status__: UIMaybeMentionStatus_TEAM,
		Team__:   &v,
	}
}

func NewUIMaybeMentionInfoWithNothing() UIMaybeMentionInfo {
	return UIMaybeMentionInfo{
		Status__: UIMaybeMentionStatus_NOTHING,
	}
}

func (o UIMaybeMentionInfo) DeepCopy() UIMaybeMentionInfo {
	return UIMaybeMentionInfo{
		Status__: o.Status__.DeepCopy(),
		Team__: (func(x *UITeamMention) *UITeamMention {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Team__),
	}
}

type UITextDecoration struct {
	Typ__                UITextDecorationTyp   `codec:"typ" json:"typ"`
	Payment__            *TextPayment          `codec:"payment,omitempty" json:"payment,omitempty"`
	Atmention__          *string               `codec:"atmention,omitempty" json:"atmention,omitempty"`
	Channelnamemention__ *UIChannelNameMention `codec:"channelnamemention,omitempty" json:"channelnamemention,omitempty"`
	Maybemention__       *MaybeMention         `codec:"maybemention,omitempty" json:"maybemention,omitempty"`
	Link__               *UILinkDecoration     `codec:"link,omitempty" json:"link,omitempty"`
	Mailto__             *UILinkDecoration     `codec:"mailto,omitempty" json:"mailto,omitempty"`
	Kbfspath__           *KBFSPath             `codec:"kbfspath,omitempty" json:"kbfspath,omitempty"`
}

func (o *UITextDecoration) Typ() (ret UITextDecorationTyp, err error) {
	switch o.Typ__ {
	case UITextDecorationTyp_PAYMENT:
		if o.Payment__ == nil {
			err = errors.New("unexpected nil value for Payment__")
			return ret, err
		}
	case UITextDecorationTyp_ATMENTION:
		if o.Atmention__ == nil {
			err = errors.New("unexpected nil value for Atmention__")
			return ret, err
		}
	case UITextDecorationTyp_CHANNELNAMEMENTION:
		if o.Channelnamemention__ == nil {
			err = errors.New("unexpected nil value for Channelnamemention__")
			return ret, err
		}
	case UITextDecorationTyp_MAYBEMENTION:
		if o.Maybemention__ == nil {
			err = errors.New("unexpected nil value for Maybemention__")
			return ret, err
		}
	case UITextDecorationTyp_LINK:
		if o.Link__ == nil {
			err = errors.New("unexpected nil value for Link__")
			return ret, err
		}
	case UITextDecorationTyp_MAILTO:
		if o.Mailto__ == nil {
			err = errors.New("unexpected nil value for Mailto__")
			return ret, err
		}
	case UITextDecorationTyp_KBFSPATH:
		if o.Kbfspath__ == nil {
			err = errors.New("unexpected nil value for Kbfspath__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o UITextDecoration) Payment() (res TextPayment) {
	if o.Typ__ != UITextDecorationTyp_PAYMENT {
		panic("wrong case accessed")
	}
	if o.Payment__ == nil {
		return
	}
	return *o.Payment__
}

func (o UITextDecoration) Atmention() (res string) {
	if o.Typ__ != UITextDecorationTyp_ATMENTION {
		panic("wrong case accessed")
	}
	if o.Atmention__ == nil {
		return
	}
	return *o.Atmention__
}

func (o UITextDecoration) Channelnamemention() (res UIChannelNameMention) {
	if o.Typ__ != UITextDecorationTyp_CHANNELNAMEMENTION {
		panic("wrong case accessed")
	}
	if o.Channelnamemention__ == nil {
		return
	}
	return *o.Channelnamemention__
}

func (o UITextDecoration) Maybemention() (res MaybeMention) {
	if o.Typ__ != UITextDecorationTyp_MAYBEMENTION {
		panic("wrong case accessed")
	}
	if o.Maybemention__ == nil {
		return
	}
	return *o.Maybemention__
}

func (o UITextDecoration) Link() (res UILinkDecoration) {
	if o.Typ__ != UITextDecorationTyp_LINK {
		panic("wrong case accessed")
	}
	if o.Link__ == nil {
		return
	}
	return *o.Link__
}

func (o UITextDecoration) Mailto() (res UILinkDecoration) {
	if o.Typ__ != UITextDecorationTyp_MAILTO {
		panic("wrong case accessed")
	}
	if o.Mailto__ == nil {
		return
	}
	return *o.Mailto__
}

func (o UITextDecoration) Kbfspath() (res KBFSPath) {
	if o.Typ__ != UITextDecorationTyp_KBFSPATH {
		panic("wrong case accessed")
	}
	if o.Kbfspath__ == nil {
		return
	}
	return *o.Kbfspath__
}

func NewUITextDecorationWithPayment(v TextPayment) UITextDecoration {
	return UITextDecoration{
		Typ__:     UITextDecorationTyp_PAYMENT,
		Payment__: &v,
	}
}

func NewUITextDecorationWithAtmention(v string) UITextDecoration {
	return UITextDecoration{
		Typ__:       UITextDecorationTyp_ATMENTION,
		Atmention__: &v,
	}
}

func NewUITextDecorationWithChannelnamemention(v UIChannelNameMention) UITextDecoration {
	return UITextDecoration{
		Typ__:                UITextDecorationTyp_CHANNELNAMEMENTION,
		Channelnamemention__: &v,
	}
}

func NewUITextDecorationWithMaybemention(v MaybeMention) UITextDecoration {
	return UITextDecoration{
		Typ__:          UITextDecorationTyp_MAYBEMENTION,
		Maybemention__: &v,
	}
}

func NewUITextDecorationWithLink(v UILinkDecoration) UITextDecoration {
	return UITextDecoration{
		Typ__:  UITextDecorationTyp_LINK,
		Link__: &v,
	}
}

func NewUITextDecorationWithMailto(v UILinkDecoration) UITextDecoration {
	return UITextDecoration{
		Typ__:    UITextDecorationTyp_MAILTO,
		Mailto__: &v,
	}
}

func NewUITextDecorationWithKbfspath(v KBFSPath) UITextDecoration {
	return UITextDecoration{
		Typ__:      UITextDecorationTyp_KBFSPATH,
		Kbfspath__: &v,
	}
}

func (o UITextDecoration) DeepCopy() UITextDecoration {
	return UITextDecoration{
		Typ__: o.Typ__.DeepCopy(),
		Payment__: (func(x *TextPayment) *TextPayment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Payment__),
		Atmention__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Atmention__),
		Channelnamemention__: (func(x *UIChannelNameMention) *UIChannelNameMention {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Channelnamemention__),
		Maybemention__: (func(x *MaybeMention) *MaybeMention {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Maybemention__),
		Link__: (func(x *UILinkDecoration) *UILinkDecoration {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Link__),
		Mailto__: (func(x *UILinkDecoration) *UILinkDecoration {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Mailto__),
		Kbfspath__: (func(x *KBFSPath) *KBFSPath {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Kbfspath__),
	}
}

type UIChatThreadStatusTyp int

const (
	UIChatThreadStatusTyp_NONE       UIChatThreadStatusTyp = 0
	UIChatThreadStatusTyp_SERVER     UIChatThreadStatusTyp = 1
	UIChatThreadStatusTyp_VALIDATING UIChatThreadStatusTyp = 2
	UIChatThreadStatusTyp_VALIDATED  UIChatThreadStatusTyp = 3
)

func (o UIChatThreadStatusTyp) DeepCopy() UIChatThreadStatusTyp { return o }

var UIChatThreadStatusTypMap = map[string]UIChatThreadStatusTyp{
	"NONE":       0,
	"SERVER":     1,
	"VALIDATING": 2,
	"VALIDATED":  3,
}

var UIChatThreadStatusTypRevMap = map[UIChatThreadStatusTyp]string{
	0: "NONE",
	1: "SERVER",
	2: "VALIDATING",
	3: "VALIDATED",
}

func (e UIChatThreadStatusTyp) String() string {
	if v, ok := UIChatThreadStatusTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIChatThreadStatus struct {
	Typ__        UIChatThreadStatusTyp `codec:"typ" json:"typ"`
	Validating__ *int                  `codec:"validating,omitempty" json:"validating,omitempty"`
}

func (o *UIChatThreadStatus) Typ() (ret UIChatThreadStatusTyp, err error) {
	switch o.Typ__ {
	case UIChatThreadStatusTyp_VALIDATING:
		if o.Validating__ == nil {
			err = errors.New("unexpected nil value for Validating__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o UIChatThreadStatus) Validating() (res int) {
	if o.Typ__ != UIChatThreadStatusTyp_VALIDATING {
		panic("wrong case accessed")
	}
	if o.Validating__ == nil {
		return
	}
	return *o.Validating__
}

func NewUIChatThreadStatusWithNone() UIChatThreadStatus {
	return UIChatThreadStatus{
		Typ__: UIChatThreadStatusTyp_NONE,
	}
}

func NewUIChatThreadStatusWithServer() UIChatThreadStatus {
	return UIChatThreadStatus{
		Typ__: UIChatThreadStatusTyp_SERVER,
	}
}

func NewUIChatThreadStatusWithValidating(v int) UIChatThreadStatus {
	return UIChatThreadStatus{
		Typ__:        UIChatThreadStatusTyp_VALIDATING,
		Validating__: &v,
	}
}

func NewUIChatThreadStatusWithValidated() UIChatThreadStatus {
	return UIChatThreadStatus{
		Typ__: UIChatThreadStatusTyp_VALIDATED,
	}
}

func (o UIChatThreadStatus) DeepCopy() UIChatThreadStatus {
	return UIChatThreadStatus{
		Typ__: o.Typ__.DeepCopy(),
		Validating__: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Validating__),
	}
}

type UIChatSearchConvHit struct {
	ConvID   ConvIDStr    `codec:"convID" json:"convID"`
	TeamType TeamType     `codec:"teamType" json:"teamType"`
	Name     string       `codec:"name" json:"name"`
	Mtime    gregor1.Time `codec:"mtime" json:"mtime"`
}

func (o UIChatSearchConvHit) DeepCopy() UIChatSearchConvHit {
	return UIChatSearchConvHit{
		ConvID:   o.ConvID.DeepCopy(),
		TeamType: o.TeamType.DeepCopy(),
		Name:     o.Name,
		Mtime:    o.Mtime.DeepCopy(),
	}
}

type UIChatSearchConvHits struct {
	Hits          []UIChatSearchConvHit `codec:"hits" json:"hits"`
	UnreadMatches bool                  `codec:"unreadMatches" json:"unreadMatches"`
}

func (o UIChatSearchConvHits) DeepCopy() UIChatSearchConvHits {
	return UIChatSearchConvHits{
		Hits: (func(x []UIChatSearchConvHit) []UIChatSearchConvHit {
			if x == nil {
				return nil
			}
			ret := make([]UIChatSearchConvHit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Hits),
		UnreadMatches: o.UnreadMatches,
	}
}

type UIChatPayment struct {
	Username      string  `codec:"username" json:"username"`
	FullName      string  `codec:"fullName" json:"fullName"`
	XlmAmount     string  `codec:"xlmAmount" json:"xlmAmount"`
	Error         *string `codec:"error,omitempty" json:"error,omitempty"`
	DisplayAmount *string `codec:"displayAmount,omitempty" json:"displayAmount,omitempty"`
}

func (o UIChatPayment) DeepCopy() UIChatPayment {
	return UIChatPayment{
		Username:  o.Username,
		FullName:  o.FullName,
		XlmAmount: o.XlmAmount,
		Error: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Error),
		DisplayAmount: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.DisplayAmount),
	}
}

type UIChatPaymentSummary struct {
	XlmTotal     string          `codec:"xlmTotal" json:"xlmTotal"`
	DisplayTotal string          `codec:"displayTotal" json:"displayTotal"`
	Payments     []UIChatPayment `codec:"payments" json:"payments"`
}

func (o UIChatPaymentSummary) DeepCopy() UIChatPaymentSummary {
	return UIChatPaymentSummary{
		XlmTotal:     o.XlmTotal,
		DisplayTotal: o.DisplayTotal,
		Payments: (func(x []UIChatPayment) []UIChatPayment {
			if x == nil {
				return nil
			}
			ret := make([]UIChatPayment, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Payments),
	}
}

type GiphySearchResult struct {
	TargetUrl      string `codec:"targetUrl" json:"targetUrl"`
	PreviewUrl     string `codec:"previewUrl" json:"previewUrl"`
	PreviewWidth   int    `codec:"previewWidth" json:"previewWidth"`
	PreviewHeight  int    `codec:"previewHeight" json:"previewHeight"`
	PreviewIsVideo bool   `codec:"previewIsVideo" json:"previewIsVideo"`
}

func (o GiphySearchResult) DeepCopy() GiphySearchResult {
	return GiphySearchResult{
		TargetUrl:      o.TargetUrl,
		PreviewUrl:     o.PreviewUrl,
		PreviewWidth:   o.PreviewWidth,
		PreviewHeight:  o.PreviewHeight,
		PreviewIsVideo: o.PreviewIsVideo,
	}
}

type GiphySearchResults struct {
	Results    []GiphySearchResult `codec:"results" json:"results"`
	GalleryUrl string              `codec:"galleryUrl" json:"galleryUrl"`
}

func (o GiphySearchResults) DeepCopy() GiphySearchResults {
	return GiphySearchResults{
		Results: (func(x []GiphySearchResult) []GiphySearchResult {
			if x == nil {
				return nil
			}
			ret := make([]GiphySearchResult, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Results),
		GalleryUrl: o.GalleryUrl,
	}
}

type UICoinFlipPhase int

const (
	UICoinFlipPhase_COMMITMENT UICoinFlipPhase = 0
	UICoinFlipPhase_REVEALS    UICoinFlipPhase = 1
	UICoinFlipPhase_COMPLETE   UICoinFlipPhase = 2
	UICoinFlipPhase_ERROR      UICoinFlipPhase = 3
)

func (o UICoinFlipPhase) DeepCopy() UICoinFlipPhase { return o }

var UICoinFlipPhaseMap = map[string]UICoinFlipPhase{
	"COMMITMENT": 0,
	"REVEALS":    1,
	"COMPLETE":   2,
	"ERROR":      3,
}

var UICoinFlipPhaseRevMap = map[UICoinFlipPhase]string{
	0: "COMMITMENT",
	1: "REVEALS",
	2: "COMPLETE",
	3: "ERROR",
}

func (e UICoinFlipPhase) String() string {
	if v, ok := UICoinFlipPhaseRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UICoinFlipErrorParticipant struct {
	User   string `codec:"user" json:"user"`
	Device string `codec:"device" json:"device"`
}

func (o UICoinFlipErrorParticipant) DeepCopy() UICoinFlipErrorParticipant {
	return UICoinFlipErrorParticipant{
		User:   o.User,
		Device: o.Device,
	}
}

type UICoinFlipAbsenteeError struct {
	Absentees []UICoinFlipErrorParticipant `codec:"absentees" json:"absentees"`
}

func (o UICoinFlipAbsenteeError) DeepCopy() UICoinFlipAbsenteeError {
	return UICoinFlipAbsenteeError{
		Absentees: (func(x []UICoinFlipErrorParticipant) []UICoinFlipErrorParticipant {
			if x == nil {
				return nil
			}
			ret := make([]UICoinFlipErrorParticipant, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Absentees),
	}
}

type UICoinFlipErrorTyp int

const (
	UICoinFlipErrorTyp_GENERIC           UICoinFlipErrorTyp = 0
	UICoinFlipErrorTyp_ABSENTEE          UICoinFlipErrorTyp = 1
	UICoinFlipErrorTyp_TIMEOUT           UICoinFlipErrorTyp = 2
	UICoinFlipErrorTyp_ABORTED           UICoinFlipErrorTyp = 3
	UICoinFlipErrorTyp_DUPREG            UICoinFlipErrorTyp = 4
	UICoinFlipErrorTyp_DUPCOMMITCOMPLETE UICoinFlipErrorTyp = 5
	UICoinFlipErrorTyp_DUPREVEAL         UICoinFlipErrorTyp = 6
	UICoinFlipErrorTyp_COMMITMISMATCH    UICoinFlipErrorTyp = 7
)

func (o UICoinFlipErrorTyp) DeepCopy() UICoinFlipErrorTyp { return o }

var UICoinFlipErrorTypMap = map[string]UICoinFlipErrorTyp{
	"GENERIC":           0,
	"ABSENTEE":          1,
	"TIMEOUT":           2,
	"ABORTED":           3,
	"DUPREG":            4,
	"DUPCOMMITCOMPLETE": 5,
	"DUPREVEAL":         6,
	"COMMITMISMATCH":    7,
}

var UICoinFlipErrorTypRevMap = map[UICoinFlipErrorTyp]string{
	0: "GENERIC",
	1: "ABSENTEE",
	2: "TIMEOUT",
	3: "ABORTED",
	4: "DUPREG",
	5: "DUPCOMMITCOMPLETE",
	6: "DUPREVEAL",
	7: "COMMITMISMATCH",
}

func (e UICoinFlipErrorTyp) String() string {
	if v, ok := UICoinFlipErrorTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UICoinFlipError struct {
	Typ__               UICoinFlipErrorTyp          `codec:"typ" json:"typ"`
	Generic__           *string                     `codec:"generic,omitempty" json:"generic,omitempty"`
	Absentee__          *UICoinFlipAbsenteeError    `codec:"absentee,omitempty" json:"absentee,omitempty"`
	Dupreg__            *UICoinFlipErrorParticipant `codec:"dupreg,omitempty" json:"dupreg,omitempty"`
	Dupcommitcomplete__ *UICoinFlipErrorParticipant `codec:"dupcommitcomplete,omitempty" json:"dupcommitcomplete,omitempty"`
	Dupreveal__         *UICoinFlipErrorParticipant `codec:"dupreveal,omitempty" json:"dupreveal,omitempty"`
	Commitmismatch__    *UICoinFlipErrorParticipant `codec:"commitmismatch,omitempty" json:"commitmismatch,omitempty"`
}

func (o *UICoinFlipError) Typ() (ret UICoinFlipErrorTyp, err error) {
	switch o.Typ__ {
	case UICoinFlipErrorTyp_GENERIC:
		if o.Generic__ == nil {
			err = errors.New("unexpected nil value for Generic__")
			return ret, err
		}
	case UICoinFlipErrorTyp_ABSENTEE:
		if o.Absentee__ == nil {
			err = errors.New("unexpected nil value for Absentee__")
			return ret, err
		}
	case UICoinFlipErrorTyp_DUPREG:
		if o.Dupreg__ == nil {
			err = errors.New("unexpected nil value for Dupreg__")
			return ret, err
		}
	case UICoinFlipErrorTyp_DUPCOMMITCOMPLETE:
		if o.Dupcommitcomplete__ == nil {
			err = errors.New("unexpected nil value for Dupcommitcomplete__")
			return ret, err
		}
	case UICoinFlipErrorTyp_DUPREVEAL:
		if o.Dupreveal__ == nil {
			err = errors.New("unexpected nil value for Dupreveal__")
			return ret, err
		}
	case UICoinFlipErrorTyp_COMMITMISMATCH:
		if o.Commitmismatch__ == nil {
			err = errors.New("unexpected nil value for Commitmismatch__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o UICoinFlipError) Generic() (res string) {
	if o.Typ__ != UICoinFlipErrorTyp_GENERIC {
		panic("wrong case accessed")
	}
	if o.Generic__ == nil {
		return
	}
	return *o.Generic__
}

func (o UICoinFlipError) Absentee() (res UICoinFlipAbsenteeError) {
	if o.Typ__ != UICoinFlipErrorTyp_ABSENTEE {
		panic("wrong case accessed")
	}
	if o.Absentee__ == nil {
		return
	}
	return *o.Absentee__
}

func (o UICoinFlipError) Dupreg() (res UICoinFlipErrorParticipant) {
	if o.Typ__ != UICoinFlipErrorTyp_DUPREG {
		panic("wrong case accessed")
	}
	if o.Dupreg__ == nil {
		return
	}
	return *o.Dupreg__
}

func (o UICoinFlipError) Dupcommitcomplete() (res UICoinFlipErrorParticipant) {
	if o.Typ__ != UICoinFlipErrorTyp_DUPCOMMITCOMPLETE {
		panic("wrong case accessed")
	}
	if o.Dupcommitcomplete__ == nil {
		return
	}
	return *o.Dupcommitcomplete__
}

func (o UICoinFlipError) Dupreveal() (res UICoinFlipErrorParticipant) {
	if o.Typ__ != UICoinFlipErrorTyp_DUPREVEAL {
		panic("wrong case accessed")
	}
	if o.Dupreveal__ == nil {
		return
	}
	return *o.Dupreveal__
}

func (o UICoinFlipError) Commitmismatch() (res UICoinFlipErrorParticipant) {
	if o.Typ__ != UICoinFlipErrorTyp_COMMITMISMATCH {
		panic("wrong case accessed")
	}
	if o.Commitmismatch__ == nil {
		return
	}
	return *o.Commitmismatch__
}

func NewUICoinFlipErrorWithGeneric(v string) UICoinFlipError {
	return UICoinFlipError{
		Typ__:     UICoinFlipErrorTyp_GENERIC,
		Generic__: &v,
	}
}

func NewUICoinFlipErrorWithAbsentee(v UICoinFlipAbsenteeError) UICoinFlipError {
	return UICoinFlipError{
		Typ__:      UICoinFlipErrorTyp_ABSENTEE,
		Absentee__: &v,
	}
}

func NewUICoinFlipErrorWithTimeout() UICoinFlipError {
	return UICoinFlipError{
		Typ__: UICoinFlipErrorTyp_TIMEOUT,
	}
}

func NewUICoinFlipErrorWithAborted() UICoinFlipError {
	return UICoinFlipError{
		Typ__: UICoinFlipErrorTyp_ABORTED,
	}
}

func NewUICoinFlipErrorWithDupreg(v UICoinFlipErrorParticipant) UICoinFlipError {
	return UICoinFlipError{
		Typ__:    UICoinFlipErrorTyp_DUPREG,
		Dupreg__: &v,
	}
}

func NewUICoinFlipErrorWithDupcommitcomplete(v UICoinFlipErrorParticipant) UICoinFlipError {
	return UICoinFlipError{
		Typ__:               UICoinFlipErrorTyp_DUPCOMMITCOMPLETE,
		Dupcommitcomplete__: &v,
	}
}

func NewUICoinFlipErrorWithDupreveal(v UICoinFlipErrorParticipant) UICoinFlipError {
	return UICoinFlipError{
		Typ__:       UICoinFlipErrorTyp_DUPREVEAL,
		Dupreveal__: &v,
	}
}

func NewUICoinFlipErrorWithCommitmismatch(v UICoinFlipErrorParticipant) UICoinFlipError {
	return UICoinFlipError{
		Typ__:            UICoinFlipErrorTyp_COMMITMISMATCH,
		Commitmismatch__: &v,
	}
}

func (o UICoinFlipError) DeepCopy() UICoinFlipError {
	return UICoinFlipError{
		Typ__: o.Typ__.DeepCopy(),
		Generic__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Generic__),
		Absentee__: (func(x *UICoinFlipAbsenteeError) *UICoinFlipAbsenteeError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Absentee__),
		Dupreg__: (func(x *UICoinFlipErrorParticipant) *UICoinFlipErrorParticipant {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Dupreg__),
		Dupcommitcomplete__: (func(x *UICoinFlipErrorParticipant) *UICoinFlipErrorParticipant {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Dupcommitcomplete__),
		Dupreveal__: (func(x *UICoinFlipErrorParticipant) *UICoinFlipErrorParticipant {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Dupreveal__),
		Commitmismatch__: (func(x *UICoinFlipErrorParticipant) *UICoinFlipErrorParticipant {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Commitmismatch__),
	}
}

type UICoinFlipResultTyp int

const (
	UICoinFlipResultTyp_NUMBER  UICoinFlipResultTyp = 0
	UICoinFlipResultTyp_SHUFFLE UICoinFlipResultTyp = 1
	UICoinFlipResultTyp_DECK    UICoinFlipResultTyp = 2
	UICoinFlipResultTyp_HANDS   UICoinFlipResultTyp = 3
	UICoinFlipResultTyp_COIN    UICoinFlipResultTyp = 4
)

func (o UICoinFlipResultTyp) DeepCopy() UICoinFlipResultTyp { return o }

var UICoinFlipResultTypMap = map[string]UICoinFlipResultTyp{
	"NUMBER":  0,
	"SHUFFLE": 1,
	"DECK":    2,
	"HANDS":   3,
	"COIN":    4,
}

var UICoinFlipResultTypRevMap = map[UICoinFlipResultTyp]string{
	0: "NUMBER",
	1: "SHUFFLE",
	2: "DECK",
	3: "HANDS",
	4: "COIN",
}

func (e UICoinFlipResultTyp) String() string {
	if v, ok := UICoinFlipResultTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UICoinFlipHand struct {
	Target string `codec:"target" json:"target"`
	Hand   []int  `codec:"hand" json:"hand"`
}

func (o UICoinFlipHand) DeepCopy() UICoinFlipHand {
	return UICoinFlipHand{
		Target: o.Target,
		Hand: (func(x []int) []int {
			if x == nil {
				return nil
			}
			ret := make([]int, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Hand),
	}
}

type UICoinFlipResult struct {
	Typ__     UICoinFlipResultTyp `codec:"typ" json:"typ"`
	Number__  *string             `codec:"number,omitempty" json:"number,omitempty"`
	Shuffle__ *[]string           `codec:"shuffle,omitempty" json:"shuffle,omitempty"`
	Deck__    *[]int              `codec:"deck,omitempty" json:"deck,omitempty"`
	Hands__   *[]UICoinFlipHand   `codec:"hands,omitempty" json:"hands,omitempty"`
	Coin__    *bool               `codec:"coin,omitempty" json:"coin,omitempty"`
}

func (o *UICoinFlipResult) Typ() (ret UICoinFlipResultTyp, err error) {
	switch o.Typ__ {
	case UICoinFlipResultTyp_NUMBER:
		if o.Number__ == nil {
			err = errors.New("unexpected nil value for Number__")
			return ret, err
		}
	case UICoinFlipResultTyp_SHUFFLE:
		if o.Shuffle__ == nil {
			err = errors.New("unexpected nil value for Shuffle__")
			return ret, err
		}
	case UICoinFlipResultTyp_DECK:
		if o.Deck__ == nil {
			err = errors.New("unexpected nil value for Deck__")
			return ret, err
		}
	case UICoinFlipResultTyp_HANDS:
		if o.Hands__ == nil {
			err = errors.New("unexpected nil value for Hands__")
			return ret, err
		}
	case UICoinFlipResultTyp_COIN:
		if o.Coin__ == nil {
			err = errors.New("unexpected nil value for Coin__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o UICoinFlipResult) Number() (res string) {
	if o.Typ__ != UICoinFlipResultTyp_NUMBER {
		panic("wrong case accessed")
	}
	if o.Number__ == nil {
		return
	}
	return *o.Number__
}

func (o UICoinFlipResult) Shuffle() (res []string) {
	if o.Typ__ != UICoinFlipResultTyp_SHUFFLE {
		panic("wrong case accessed")
	}
	if o.Shuffle__ == nil {
		return
	}
	return *o.Shuffle__
}

func (o UICoinFlipResult) Deck() (res []int) {
	if o.Typ__ != UICoinFlipResultTyp_DECK {
		panic("wrong case accessed")
	}
	if o.Deck__ == nil {
		return
	}
	return *o.Deck__
}

func (o UICoinFlipResult) Hands() (res []UICoinFlipHand) {
	if o.Typ__ != UICoinFlipResultTyp_HANDS {
		panic("wrong case accessed")
	}
	if o.Hands__ == nil {
		return
	}
	return *o.Hands__
}

func (o UICoinFlipResult) Coin() (res bool) {
	if o.Typ__ != UICoinFlipResultTyp_COIN {
		panic("wrong case accessed")
	}
	if o.Coin__ == nil {
		return
	}
	return *o.Coin__
}

func NewUICoinFlipResultWithNumber(v string) UICoinFlipResult {
	return UICoinFlipResult{
		Typ__:    UICoinFlipResultTyp_NUMBER,
		Number__: &v,
	}
}

func NewUICoinFlipResultWithShuffle(v []string) UICoinFlipResult {
	return UICoinFlipResult{
		Typ__:     UICoinFlipResultTyp_SHUFFLE,
		Shuffle__: &v,
	}
}

func NewUICoinFlipResultWithDeck(v []int) UICoinFlipResult {
	return UICoinFlipResult{
		Typ__:  UICoinFlipResultTyp_DECK,
		Deck__: &v,
	}
}

func NewUICoinFlipResultWithHands(v []UICoinFlipHand) UICoinFlipResult {
	return UICoinFlipResult{
		Typ__:   UICoinFlipResultTyp_HANDS,
		Hands__: &v,
	}
}

func NewUICoinFlipResultWithCoin(v bool) UICoinFlipResult {
	return UICoinFlipResult{
		Typ__:  UICoinFlipResultTyp_COIN,
		Coin__: &v,
	}
}

func (o UICoinFlipResult) DeepCopy() UICoinFlipResult {
	return UICoinFlipResult{
		Typ__: o.Typ__.DeepCopy(),
		Number__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Number__),
		Shuffle__: (func(x *[]string) *[]string {
			if x == nil {
				return nil
			}
			tmp := (func(x []string) []string {
				if x == nil {
					return nil
				}
				ret := make([]string, len(x))
				for i, v := range x {
					vCopy := v
					ret[i] = vCopy
				}
				return ret
			})((*x))
			return &tmp
		})(o.Shuffle__),
		Deck__: (func(x *[]int) *[]int {
			if x == nil {
				return nil
			}
			tmp := (func(x []int) []int {
				if x == nil {
					return nil
				}
				ret := make([]int, len(x))
				for i, v := range x {
					vCopy := v
					ret[i] = vCopy
				}
				return ret
			})((*x))
			return &tmp
		})(o.Deck__),
		Hands__: (func(x *[]UICoinFlipHand) *[]UICoinFlipHand {
			if x == nil {
				return nil
			}
			tmp := (func(x []UICoinFlipHand) []UICoinFlipHand {
				if x == nil {
					return nil
				}
				ret := make([]UICoinFlipHand, len(x))
				for i, v := range x {
					vCopy := v.DeepCopy()
					ret[i] = vCopy
				}
				return ret
			})((*x))
			return &tmp
		})(o.Hands__),
		Coin__: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Coin__),
	}
}

type UICoinFlipParticipant struct {
	Uid        string  `codec:"uid" json:"uid"`
	DeviceID   string  `codec:"deviceID" json:"deviceID"`
	Username   string  `codec:"username" json:"username"`
	DeviceName string  `codec:"deviceName" json:"deviceName"`
	Commitment string  `codec:"commitment" json:"commitment"`
	Reveal     *string `codec:"reveal,omitempty" json:"reveal,omitempty"`
}

func (o UICoinFlipParticipant) DeepCopy() UICoinFlipParticipant {
	return UICoinFlipParticipant{
		Uid:        o.Uid,
		DeviceID:   o.DeviceID,
		Username:   o.Username,
		DeviceName: o.DeviceName,
		Commitment: o.Commitment,
		Reveal: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Reveal),
	}
}

type UICoinFlipStatus struct {
	GameID                  FlipGameIDStr           `codec:"gameID" json:"gameID"`
	Phase                   UICoinFlipPhase         `codec:"phase" json:"phase"`
	ProgressText            string                  `codec:"progressText" json:"progressText"`
	ResultText              string                  `codec:"resultText" json:"resultText"`
	CommitmentVisualization string                  `codec:"commitmentVisualization" json:"commitmentVisualization"`
	RevealVisualization     string                  `codec:"revealVisualization" json:"revealVisualization"`
	Participants            []UICoinFlipParticipant `codec:"participants" json:"participants"`
	ErrorInfo               *UICoinFlipError        `codec:"errorInfo,omitempty" json:"errorInfo,omitempty"`
	ResultInfo              *UICoinFlipResult       `codec:"resultInfo,omitempty" json:"resultInfo,omitempty"`
}

func (o UICoinFlipStatus) DeepCopy() UICoinFlipStatus {
	return UICoinFlipStatus{
		GameID:                  o.GameID.DeepCopy(),
		Phase:                   o.Phase.DeepCopy(),
		ProgressText:            o.ProgressText,
		ResultText:              o.ResultText,
		CommitmentVisualization: o.CommitmentVisualization,
		RevealVisualization:     o.RevealVisualization,
		Participants: (func(x []UICoinFlipParticipant) []UICoinFlipParticipant {
			if x == nil {
				return nil
			}
			ret := make([]UICoinFlipParticipant, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Participants),
		ErrorInfo: (func(x *UICoinFlipError) *UICoinFlipError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ErrorInfo),
		ResultInfo: (func(x *UICoinFlipResult) *UICoinFlipResult {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ResultInfo),
	}
}

type UICommandMarkdown struct {
	Body  string  `codec:"body" json:"body"`
	Title *string `codec:"title,omitempty" json:"title,omitempty"`
}

func (o UICommandMarkdown) DeepCopy() UICommandMarkdown {
	return UICommandMarkdown{
		Body: o.Body,
		Title: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Title),
	}
}

type LocationWatchID uint64

func (o LocationWatchID) DeepCopy() LocationWatchID {
	return o
}

type UIWatchPositionPerm int

const (
	UIWatchPositionPerm_BASE   UIWatchPositionPerm = 0
	UIWatchPositionPerm_ALWAYS UIWatchPositionPerm = 1
)

func (o UIWatchPositionPerm) DeepCopy() UIWatchPositionPerm { return o }

var UIWatchPositionPermMap = map[string]UIWatchPositionPerm{
	"BASE":   0,
	"ALWAYS": 1,
}

var UIWatchPositionPermRevMap = map[UIWatchPositionPerm]string{
	0: "BASE",
	1: "ALWAYS",
}

func (e UIWatchPositionPerm) String() string {
	if v, ok := UIWatchPositionPermRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UICommandStatusDisplayTyp int

const (
	UICommandStatusDisplayTyp_STATUS  UICommandStatusDisplayTyp = 0
	UICommandStatusDisplayTyp_WARNING UICommandStatusDisplayTyp = 1
	UICommandStatusDisplayTyp_ERROR   UICommandStatusDisplayTyp = 2
)

func (o UICommandStatusDisplayTyp) DeepCopy() UICommandStatusDisplayTyp { return o }

var UICommandStatusDisplayTypMap = map[string]UICommandStatusDisplayTyp{
	"STATUS":  0,
	"WARNING": 1,
	"ERROR":   2,
}

var UICommandStatusDisplayTypRevMap = map[UICommandStatusDisplayTyp]string{
	0: "STATUS",
	1: "WARNING",
	2: "ERROR",
}

func (e UICommandStatusDisplayTyp) String() string {
	if v, ok := UICommandStatusDisplayTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UICommandStatusActionTyp int

const (
	UICommandStatusActionTyp_APPSETTINGS UICommandStatusActionTyp = 0
)

func (o UICommandStatusActionTyp) DeepCopy() UICommandStatusActionTyp { return o }

var UICommandStatusActionTypMap = map[string]UICommandStatusActionTyp{
	"APPSETTINGS": 0,
}

var UICommandStatusActionTypRevMap = map[UICommandStatusActionTyp]string{
	0: "APPSETTINGS",
}

func (e UICommandStatusActionTyp) String() string {
	if v, ok := UICommandStatusActionTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIBotCommandsUpdateStatusTyp int

const (
	UIBotCommandsUpdateStatusTyp_UPTODATE UIBotCommandsUpdateStatusTyp = 0
	UIBotCommandsUpdateStatusTyp_UPDATING UIBotCommandsUpdateStatusTyp = 1
	UIBotCommandsUpdateStatusTyp_FAILED   UIBotCommandsUpdateStatusTyp = 2
	UIBotCommandsUpdateStatusTyp_BLANK    UIBotCommandsUpdateStatusTyp = 3
)

func (o UIBotCommandsUpdateStatusTyp) DeepCopy() UIBotCommandsUpdateStatusTyp { return o }

var UIBotCommandsUpdateStatusTypMap = map[string]UIBotCommandsUpdateStatusTyp{
	"UPTODATE": 0,
	"UPDATING": 1,
	"FAILED":   2,
	"BLANK":    3,
}

var UIBotCommandsUpdateStatusTypRevMap = map[UIBotCommandsUpdateStatusTyp]string{
	0: "UPTODATE",
	1: "UPDATING",
	2: "FAILED",
	3: "BLANK",
}

func (e UIBotCommandsUpdateStatusTyp) String() string {
	if v, ok := UIBotCommandsUpdateStatusTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UIBotCommandsUpdateSettings struct {
	Settings map[string]keybase1.TeamBotSettings `codec:"settings" json:"settings"`
}

func (o UIBotCommandsUpdateSettings) DeepCopy() UIBotCommandsUpdateSettings {
	return UIBotCommandsUpdateSettings{
		Settings: (func(x map[string]keybase1.TeamBotSettings) map[string]keybase1.TeamBotSettings {
			if x == nil {
				return nil
			}
			ret := make(map[string]keybase1.TeamBotSettings, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Settings),
	}
}

type UIBotCommandsUpdateStatus struct {
	Typ__      UIBotCommandsUpdateStatusTyp `codec:"typ" json:"typ"`
	Uptodate__ *UIBotCommandsUpdateSettings `codec:"uptodate,omitempty" json:"uptodate,omitempty"`
}

func (o *UIBotCommandsUpdateStatus) Typ() (ret UIBotCommandsUpdateStatusTyp, err error) {
	switch o.Typ__ {
	case UIBotCommandsUpdateStatusTyp_UPTODATE:
		if o.Uptodate__ == nil {
			err = errors.New("unexpected nil value for Uptodate__")
			return ret, err
		}
	}
	return o.Typ__, nil
}

func (o UIBotCommandsUpdateStatus) Uptodate() (res UIBotCommandsUpdateSettings) {
	if o.Typ__ != UIBotCommandsUpdateStatusTyp_UPTODATE {
		panic("wrong case accessed")
	}
	if o.Uptodate__ == nil {
		return
	}
	return *o.Uptodate__
}

func NewUIBotCommandsUpdateStatusWithUptodate(v UIBotCommandsUpdateSettings) UIBotCommandsUpdateStatus {
	return UIBotCommandsUpdateStatus{
		Typ__:      UIBotCommandsUpdateStatusTyp_UPTODATE,
		Uptodate__: &v,
	}
}

func NewUIBotCommandsUpdateStatusWithUpdating() UIBotCommandsUpdateStatus {
	return UIBotCommandsUpdateStatus{
		Typ__: UIBotCommandsUpdateStatusTyp_UPDATING,
	}
}

func NewUIBotCommandsUpdateStatusWithFailed() UIBotCommandsUpdateStatus {
	return UIBotCommandsUpdateStatus{
		Typ__: UIBotCommandsUpdateStatusTyp_FAILED,
	}
}

func NewUIBotCommandsUpdateStatusWithBlank() UIBotCommandsUpdateStatus {
	return UIBotCommandsUpdateStatus{
		Typ__: UIBotCommandsUpdateStatusTyp_BLANK,
	}
}

func (o UIBotCommandsUpdateStatus) DeepCopy() UIBotCommandsUpdateStatus {
	return UIBotCommandsUpdateStatus{
		Typ__: o.Typ__.DeepCopy(),
		Uptodate__: (func(x *UIBotCommandsUpdateSettings) *UIBotCommandsUpdateSettings {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Uptodate__),
	}
}
