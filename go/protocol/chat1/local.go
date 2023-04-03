// Auto-generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/local.avdl

package chat1

import (
	"errors"
	"fmt"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type VersionKind string

func (o VersionKind) DeepCopy() VersionKind {
	return o
}

type TextPaymentResultTyp int

const (
	TextPaymentResultTyp_SENT  TextPaymentResultTyp = 0
	TextPaymentResultTyp_ERROR TextPaymentResultTyp = 1
)

func (o TextPaymentResultTyp) DeepCopy() TextPaymentResultTyp { return o }

var TextPaymentResultTypMap = map[string]TextPaymentResultTyp{
	"SENT":  0,
	"ERROR": 1,
}

var TextPaymentResultTypRevMap = map[TextPaymentResultTyp]string{
	0: "SENT",
	1: "ERROR",
}

func (e TextPaymentResultTyp) String() string {
	if v, ok := TextPaymentResultTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type TextPaymentResult struct {
	ResultTyp__ TextPaymentResultTyp `codec:"resultTyp" json:"resultTyp"`
	Error__     *string              `codec:"error,omitempty" json:"error,omitempty"`
	Sent__      *stellar1.PaymentID  `codec:"sent,omitempty" json:"sent,omitempty"`
}

func (o *TextPaymentResult) ResultTyp() (ret TextPaymentResultTyp, err error) {
	switch o.ResultTyp__ {
	case TextPaymentResultTyp_ERROR:
		if o.Error__ == nil {
			err = errors.New("unexpected nil value for Error__")
			return ret, err
		}
	case TextPaymentResultTyp_SENT:
		if o.Sent__ == nil {
			err = errors.New("unexpected nil value for Sent__")
			return ret, err
		}
	}
	return o.ResultTyp__, nil
}

func (o TextPaymentResult) Error() (res string) {
	if o.ResultTyp__ != TextPaymentResultTyp_ERROR {
		panic("wrong case accessed")
	}
	if o.Error__ == nil {
		return
	}
	return *o.Error__
}

func (o TextPaymentResult) Sent() (res stellar1.PaymentID) {
	if o.ResultTyp__ != TextPaymentResultTyp_SENT {
		panic("wrong case accessed")
	}
	if o.Sent__ == nil {
		return
	}
	return *o.Sent__
}

func NewTextPaymentResultWithError(v string) TextPaymentResult {
	return TextPaymentResult{
		ResultTyp__: TextPaymentResultTyp_ERROR,
		Error__:     &v,
	}
}

func NewTextPaymentResultWithSent(v stellar1.PaymentID) TextPaymentResult {
	return TextPaymentResult{
		ResultTyp__: TextPaymentResultTyp_SENT,
		Sent__:      &v,
	}
}

func (o TextPaymentResult) DeepCopy() TextPaymentResult {
	return TextPaymentResult{
		ResultTyp__: o.ResultTyp__.DeepCopy(),
		Error__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Error__),
		Sent__: (func(x *stellar1.PaymentID) *stellar1.PaymentID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Sent__),
	}
}

type TextPayment struct {
	Username    string            `codec:"username" json:"username"`
	PaymentText string            `codec:"paymentText" json:"paymentText"`
	Result      TextPaymentResult `codec:"result" json:"result"`
}

func (o TextPayment) DeepCopy() TextPayment {
	return TextPayment{
		Username:    o.Username,
		PaymentText: o.PaymentText,
		Result:      o.Result.DeepCopy(),
	}
}

type KnownUserMention struct {
	Text string      `codec:"text" json:"text"`
	Uid  gregor1.UID `codec:"uid" json:"uid"`
}

func (o KnownUserMention) DeepCopy() KnownUserMention {
	return KnownUserMention{
		Text: o.Text,
		Uid:  o.Uid.DeepCopy(),
	}
}

type KnownTeamMention struct {
	Name    string `codec:"name" json:"name"`
	Channel string `codec:"channel" json:"channel"`
}

func (o KnownTeamMention) DeepCopy() KnownTeamMention {
	return KnownTeamMention{
		Name:    o.Name,
		Channel: o.Channel,
	}
}

type MaybeMention struct {
	Name    string `codec:"name" json:"name"`
	Channel string `codec:"channel" json:"channel"`
}

func (o MaybeMention) DeepCopy() MaybeMention {
	return MaybeMention{
		Name:    o.Name,
		Channel: o.Channel,
	}
}

type Coordinate struct {
	Lat      float64 `codec:"lat" json:"lat"`
	Lon      float64 `codec:"lon" json:"lon"`
	Accuracy float64 `codec:"accuracy" json:"accuracy"`
}

func (o Coordinate) DeepCopy() Coordinate {
	return Coordinate{
		Lat:      o.Lat,
		Lon:      o.Lon,
		Accuracy: o.Accuracy,
	}
}

type LiveLocation struct {
	EndTime gregor1.Time `codec:"endTime" json:"endTime"`
}

func (o LiveLocation) DeepCopy() LiveLocation {
	return LiveLocation{
		EndTime: o.EndTime.DeepCopy(),
	}
}

type MessageText struct {
	Body         string                    `codec:"body" json:"body"`
	Payments     []TextPayment             `codec:"payments" json:"payments"`
	ReplyTo      *MessageID                `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	ReplyToUID   *gregor1.UID              `codec:"replyToUID,omitempty" json:"replyToUID,omitempty"`
	UserMentions []KnownUserMention        `codec:"userMentions" json:"userMentions"`
	TeamMentions []KnownTeamMention        `codec:"teamMentions" json:"teamMentions"`
	LiveLocation *LiveLocation             `codec:"liveLocation,omitempty" json:"liveLocation,omitempty"`
	Emojis       map[string]HarvestedEmoji `codec:"emojis" json:"emojis"`
}

func (o MessageText) DeepCopy() MessageText {
	return MessageText{
		Body: o.Body,
		Payments: (func(x []TextPayment) []TextPayment {
			if x == nil {
				return nil
			}
			ret := make([]TextPayment, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Payments),
		ReplyTo: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyTo),
		ReplyToUID: (func(x *gregor1.UID) *gregor1.UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyToUID),
		UserMentions: (func(x []KnownUserMention) []KnownUserMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownUserMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UserMentions),
		TeamMentions: (func(x []KnownTeamMention) []KnownTeamMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownTeamMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamMentions),
		LiveLocation: (func(x *LiveLocation) *LiveLocation {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.LiveLocation),
		Emojis: (func(x map[string]HarvestedEmoji) map[string]HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make(map[string]HarvestedEmoji, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type MessageConversationMetadata struct {
	ConversationTitle string `codec:"conversationTitle" json:"conversationTitle"`
}

func (o MessageConversationMetadata) DeepCopy() MessageConversationMetadata {
	return MessageConversationMetadata{
		ConversationTitle: o.ConversationTitle,
	}
}

type MessageEdit struct {
	MessageID    MessageID                 `codec:"messageID" json:"messageID"`
	Body         string                    `codec:"body" json:"body"`
	UserMentions []KnownUserMention        `codec:"userMentions" json:"userMentions"`
	TeamMentions []KnownTeamMention        `codec:"teamMentions" json:"teamMentions"`
	Emojis       map[string]HarvestedEmoji `codec:"emojis" json:"emojis"`
}

func (o MessageEdit) DeepCopy() MessageEdit {
	return MessageEdit{
		MessageID: o.MessageID.DeepCopy(),
		Body:      o.Body,
		UserMentions: (func(x []KnownUserMention) []KnownUserMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownUserMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UserMentions),
		TeamMentions: (func(x []KnownTeamMention) []KnownTeamMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownTeamMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamMentions),
		Emojis: (func(x map[string]HarvestedEmoji) map[string]HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make(map[string]HarvestedEmoji, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type MessageDelete struct {
	MessageIDs []MessageID `codec:"messageIDs" json:"messageIDs"`
}

func (o MessageDelete) DeepCopy() MessageDelete {
	return MessageDelete{
		MessageIDs: (func(x []MessageID) []MessageID {
			if x == nil {
				return nil
			}
			ret := make([]MessageID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MessageIDs),
	}
}

type MessageHeadline struct {
	Headline string                    `codec:"headline" json:"headline"`
	Emojis   map[string]HarvestedEmoji `codec:"emojis" json:"emojis"`
}

func (o MessageHeadline) DeepCopy() MessageHeadline {
	return MessageHeadline{
		Headline: o.Headline,
		Emojis: (func(x map[string]HarvestedEmoji) map[string]HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make(map[string]HarvestedEmoji, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type MessageFlip struct {
	Text         string             `codec:"text" json:"text"`
	GameID       FlipGameID         `codec:"gameID" json:"gameID"`
	FlipConvID   ConversationID     `codec:"flipConvID" json:"flipConvID"`
	UserMentions []KnownUserMention `codec:"userMentions" json:"userMentions"`
	TeamMentions []KnownTeamMention `codec:"teamMentions" json:"teamMentions"`
}

func (o MessageFlip) DeepCopy() MessageFlip {
	return MessageFlip{
		Text:       o.Text,
		GameID:     o.GameID.DeepCopy(),
		FlipConvID: o.FlipConvID.DeepCopy(),
		UserMentions: (func(x []KnownUserMention) []KnownUserMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownUserMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UserMentions),
		TeamMentions: (func(x []KnownTeamMention) []KnownTeamMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownTeamMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamMentions),
	}
}

type MessagePin struct {
	MsgID MessageID `codec:"msgID" json:"msgID"`
}

func (o MessagePin) DeepCopy() MessagePin {
	return MessagePin{
		MsgID: o.MsgID.DeepCopy(),
	}
}

type MessageSystemType int

const (
	MessageSystemType_ADDEDTOTEAM       MessageSystemType = 0
	MessageSystemType_INVITEADDEDTOTEAM MessageSystemType = 1
	MessageSystemType_COMPLEXTEAM       MessageSystemType = 2
	MessageSystemType_CREATETEAM        MessageSystemType = 3
	MessageSystemType_GITPUSH           MessageSystemType = 4
	MessageSystemType_CHANGEAVATAR      MessageSystemType = 5
	MessageSystemType_CHANGERETENTION   MessageSystemType = 6
	MessageSystemType_BULKADDTOCONV     MessageSystemType = 7
	MessageSystemType_SBSRESOLVE        MessageSystemType = 8
	MessageSystemType_NEWCHANNEL        MessageSystemType = 9
)

func (o MessageSystemType) DeepCopy() MessageSystemType { return o }

var MessageSystemTypeMap = map[string]MessageSystemType{
	"ADDEDTOTEAM":       0,
	"INVITEADDEDTOTEAM": 1,
	"COMPLEXTEAM":       2,
	"CREATETEAM":        3,
	"GITPUSH":           4,
	"CHANGEAVATAR":      5,
	"CHANGERETENTION":   6,
	"BULKADDTOCONV":     7,
	"SBSRESOLVE":        8,
	"NEWCHANNEL":        9,
}

var MessageSystemTypeRevMap = map[MessageSystemType]string{
	0: "ADDEDTOTEAM",
	1: "INVITEADDEDTOTEAM",
	2: "COMPLEXTEAM",
	3: "CREATETEAM",
	4: "GITPUSH",
	5: "CHANGEAVATAR",
	6: "CHANGERETENTION",
	7: "BULKADDTOCONV",
	8: "SBSRESOLVE",
	9: "NEWCHANNEL",
}

func (e MessageSystemType) String() string {
	if v, ok := MessageSystemTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MessageSystemAddedToTeam struct {
	Team     string            `codec:"team" json:"team"`
	Adder    string            `codec:"adder" json:"adder"`
	Addee    string            `codec:"addee" json:"addee"`
	Role     keybase1.TeamRole `codec:"role" json:"role"`
	BulkAdds []string          `codec:"bulkAdds" json:"bulkAdds"`
}

func (o MessageSystemAddedToTeam) DeepCopy() MessageSystemAddedToTeam {
	return MessageSystemAddedToTeam{
		Team:  o.Team,
		Adder: o.Adder,
		Addee: o.Addee,
		Role:  o.Role.DeepCopy(),
		BulkAdds: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.BulkAdds),
	}
}

type MessageSystemInviteAddedToTeam struct {
	Team       string                      `codec:"team" json:"team"`
	Inviter    string                      `codec:"inviter" json:"inviter"`
	Invitee    string                      `codec:"invitee" json:"invitee"`
	Adder      string                      `codec:"adder" json:"adder"`
	InviteType keybase1.TeamInviteCategory `codec:"inviteType" json:"inviteType"`
	Role       keybase1.TeamRole           `codec:"role" json:"role"`
}

func (o MessageSystemInviteAddedToTeam) DeepCopy() MessageSystemInviteAddedToTeam {
	return MessageSystemInviteAddedToTeam{
		Team:       o.Team,
		Inviter:    o.Inviter,
		Invitee:    o.Invitee,
		Adder:      o.Adder,
		InviteType: o.InviteType.DeepCopy(),
		Role:       o.Role.DeepCopy(),
	}
}

type MessageSystemComplexTeam struct {
	Team string `codec:"team" json:"team"`
}

func (o MessageSystemComplexTeam) DeepCopy() MessageSystemComplexTeam {
	return MessageSystemComplexTeam{
		Team: o.Team,
	}
}

type MessageSystemCreateTeam struct {
	Team    string `codec:"team" json:"team"`
	Creator string `codec:"creator" json:"creator"`
}

func (o MessageSystemCreateTeam) DeepCopy() MessageSystemCreateTeam {
	return MessageSystemCreateTeam{
		Team:    o.Team,
		Creator: o.Creator,
	}
}

type MessageSystemGitPush struct {
	Team             string                    `codec:"team" json:"team"`
	Pusher           string                    `codec:"pusher" json:"pusher"`
	RepoName         string                    `codec:"repoName" json:"repoName"`
	RepoID           keybase1.RepoID           `codec:"repoID" json:"repoID"`
	Refs             []keybase1.GitRefMetadata `codec:"refs" json:"refs"`
	PushType         keybase1.GitPushType      `codec:"pushType" json:"pushType"`
	PreviousRepoName string                    `codec:"previousRepoName" json:"previousRepoName"`
}

func (o MessageSystemGitPush) DeepCopy() MessageSystemGitPush {
	return MessageSystemGitPush{
		Team:     o.Team,
		Pusher:   o.Pusher,
		RepoName: o.RepoName,
		RepoID:   o.RepoID.DeepCopy(),
		Refs: (func(x []keybase1.GitRefMetadata) []keybase1.GitRefMetadata {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.GitRefMetadata, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Refs),
		PushType:         o.PushType.DeepCopy(),
		PreviousRepoName: o.PreviousRepoName,
	}
}

type MessageSystemChangeAvatar struct {
	Team string `codec:"team" json:"team"`
	User string `codec:"user" json:"user"`
}

func (o MessageSystemChangeAvatar) DeepCopy() MessageSystemChangeAvatar {
	return MessageSystemChangeAvatar{
		Team: o.Team,
		User: o.User,
	}
}

type MessageSystemChangeRetention struct {
	IsTeam      bool                    `codec:"isTeam" json:"isTeam"`
	IsInherit   bool                    `codec:"isInherit" json:"isInherit"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
	Policy      RetentionPolicy         `codec:"policy" json:"policy"`
	User        string                  `codec:"user" json:"user"`
}

func (o MessageSystemChangeRetention) DeepCopy() MessageSystemChangeRetention {
	return MessageSystemChangeRetention{
		IsTeam:      o.IsTeam,
		IsInherit:   o.IsInherit,
		MembersType: o.MembersType.DeepCopy(),
		Policy:      o.Policy.DeepCopy(),
		User:        o.User,
	}
}

type MessageSystemBulkAddToConv struct {
	Usernames []string `codec:"usernames" json:"usernames"`
}

func (o MessageSystemBulkAddToConv) DeepCopy() MessageSystemBulkAddToConv {
	return MessageSystemBulkAddToConv{
		Usernames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Usernames),
	}
}

type MessageSystemSbsResolve struct {
	AssertionService  string `codec:"assertionService" json:"assertionService"`
	AssertionUsername string `codec:"assertionUsername" json:"assertionUsername"`
	Prover            string `codec:"prover" json:"prover"`
}

func (o MessageSystemSbsResolve) DeepCopy() MessageSystemSbsResolve {
	return MessageSystemSbsResolve{
		AssertionService:  o.AssertionService,
		AssertionUsername: o.AssertionUsername,
		Prover:            o.Prover,
	}
}

type MessageSystemNewChannel struct {
	Creator        string           `codec:"creator" json:"creator"`
	NameAtCreation string           `codec:"nameAtCreation" json:"nameAtCreation"`
	ConvID         ConversationID   `codec:"convID" json:"convID"`
	ConvIDs        []ConversationID `codec:"convIDs" json:"convIDs"`
}

func (o MessageSystemNewChannel) DeepCopy() MessageSystemNewChannel {
	return MessageSystemNewChannel{
		Creator:        o.Creator,
		NameAtCreation: o.NameAtCreation,
		ConvID:         o.ConvID.DeepCopy(),
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
	}
}

type MessageSystem struct {
	SystemType__        MessageSystemType               `codec:"systemType" json:"systemType"`
	Addedtoteam__       *MessageSystemAddedToTeam       `codec:"addedtoteam,omitempty" json:"addedtoteam,omitempty"`
	Inviteaddedtoteam__ *MessageSystemInviteAddedToTeam `codec:"inviteaddedtoteam,omitempty" json:"inviteaddedtoteam,omitempty"`
	Complexteam__       *MessageSystemComplexTeam       `codec:"complexteam,omitempty" json:"complexteam,omitempty"`
	Createteam__        *MessageSystemCreateTeam        `codec:"createteam,omitempty" json:"createteam,omitempty"`
	Gitpush__           *MessageSystemGitPush           `codec:"gitpush,omitempty" json:"gitpush,omitempty"`
	Changeavatar__      *MessageSystemChangeAvatar      `codec:"changeavatar,omitempty" json:"changeavatar,omitempty"`
	Changeretention__   *MessageSystemChangeRetention   `codec:"changeretention,omitempty" json:"changeretention,omitempty"`
	Bulkaddtoconv__     *MessageSystemBulkAddToConv     `codec:"bulkaddtoconv,omitempty" json:"bulkaddtoconv,omitempty"`
	Sbsresolve__        *MessageSystemSbsResolve        `codec:"sbsresolve,omitempty" json:"sbsresolve,omitempty"`
	Newchannel__        *MessageSystemNewChannel        `codec:"newchannel,omitempty" json:"newchannel,omitempty"`
}

func (o *MessageSystem) SystemType() (ret MessageSystemType, err error) {
	switch o.SystemType__ {
	case MessageSystemType_ADDEDTOTEAM:
		if o.Addedtoteam__ == nil {
			err = errors.New("unexpected nil value for Addedtoteam__")
			return ret, err
		}
	case MessageSystemType_INVITEADDEDTOTEAM:
		if o.Inviteaddedtoteam__ == nil {
			err = errors.New("unexpected nil value for Inviteaddedtoteam__")
			return ret, err
		}
	case MessageSystemType_COMPLEXTEAM:
		if o.Complexteam__ == nil {
			err = errors.New("unexpected nil value for Complexteam__")
			return ret, err
		}
	case MessageSystemType_CREATETEAM:
		if o.Createteam__ == nil {
			err = errors.New("unexpected nil value for Createteam__")
			return ret, err
		}
	case MessageSystemType_GITPUSH:
		if o.Gitpush__ == nil {
			err = errors.New("unexpected nil value for Gitpush__")
			return ret, err
		}
	case MessageSystemType_CHANGEAVATAR:
		if o.Changeavatar__ == nil {
			err = errors.New("unexpected nil value for Changeavatar__")
			return ret, err
		}
	case MessageSystemType_CHANGERETENTION:
		if o.Changeretention__ == nil {
			err = errors.New("unexpected nil value for Changeretention__")
			return ret, err
		}
	case MessageSystemType_BULKADDTOCONV:
		if o.Bulkaddtoconv__ == nil {
			err = errors.New("unexpected nil value for Bulkaddtoconv__")
			return ret, err
		}
	case MessageSystemType_SBSRESOLVE:
		if o.Sbsresolve__ == nil {
			err = errors.New("unexpected nil value for Sbsresolve__")
			return ret, err
		}
	case MessageSystemType_NEWCHANNEL:
		if o.Newchannel__ == nil {
			err = errors.New("unexpected nil value for Newchannel__")
			return ret, err
		}
	}
	return o.SystemType__, nil
}

func (o MessageSystem) Addedtoteam() (res MessageSystemAddedToTeam) {
	if o.SystemType__ != MessageSystemType_ADDEDTOTEAM {
		panic("wrong case accessed")
	}
	if o.Addedtoteam__ == nil {
		return
	}
	return *o.Addedtoteam__
}

func (o MessageSystem) Inviteaddedtoteam() (res MessageSystemInviteAddedToTeam) {
	if o.SystemType__ != MessageSystemType_INVITEADDEDTOTEAM {
		panic("wrong case accessed")
	}
	if o.Inviteaddedtoteam__ == nil {
		return
	}
	return *o.Inviteaddedtoteam__
}

func (o MessageSystem) Complexteam() (res MessageSystemComplexTeam) {
	if o.SystemType__ != MessageSystemType_COMPLEXTEAM {
		panic("wrong case accessed")
	}
	if o.Complexteam__ == nil {
		return
	}
	return *o.Complexteam__
}

func (o MessageSystem) Createteam() (res MessageSystemCreateTeam) {
	if o.SystemType__ != MessageSystemType_CREATETEAM {
		panic("wrong case accessed")
	}
	if o.Createteam__ == nil {
		return
	}
	return *o.Createteam__
}

func (o MessageSystem) Gitpush() (res MessageSystemGitPush) {
	if o.SystemType__ != MessageSystemType_GITPUSH {
		panic("wrong case accessed")
	}
	if o.Gitpush__ == nil {
		return
	}
	return *o.Gitpush__
}

func (o MessageSystem) Changeavatar() (res MessageSystemChangeAvatar) {
	if o.SystemType__ != MessageSystemType_CHANGEAVATAR {
		panic("wrong case accessed")
	}
	if o.Changeavatar__ == nil {
		return
	}
	return *o.Changeavatar__
}

func (o MessageSystem) Changeretention() (res MessageSystemChangeRetention) {
	if o.SystemType__ != MessageSystemType_CHANGERETENTION {
		panic("wrong case accessed")
	}
	if o.Changeretention__ == nil {
		return
	}
	return *o.Changeretention__
}

func (o MessageSystem) Bulkaddtoconv() (res MessageSystemBulkAddToConv) {
	if o.SystemType__ != MessageSystemType_BULKADDTOCONV {
		panic("wrong case accessed")
	}
	if o.Bulkaddtoconv__ == nil {
		return
	}
	return *o.Bulkaddtoconv__
}

func (o MessageSystem) Sbsresolve() (res MessageSystemSbsResolve) {
	if o.SystemType__ != MessageSystemType_SBSRESOLVE {
		panic("wrong case accessed")
	}
	if o.Sbsresolve__ == nil {
		return
	}
	return *o.Sbsresolve__
}

func (o MessageSystem) Newchannel() (res MessageSystemNewChannel) {
	if o.SystemType__ != MessageSystemType_NEWCHANNEL {
		panic("wrong case accessed")
	}
	if o.Newchannel__ == nil {
		return
	}
	return *o.Newchannel__
}

func NewMessageSystemWithAddedtoteam(v MessageSystemAddedToTeam) MessageSystem {
	return MessageSystem{
		SystemType__:  MessageSystemType_ADDEDTOTEAM,
		Addedtoteam__: &v,
	}
}

func NewMessageSystemWithInviteaddedtoteam(v MessageSystemInviteAddedToTeam) MessageSystem {
	return MessageSystem{
		SystemType__:        MessageSystemType_INVITEADDEDTOTEAM,
		Inviteaddedtoteam__: &v,
	}
}

func NewMessageSystemWithComplexteam(v MessageSystemComplexTeam) MessageSystem {
	return MessageSystem{
		SystemType__:  MessageSystemType_COMPLEXTEAM,
		Complexteam__: &v,
	}
}

func NewMessageSystemWithCreateteam(v MessageSystemCreateTeam) MessageSystem {
	return MessageSystem{
		SystemType__: MessageSystemType_CREATETEAM,
		Createteam__: &v,
	}
}

func NewMessageSystemWithGitpush(v MessageSystemGitPush) MessageSystem {
	return MessageSystem{
		SystemType__: MessageSystemType_GITPUSH,
		Gitpush__:    &v,
	}
}

func NewMessageSystemWithChangeavatar(v MessageSystemChangeAvatar) MessageSystem {
	return MessageSystem{
		SystemType__:   MessageSystemType_CHANGEAVATAR,
		Changeavatar__: &v,
	}
}

func NewMessageSystemWithChangeretention(v MessageSystemChangeRetention) MessageSystem {
	return MessageSystem{
		SystemType__:      MessageSystemType_CHANGERETENTION,
		Changeretention__: &v,
	}
}

func NewMessageSystemWithBulkaddtoconv(v MessageSystemBulkAddToConv) MessageSystem {
	return MessageSystem{
		SystemType__:    MessageSystemType_BULKADDTOCONV,
		Bulkaddtoconv__: &v,
	}
}

func NewMessageSystemWithSbsresolve(v MessageSystemSbsResolve) MessageSystem {
	return MessageSystem{
		SystemType__: MessageSystemType_SBSRESOLVE,
		Sbsresolve__: &v,
	}
}

func NewMessageSystemWithNewchannel(v MessageSystemNewChannel) MessageSystem {
	return MessageSystem{
		SystemType__: MessageSystemType_NEWCHANNEL,
		Newchannel__: &v,
	}
}

func (o MessageSystem) DeepCopy() MessageSystem {
	return MessageSystem{
		SystemType__: o.SystemType__.DeepCopy(),
		Addedtoteam__: (func(x *MessageSystemAddedToTeam) *MessageSystemAddedToTeam {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Addedtoteam__),
		Inviteaddedtoteam__: (func(x *MessageSystemInviteAddedToTeam) *MessageSystemInviteAddedToTeam {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Inviteaddedtoteam__),
		Complexteam__: (func(x *MessageSystemComplexTeam) *MessageSystemComplexTeam {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Complexteam__),
		Createteam__: (func(x *MessageSystemCreateTeam) *MessageSystemCreateTeam {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Createteam__),
		Gitpush__: (func(x *MessageSystemGitPush) *MessageSystemGitPush {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Gitpush__),
		Changeavatar__: (func(x *MessageSystemChangeAvatar) *MessageSystemChangeAvatar {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Changeavatar__),
		Changeretention__: (func(x *MessageSystemChangeRetention) *MessageSystemChangeRetention {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Changeretention__),
		Bulkaddtoconv__: (func(x *MessageSystemBulkAddToConv) *MessageSystemBulkAddToConv {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Bulkaddtoconv__),
		Sbsresolve__: (func(x *MessageSystemSbsResolve) *MessageSystemSbsResolve {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Sbsresolve__),
		Newchannel__: (func(x *MessageSystemNewChannel) *MessageSystemNewChannel {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Newchannel__),
	}
}

type MessageDeleteHistory struct {
	Upto MessageID `codec:"upto" json:"upto"`
}

func (o MessageDeleteHistory) DeepCopy() MessageDeleteHistory {
	return MessageDeleteHistory{
		Upto: o.Upto.DeepCopy(),
	}
}

type MessageAttachment struct {
	Object       Asset                     `codec:"object" json:"object"`
	Preview      *Asset                    `codec:"preview,omitempty" json:"preview,omitempty"`
	Previews     []Asset                   `codec:"previews" json:"previews"`
	Metadata     []byte                    `codec:"metadata" json:"metadata"`
	Uploaded     bool                      `codec:"uploaded" json:"uploaded"`
	UserMentions []KnownUserMention        `codec:"userMentions" json:"userMentions"`
	TeamMentions []KnownTeamMention        `codec:"teamMentions" json:"teamMentions"`
	Emojis       map[string]HarvestedEmoji `codec:"emojis" json:"emojis"`
}

func (o MessageAttachment) DeepCopy() MessageAttachment {
	return MessageAttachment{
		Object: o.Object.DeepCopy(),
		Preview: (func(x *Asset) *Asset {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Preview),
		Previews: (func(x []Asset) []Asset {
			if x == nil {
				return nil
			}
			ret := make([]Asset, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Previews),
		Metadata: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Metadata),
		Uploaded: o.Uploaded,
		UserMentions: (func(x []KnownUserMention) []KnownUserMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownUserMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UserMentions),
		TeamMentions: (func(x []KnownTeamMention) []KnownTeamMention {
			if x == nil {
				return nil
			}
			ret := make([]KnownTeamMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamMentions),
		Emojis: (func(x map[string]HarvestedEmoji) map[string]HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make(map[string]HarvestedEmoji, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type MessageAttachmentUploaded struct {
	MessageID MessageID `codec:"messageID" json:"messageID"`
	Object    Asset     `codec:"object" json:"object"`
	Previews  []Asset   `codec:"previews" json:"previews"`
	Metadata  []byte    `codec:"metadata" json:"metadata"`
}

func (o MessageAttachmentUploaded) DeepCopy() MessageAttachmentUploaded {
	return MessageAttachmentUploaded{
		MessageID: o.MessageID.DeepCopy(),
		Object:    o.Object.DeepCopy(),
		Previews: (func(x []Asset) []Asset {
			if x == nil {
				return nil
			}
			ret := make([]Asset, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Previews),
		Metadata: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Metadata),
	}
}

type MessageJoin struct {
	Joiners []string `codec:"joiners" json:"joiners"`
	Leavers []string `codec:"leavers" json:"leavers"`
}

func (o MessageJoin) DeepCopy() MessageJoin {
	return MessageJoin{
		Joiners: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Joiners),
		Leavers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Leavers),
	}
}

type MessageLeave struct {
}

func (o MessageLeave) DeepCopy() MessageLeave {
	return MessageLeave{}
}

type MessageReaction struct {
	MessageID MessageID                 `codec:"m" json:"m"`
	Body      string                    `codec:"b" json:"b"`
	TargetUID *gregor1.UID              `codec:"t,omitempty" json:"t,omitempty"`
	Emojis    map[string]HarvestedEmoji `codec:"e" json:"e"`
}

func (o MessageReaction) DeepCopy() MessageReaction {
	return MessageReaction{
		MessageID: o.MessageID.DeepCopy(),
		Body:      o.Body,
		TargetUID: (func(x *gregor1.UID) *gregor1.UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TargetUID),
		Emojis: (func(x map[string]HarvestedEmoji) map[string]HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make(map[string]HarvestedEmoji, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type MessageSendPayment struct {
	PaymentID stellar1.PaymentID `codec:"paymentID" json:"paymentID"`
}

func (o MessageSendPayment) DeepCopy() MessageSendPayment {
	return MessageSendPayment{
		PaymentID: o.PaymentID.DeepCopy(),
	}
}

type MessageRequestPayment struct {
	RequestID stellar1.KeybaseRequestID `codec:"requestID" json:"requestID"`
	Note      string                    `codec:"note" json:"note"`
}

func (o MessageRequestPayment) DeepCopy() MessageRequestPayment {
	return MessageRequestPayment{
		RequestID: o.RequestID.DeepCopy(),
		Note:      o.Note,
	}
}

type MessageUnfurl struct {
	Unfurl    UnfurlResult `codec:"unfurl" json:"unfurl"`
	MessageID MessageID    `codec:"messageID" json:"messageID"`
}

func (o MessageUnfurl) DeepCopy() MessageUnfurl {
	return MessageUnfurl{
		Unfurl:    o.Unfurl.DeepCopy(),
		MessageID: o.MessageID.DeepCopy(),
	}
}

type MessageBody struct {
	MessageType__        MessageType                  `codec:"messageType" json:"messageType"`
	Text__               *MessageText                 `codec:"text,omitempty" json:"text,omitempty"`
	Attachment__         *MessageAttachment           `codec:"attachment,omitempty" json:"attachment,omitempty"`
	Edit__               *MessageEdit                 `codec:"edit,omitempty" json:"edit,omitempty"`
	Delete__             *MessageDelete               `codec:"delete,omitempty" json:"delete,omitempty"`
	Metadata__           *MessageConversationMetadata `codec:"metadata,omitempty" json:"metadata,omitempty"`
	Headline__           *MessageHeadline             `codec:"headline,omitempty" json:"headline,omitempty"`
	Attachmentuploaded__ *MessageAttachmentUploaded   `codec:"attachmentuploaded,omitempty" json:"attachmentuploaded,omitempty"`
	Join__               *MessageJoin                 `codec:"join,omitempty" json:"join,omitempty"`
	Leave__              *MessageLeave                `codec:"leave,omitempty" json:"leave,omitempty"`
	System__             *MessageSystem               `codec:"system,omitempty" json:"system,omitempty"`
	Deletehistory__      *MessageDeleteHistory        `codec:"deletehistory,omitempty" json:"deletehistory,omitempty"`
	Reaction__           *MessageReaction             `codec:"reaction,omitempty" json:"reaction,omitempty"`
	Sendpayment__        *MessageSendPayment          `codec:"sendpayment,omitempty" json:"sendpayment,omitempty"`
	Requestpayment__     *MessageRequestPayment       `codec:"requestpayment,omitempty" json:"requestpayment,omitempty"`
	Unfurl__             *MessageUnfurl               `codec:"unfurl,omitempty" json:"unfurl,omitempty"`
	Flip__               *MessageFlip                 `codec:"flip,omitempty" json:"flip,omitempty"`
	Pin__                *MessagePin                  `codec:"pin,omitempty" json:"pin,omitempty"`
}

func (o *MessageBody) MessageType() (ret MessageType, err error) {
	switch o.MessageType__ {
	case MessageType_TEXT:
		if o.Text__ == nil {
			err = errors.New("unexpected nil value for Text__")
			return ret, err
		}
	case MessageType_ATTACHMENT:
		if o.Attachment__ == nil {
			err = errors.New("unexpected nil value for Attachment__")
			return ret, err
		}
	case MessageType_EDIT:
		if o.Edit__ == nil {
			err = errors.New("unexpected nil value for Edit__")
			return ret, err
		}
	case MessageType_DELETE:
		if o.Delete__ == nil {
			err = errors.New("unexpected nil value for Delete__")
			return ret, err
		}
	case MessageType_METADATA:
		if o.Metadata__ == nil {
			err = errors.New("unexpected nil value for Metadata__")
			return ret, err
		}
	case MessageType_HEADLINE:
		if o.Headline__ == nil {
			err = errors.New("unexpected nil value for Headline__")
			return ret, err
		}
	case MessageType_ATTACHMENTUPLOADED:
		if o.Attachmentuploaded__ == nil {
			err = errors.New("unexpected nil value for Attachmentuploaded__")
			return ret, err
		}
	case MessageType_JOIN:
		if o.Join__ == nil {
			err = errors.New("unexpected nil value for Join__")
			return ret, err
		}
	case MessageType_LEAVE:
		if o.Leave__ == nil {
			err = errors.New("unexpected nil value for Leave__")
			return ret, err
		}
	case MessageType_SYSTEM:
		if o.System__ == nil {
			err = errors.New("unexpected nil value for System__")
			return ret, err
		}
	case MessageType_DELETEHISTORY:
		if o.Deletehistory__ == nil {
			err = errors.New("unexpected nil value for Deletehistory__")
			return ret, err
		}
	case MessageType_REACTION:
		if o.Reaction__ == nil {
			err = errors.New("unexpected nil value for Reaction__")
			return ret, err
		}
	case MessageType_SENDPAYMENT:
		if o.Sendpayment__ == nil {
			err = errors.New("unexpected nil value for Sendpayment__")
			return ret, err
		}
	case MessageType_REQUESTPAYMENT:
		if o.Requestpayment__ == nil {
			err = errors.New("unexpected nil value for Requestpayment__")
			return ret, err
		}
	case MessageType_UNFURL:
		if o.Unfurl__ == nil {
			err = errors.New("unexpected nil value for Unfurl__")
			return ret, err
		}
	case MessageType_FLIP:
		if o.Flip__ == nil {
			err = errors.New("unexpected nil value for Flip__")
			return ret, err
		}
	case MessageType_PIN:
		if o.Pin__ == nil {
			err = errors.New("unexpected nil value for Pin__")
			return ret, err
		}
	}
	return o.MessageType__, nil
}

func (o MessageBody) Text() (res MessageText) {
	if o.MessageType__ != MessageType_TEXT {
		panic("wrong case accessed")
	}
	if o.Text__ == nil {
		return
	}
	return *o.Text__
}

func (o MessageBody) Attachment() (res MessageAttachment) {
	if o.MessageType__ != MessageType_ATTACHMENT {
		panic("wrong case accessed")
	}
	if o.Attachment__ == nil {
		return
	}
	return *o.Attachment__
}

func (o MessageBody) Edit() (res MessageEdit) {
	if o.MessageType__ != MessageType_EDIT {
		panic("wrong case accessed")
	}
	if o.Edit__ == nil {
		return
	}
	return *o.Edit__
}

func (o MessageBody) Delete() (res MessageDelete) {
	if o.MessageType__ != MessageType_DELETE {
		panic("wrong case accessed")
	}
	if o.Delete__ == nil {
		return
	}
	return *o.Delete__
}

func (o MessageBody) Metadata() (res MessageConversationMetadata) {
	if o.MessageType__ != MessageType_METADATA {
		panic("wrong case accessed")
	}
	if o.Metadata__ == nil {
		return
	}
	return *o.Metadata__
}

func (o MessageBody) Headline() (res MessageHeadline) {
	if o.MessageType__ != MessageType_HEADLINE {
		panic("wrong case accessed")
	}
	if o.Headline__ == nil {
		return
	}
	return *o.Headline__
}

func (o MessageBody) Attachmentuploaded() (res MessageAttachmentUploaded) {
	if o.MessageType__ != MessageType_ATTACHMENTUPLOADED {
		panic("wrong case accessed")
	}
	if o.Attachmentuploaded__ == nil {
		return
	}
	return *o.Attachmentuploaded__
}

func (o MessageBody) Join() (res MessageJoin) {
	if o.MessageType__ != MessageType_JOIN {
		panic("wrong case accessed")
	}
	if o.Join__ == nil {
		return
	}
	return *o.Join__
}

func (o MessageBody) Leave() (res MessageLeave) {
	if o.MessageType__ != MessageType_LEAVE {
		panic("wrong case accessed")
	}
	if o.Leave__ == nil {
		return
	}
	return *o.Leave__
}

func (o MessageBody) System() (res MessageSystem) {
	if o.MessageType__ != MessageType_SYSTEM {
		panic("wrong case accessed")
	}
	if o.System__ == nil {
		return
	}
	return *o.System__
}

func (o MessageBody) Deletehistory() (res MessageDeleteHistory) {
	if o.MessageType__ != MessageType_DELETEHISTORY {
		panic("wrong case accessed")
	}
	if o.Deletehistory__ == nil {
		return
	}
	return *o.Deletehistory__
}

func (o MessageBody) Reaction() (res MessageReaction) {
	if o.MessageType__ != MessageType_REACTION {
		panic("wrong case accessed")
	}
	if o.Reaction__ == nil {
		return
	}
	return *o.Reaction__
}

func (o MessageBody) Sendpayment() (res MessageSendPayment) {
	if o.MessageType__ != MessageType_SENDPAYMENT {
		panic("wrong case accessed")
	}
	if o.Sendpayment__ == nil {
		return
	}
	return *o.Sendpayment__
}

func (o MessageBody) Requestpayment() (res MessageRequestPayment) {
	if o.MessageType__ != MessageType_REQUESTPAYMENT {
		panic("wrong case accessed")
	}
	if o.Requestpayment__ == nil {
		return
	}
	return *o.Requestpayment__
}

func (o MessageBody) Unfurl() (res MessageUnfurl) {
	if o.MessageType__ != MessageType_UNFURL {
		panic("wrong case accessed")
	}
	if o.Unfurl__ == nil {
		return
	}
	return *o.Unfurl__
}

func (o MessageBody) Flip() (res MessageFlip) {
	if o.MessageType__ != MessageType_FLIP {
		panic("wrong case accessed")
	}
	if o.Flip__ == nil {
		return
	}
	return *o.Flip__
}

func (o MessageBody) Pin() (res MessagePin) {
	if o.MessageType__ != MessageType_PIN {
		panic("wrong case accessed")
	}
	if o.Pin__ == nil {
		return
	}
	return *o.Pin__
}

func NewMessageBodyWithText(v MessageText) MessageBody {
	return MessageBody{
		MessageType__: MessageType_TEXT,
		Text__:        &v,
	}
}

func NewMessageBodyWithAttachment(v MessageAttachment) MessageBody {
	return MessageBody{
		MessageType__: MessageType_ATTACHMENT,
		Attachment__:  &v,
	}
}

func NewMessageBodyWithEdit(v MessageEdit) MessageBody {
	return MessageBody{
		MessageType__: MessageType_EDIT,
		Edit__:        &v,
	}
}

func NewMessageBodyWithDelete(v MessageDelete) MessageBody {
	return MessageBody{
		MessageType__: MessageType_DELETE,
		Delete__:      &v,
	}
}

func NewMessageBodyWithMetadata(v MessageConversationMetadata) MessageBody {
	return MessageBody{
		MessageType__: MessageType_METADATA,
		Metadata__:    &v,
	}
}

func NewMessageBodyWithHeadline(v MessageHeadline) MessageBody {
	return MessageBody{
		MessageType__: MessageType_HEADLINE,
		Headline__:    &v,
	}
}

func NewMessageBodyWithAttachmentuploaded(v MessageAttachmentUploaded) MessageBody {
	return MessageBody{
		MessageType__:        MessageType_ATTACHMENTUPLOADED,
		Attachmentuploaded__: &v,
	}
}

func NewMessageBodyWithJoin(v MessageJoin) MessageBody {
	return MessageBody{
		MessageType__: MessageType_JOIN,
		Join__:        &v,
	}
}

func NewMessageBodyWithLeave(v MessageLeave) MessageBody {
	return MessageBody{
		MessageType__: MessageType_LEAVE,
		Leave__:       &v,
	}
}

func NewMessageBodyWithSystem(v MessageSystem) MessageBody {
	return MessageBody{
		MessageType__: MessageType_SYSTEM,
		System__:      &v,
	}
}

func NewMessageBodyWithDeletehistory(v MessageDeleteHistory) MessageBody {
	return MessageBody{
		MessageType__:   MessageType_DELETEHISTORY,
		Deletehistory__: &v,
	}
}

func NewMessageBodyWithReaction(v MessageReaction) MessageBody {
	return MessageBody{
		MessageType__: MessageType_REACTION,
		Reaction__:    &v,
	}
}

func NewMessageBodyWithSendpayment(v MessageSendPayment) MessageBody {
	return MessageBody{
		MessageType__: MessageType_SENDPAYMENT,
		Sendpayment__: &v,
	}
}

func NewMessageBodyWithRequestpayment(v MessageRequestPayment) MessageBody {
	return MessageBody{
		MessageType__:    MessageType_REQUESTPAYMENT,
		Requestpayment__: &v,
	}
}

func NewMessageBodyWithUnfurl(v MessageUnfurl) MessageBody {
	return MessageBody{
		MessageType__: MessageType_UNFURL,
		Unfurl__:      &v,
	}
}

func NewMessageBodyWithFlip(v MessageFlip) MessageBody {
	return MessageBody{
		MessageType__: MessageType_FLIP,
		Flip__:        &v,
	}
}

func NewMessageBodyWithPin(v MessagePin) MessageBody {
	return MessageBody{
		MessageType__: MessageType_PIN,
		Pin__:         &v,
	}
}

func (o MessageBody) DeepCopy() MessageBody {
	return MessageBody{
		MessageType__: o.MessageType__.DeepCopy(),
		Text__: (func(x *MessageText) *MessageText {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Text__),
		Attachment__: (func(x *MessageAttachment) *MessageAttachment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Attachment__),
		Edit__: (func(x *MessageEdit) *MessageEdit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Edit__),
		Delete__: (func(x *MessageDelete) *MessageDelete {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Delete__),
		Metadata__: (func(x *MessageConversationMetadata) *MessageConversationMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Metadata__),
		Headline__: (func(x *MessageHeadline) *MessageHeadline {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Headline__),
		Attachmentuploaded__: (func(x *MessageAttachmentUploaded) *MessageAttachmentUploaded {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Attachmentuploaded__),
		Join__: (func(x *MessageJoin) *MessageJoin {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Join__),
		Leave__: (func(x *MessageLeave) *MessageLeave {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Leave__),
		System__: (func(x *MessageSystem) *MessageSystem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.System__),
		Deletehistory__: (func(x *MessageDeleteHistory) *MessageDeleteHistory {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Deletehistory__),
		Reaction__: (func(x *MessageReaction) *MessageReaction {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Reaction__),
		Sendpayment__: (func(x *MessageSendPayment) *MessageSendPayment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Sendpayment__),
		Requestpayment__: (func(x *MessageRequestPayment) *MessageRequestPayment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Requestpayment__),
		Unfurl__: (func(x *MessageUnfurl) *MessageUnfurl {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Unfurl__),
		Flip__: (func(x *MessageFlip) *MessageFlip {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Flip__),
		Pin__: (func(x *MessagePin) *MessagePin {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pin__),
	}
}

type SenderPrepareOptions struct {
	SkipTopicNameState bool       `codec:"skipTopicNameState" json:"skipTopicNameState"`
	ReplyTo            *MessageID `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
}

func (o SenderPrepareOptions) DeepCopy() SenderPrepareOptions {
	return SenderPrepareOptions{
		SkipTopicNameState: o.SkipTopicNameState,
		ReplyTo: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyTo),
	}
}

type SenderSendOptions struct {
	JoinMentionsAs *ConversationMemberStatus `codec:"joinMentionsAs,omitempty" json:"joinMentionsAs,omitempty"`
}

func (o SenderSendOptions) DeepCopy() SenderSendOptions {
	return SenderSendOptions{
		JoinMentionsAs: (func(x *ConversationMemberStatus) *ConversationMemberStatus {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.JoinMentionsAs),
	}
}

type OutboxStateType int

const (
	OutboxStateType_SENDING OutboxStateType = 0
	OutboxStateType_ERROR   OutboxStateType = 1
)

func (o OutboxStateType) DeepCopy() OutboxStateType { return o }

var OutboxStateTypeMap = map[string]OutboxStateType{
	"SENDING": 0,
	"ERROR":   1,
}

var OutboxStateTypeRevMap = map[OutboxStateType]string{
	0: "SENDING",
	1: "ERROR",
}

func (e OutboxStateType) String() string {
	if v, ok := OutboxStateTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type OutboxErrorType int

const (
	OutboxErrorType_MISC            OutboxErrorType = 0
	OutboxErrorType_OFFLINE         OutboxErrorType = 1
	OutboxErrorType_IDENTIFY        OutboxErrorType = 2
	OutboxErrorType_TOOLONG         OutboxErrorType = 3
	OutboxErrorType_DUPLICATE       OutboxErrorType = 4
	OutboxErrorType_EXPIRED         OutboxErrorType = 5
	OutboxErrorType_TOOMANYATTEMPTS OutboxErrorType = 6
	OutboxErrorType_ALREADY_DELETED OutboxErrorType = 7
	OutboxErrorType_UPLOADFAILED    OutboxErrorType = 8
	OutboxErrorType_RESTRICTEDBOT   OutboxErrorType = 9
	OutboxErrorType_MINWRITER       OutboxErrorType = 10
)

func (o OutboxErrorType) DeepCopy() OutboxErrorType { return o }

var OutboxErrorTypeMap = map[string]OutboxErrorType{
	"MISC":            0,
	"OFFLINE":         1,
	"IDENTIFY":        2,
	"TOOLONG":         3,
	"DUPLICATE":       4,
	"EXPIRED":         5,
	"TOOMANYATTEMPTS": 6,
	"ALREADY_DELETED": 7,
	"UPLOADFAILED":    8,
	"RESTRICTEDBOT":   9,
	"MINWRITER":       10,
}

var OutboxErrorTypeRevMap = map[OutboxErrorType]string{
	0:  "MISC",
	1:  "OFFLINE",
	2:  "IDENTIFY",
	3:  "TOOLONG",
	4:  "DUPLICATE",
	5:  "EXPIRED",
	6:  "TOOMANYATTEMPTS",
	7:  "ALREADY_DELETED",
	8:  "UPLOADFAILED",
	9:  "RESTRICTEDBOT",
	10: "MINWRITER",
}

func (e OutboxErrorType) String() string {
	if v, ok := OutboxErrorTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type OutboxStateError struct {
	Message string          `codec:"message" json:"message"`
	Typ     OutboxErrorType `codec:"typ" json:"typ"`
}

func (o OutboxStateError) DeepCopy() OutboxStateError {
	return OutboxStateError{
		Message: o.Message,
		Typ:     o.Typ.DeepCopy(),
	}
}

type OutboxState struct {
	State__   OutboxStateType   `codec:"state" json:"state"`
	Sending__ *int              `codec:"sending,omitempty" json:"sending,omitempty"`
	Error__   *OutboxStateError `codec:"error,omitempty" json:"error,omitempty"`
}

func (o *OutboxState) State() (ret OutboxStateType, err error) {
	switch o.State__ {
	case OutboxStateType_SENDING:
		if o.Sending__ == nil {
			err = errors.New("unexpected nil value for Sending__")
			return ret, err
		}
	case OutboxStateType_ERROR:
		if o.Error__ == nil {
			err = errors.New("unexpected nil value for Error__")
			return ret, err
		}
	}
	return o.State__, nil
}

func (o OutboxState) Sending() (res int) {
	if o.State__ != OutboxStateType_SENDING {
		panic("wrong case accessed")
	}
	if o.Sending__ == nil {
		return
	}
	return *o.Sending__
}

func (o OutboxState) Error() (res OutboxStateError) {
	if o.State__ != OutboxStateType_ERROR {
		panic("wrong case accessed")
	}
	if o.Error__ == nil {
		return
	}
	return *o.Error__
}

func NewOutboxStateWithSending(v int) OutboxState {
	return OutboxState{
		State__:   OutboxStateType_SENDING,
		Sending__: &v,
	}
}

func NewOutboxStateWithError(v OutboxStateError) OutboxState {
	return OutboxState{
		State__: OutboxStateType_ERROR,
		Error__: &v,
	}
}

func (o OutboxState) DeepCopy() OutboxState {
	return OutboxState{
		State__: o.State__.DeepCopy(),
		Sending__: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Sending__),
		Error__: (func(x *OutboxStateError) *OutboxStateError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Error__),
	}
}

type OutboxRecord struct {
	State            OutboxState                  `codec:"state" json:"state"`
	OutboxID         OutboxID                     `codec:"outboxID" json:"outboxID"`
	ConvID           ConversationID               `codec:"convID" json:"convID"`
	Ctime            gregor1.Time                 `codec:"ctime" json:"ctime"`
	Msg              MessagePlaintext             `codec:"Msg" json:"Msg"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	PrepareOpts      *SenderPrepareOptions        `codec:"prepareOpts,omitempty" json:"prepareOpts,omitempty"`
	SendOpts         *SenderSendOptions           `codec:"sendOpts,omitempty" json:"sendOpts,omitempty"`
	Ordinal          int                          `codec:"ordinal" json:"ordinal"`
	Preview          *MakePreviewRes              `codec:"preview,omitempty" json:"preview,omitempty"`
	ReplyTo          *MessageUnboxed              `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
}

func (o OutboxRecord) DeepCopy() OutboxRecord {
	return OutboxRecord{
		State:            o.State.DeepCopy(),
		OutboxID:         o.OutboxID.DeepCopy(),
		ConvID:           o.ConvID.DeepCopy(),
		Ctime:            o.Ctime.DeepCopy(),
		Msg:              o.Msg.DeepCopy(),
		IdentifyBehavior: o.IdentifyBehavior.DeepCopy(),
		PrepareOpts: (func(x *SenderPrepareOptions) *SenderPrepareOptions {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PrepareOpts),
		SendOpts: (func(x *SenderSendOptions) *SenderSendOptions {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SendOpts),
		Ordinal: o.Ordinal,
		Preview: (func(x *MakePreviewRes) *MakePreviewRes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Preview),
		ReplyTo: (func(x *MessageUnboxed) *MessageUnboxed {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyTo),
	}
}

type HeaderPlaintextVersion int

const (
	HeaderPlaintextVersion_V1  HeaderPlaintextVersion = 1
	HeaderPlaintextVersion_V2  HeaderPlaintextVersion = 2
	HeaderPlaintextVersion_V3  HeaderPlaintextVersion = 3
	HeaderPlaintextVersion_V4  HeaderPlaintextVersion = 4
	HeaderPlaintextVersion_V5  HeaderPlaintextVersion = 5
	HeaderPlaintextVersion_V6  HeaderPlaintextVersion = 6
	HeaderPlaintextVersion_V7  HeaderPlaintextVersion = 7
	HeaderPlaintextVersion_V8  HeaderPlaintextVersion = 8
	HeaderPlaintextVersion_V9  HeaderPlaintextVersion = 9
	HeaderPlaintextVersion_V10 HeaderPlaintextVersion = 10
)

func (o HeaderPlaintextVersion) DeepCopy() HeaderPlaintextVersion { return o }

var HeaderPlaintextVersionMap = map[string]HeaderPlaintextVersion{
	"V1":  1,
	"V2":  2,
	"V3":  3,
	"V4":  4,
	"V5":  5,
	"V6":  6,
	"V7":  7,
	"V8":  8,
	"V9":  9,
	"V10": 10,
}

var HeaderPlaintextVersionRevMap = map[HeaderPlaintextVersion]string{
	1:  "V1",
	2:  "V2",
	3:  "V3",
	4:  "V4",
	5:  "V5",
	6:  "V6",
	7:  "V7",
	8:  "V8",
	9:  "V9",
	10: "V10",
}

func (e HeaderPlaintextVersion) String() string {
	if v, ok := HeaderPlaintextVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type HeaderPlaintextMetaInfo struct {
	Crit bool `codec:"crit" json:"crit"`
}

func (o HeaderPlaintextMetaInfo) DeepCopy() HeaderPlaintextMetaInfo {
	return HeaderPlaintextMetaInfo{
		Crit: o.Crit,
	}
}

type HeaderPlaintextUnsupported struct {
	Mi HeaderPlaintextMetaInfo `codec:"mi" json:"mi"`
}

func (o HeaderPlaintextUnsupported) DeepCopy() HeaderPlaintextUnsupported {
	return HeaderPlaintextUnsupported{
		Mi: o.Mi.DeepCopy(),
	}
}

type HeaderPlaintextV1 struct {
	Conv              ConversationIDTriple     `codec:"conv" json:"conv"`
	TlfName           string                   `codec:"tlfName" json:"tlfName"`
	TlfPublic         bool                     `codec:"tlfPublic" json:"tlfPublic"`
	MessageType       MessageType              `codec:"messageType" json:"messageType"`
	Prev              []MessagePreviousPointer `codec:"prev" json:"prev"`
	Sender            gregor1.UID              `codec:"sender" json:"sender"`
	SenderDevice      gregor1.DeviceID         `codec:"senderDevice" json:"senderDevice"`
	KbfsCryptKeysUsed *bool                    `codec:"kbfsCryptKeysUsed,omitempty" json:"kbfsCryptKeysUsed,omitempty"`
	BodyHash          Hash                     `codec:"bodyHash" json:"bodyHash"`
	OutboxInfo        *OutboxInfo              `codec:"outboxInfo,omitempty" json:"outboxInfo,omitempty"`
	OutboxID          *OutboxID                `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	HeaderSignature   *SignatureInfo           `codec:"headerSignature,omitempty" json:"headerSignature,omitempty"`
	MerkleRoot        *MerkleRoot              `codec:"merkleRoot,omitempty" json:"merkleRoot,omitempty"`
	EphemeralMetadata *MsgEphemeralMetadata    `codec:"em,omitempty" json:"em,omitempty"`
	BotUID            *gregor1.UID             `codec:"b,omitempty" json:"b,omitempty"`
}

func (o HeaderPlaintextV1) DeepCopy() HeaderPlaintextV1 {
	return HeaderPlaintextV1{
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
		BodyHash: o.BodyHash.DeepCopy(),
		OutboxInfo: (func(x *OutboxInfo) *OutboxInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxInfo),
		OutboxID: (func(x *OutboxID) *OutboxID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxID),
		HeaderSignature: (func(x *SignatureInfo) *SignatureInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.HeaderSignature),
		MerkleRoot: (func(x *MerkleRoot) *MerkleRoot {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MerkleRoot),
		EphemeralMetadata: (func(x *MsgEphemeralMetadata) *MsgEphemeralMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EphemeralMetadata),
		BotUID: (func(x *gregor1.UID) *gregor1.UID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.BotUID),
	}
}

type HeaderPlaintext struct {
	Version__ HeaderPlaintextVersion      `codec:"version" json:"version"`
	V1__      *HeaderPlaintextV1          `codec:"v1,omitempty" json:"v1,omitempty"`
	V2__      *HeaderPlaintextUnsupported `codec:"v2,omitempty" json:"v2,omitempty"`
	V3__      *HeaderPlaintextUnsupported `codec:"v3,omitempty" json:"v3,omitempty"`
	V4__      *HeaderPlaintextUnsupported `codec:"v4,omitempty" json:"v4,omitempty"`
	V5__      *HeaderPlaintextUnsupported `codec:"v5,omitempty" json:"v5,omitempty"`
	V6__      *HeaderPlaintextUnsupported `codec:"v6,omitempty" json:"v6,omitempty"`
	V7__      *HeaderPlaintextUnsupported `codec:"v7,omitempty" json:"v7,omitempty"`
	V8__      *HeaderPlaintextUnsupported `codec:"v8,omitempty" json:"v8,omitempty"`
	V9__      *HeaderPlaintextUnsupported `codec:"v9,omitempty" json:"v9,omitempty"`
	V10__     *HeaderPlaintextUnsupported `codec:"v10,omitempty" json:"v10,omitempty"`
}

func (o *HeaderPlaintext) Version() (ret HeaderPlaintextVersion, err error) {
	switch o.Version__ {
	case HeaderPlaintextVersion_V1:
		if o.V1__ == nil {
			err = errors.New("unexpected nil value for V1__")
			return ret, err
		}
	case HeaderPlaintextVersion_V2:
		if o.V2__ == nil {
			err = errors.New("unexpected nil value for V2__")
			return ret, err
		}
	case HeaderPlaintextVersion_V3:
		if o.V3__ == nil {
			err = errors.New("unexpected nil value for V3__")
			return ret, err
		}
	case HeaderPlaintextVersion_V4:
		if o.V4__ == nil {
			err = errors.New("unexpected nil value for V4__")
			return ret, err
		}
	case HeaderPlaintextVersion_V5:
		if o.V5__ == nil {
			err = errors.New("unexpected nil value for V5__")
			return ret, err
		}
	case HeaderPlaintextVersion_V6:
		if o.V6__ == nil {
			err = errors.New("unexpected nil value for V6__")
			return ret, err
		}
	case HeaderPlaintextVersion_V7:
		if o.V7__ == nil {
			err = errors.New("unexpected nil value for V7__")
			return ret, err
		}
	case HeaderPlaintextVersion_V8:
		if o.V8__ == nil {
			err = errors.New("unexpected nil value for V8__")
			return ret, err
		}
	case HeaderPlaintextVersion_V9:
		if o.V9__ == nil {
			err = errors.New("unexpected nil value for V9__")
			return ret, err
		}
	case HeaderPlaintextVersion_V10:
		if o.V10__ == nil {
			err = errors.New("unexpected nil value for V10__")
			return ret, err
		}
	}
	return o.Version__, nil
}

func (o HeaderPlaintext) V1() (res HeaderPlaintextV1) {
	if o.Version__ != HeaderPlaintextVersion_V1 {
		panic("wrong case accessed")
	}
	if o.V1__ == nil {
		return
	}
	return *o.V1__
}

func (o HeaderPlaintext) V2() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V2 {
		panic("wrong case accessed")
	}
	if o.V2__ == nil {
		return
	}
	return *o.V2__
}

func (o HeaderPlaintext) V3() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V3 {
		panic("wrong case accessed")
	}
	if o.V3__ == nil {
		return
	}
	return *o.V3__
}

func (o HeaderPlaintext) V4() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V4 {
		panic("wrong case accessed")
	}
	if o.V4__ == nil {
		return
	}
	return *o.V4__
}

func (o HeaderPlaintext) V5() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V5 {
		panic("wrong case accessed")
	}
	if o.V5__ == nil {
		return
	}
	return *o.V5__
}

func (o HeaderPlaintext) V6() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V6 {
		panic("wrong case accessed")
	}
	if o.V6__ == nil {
		return
	}
	return *o.V6__
}

func (o HeaderPlaintext) V7() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V7 {
		panic("wrong case accessed")
	}
	if o.V7__ == nil {
		return
	}
	return *o.V7__
}

func (o HeaderPlaintext) V8() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V8 {
		panic("wrong case accessed")
	}
	if o.V8__ == nil {
		return
	}
	return *o.V8__
}

func (o HeaderPlaintext) V9() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V9 {
		panic("wrong case accessed")
	}
	if o.V9__ == nil {
		return
	}
	return *o.V9__
}

func (o HeaderPlaintext) V10() (res HeaderPlaintextUnsupported) {
	if o.Version__ != HeaderPlaintextVersion_V10 {
		panic("wrong case accessed")
	}
	if o.V10__ == nil {
		return
	}
	return *o.V10__
}

func NewHeaderPlaintextWithV1(v HeaderPlaintextV1) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V1,
		V1__:      &v,
	}
}

func NewHeaderPlaintextWithV2(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V2,
		V2__:      &v,
	}
}

func NewHeaderPlaintextWithV3(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V3,
		V3__:      &v,
	}
}

func NewHeaderPlaintextWithV4(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V4,
		V4__:      &v,
	}
}

func NewHeaderPlaintextWithV5(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V5,
		V5__:      &v,
	}
}

func NewHeaderPlaintextWithV6(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V6,
		V6__:      &v,
	}
}

func NewHeaderPlaintextWithV7(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V7,
		V7__:      &v,
	}
}

func NewHeaderPlaintextWithV8(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V8,
		V8__:      &v,
	}
}

func NewHeaderPlaintextWithV9(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V9,
		V9__:      &v,
	}
}

func NewHeaderPlaintextWithV10(v HeaderPlaintextUnsupported) HeaderPlaintext {
	return HeaderPlaintext{
		Version__: HeaderPlaintextVersion_V10,
		V10__:     &v,
	}
}

func (o HeaderPlaintext) DeepCopy() HeaderPlaintext {
	return HeaderPlaintext{
		Version__: o.Version__.DeepCopy(),
		V1__: (func(x *HeaderPlaintextV1) *HeaderPlaintextV1 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V1__),
		V2__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V2__),
		V3__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V3__),
		V4__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V4__),
		V5__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V5__),
		V6__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V6__),
		V7__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V7__),
		V8__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V8__),
		V9__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V9__),
		V10__: (func(x *HeaderPlaintextUnsupported) *HeaderPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V10__),
	}
}

type BodyPlaintextVersion int

const (
	BodyPlaintextVersion_V1  BodyPlaintextVersion = 1
	BodyPlaintextVersion_V2  BodyPlaintextVersion = 2
	BodyPlaintextVersion_V3  BodyPlaintextVersion = 3
	BodyPlaintextVersion_V4  BodyPlaintextVersion = 4
	BodyPlaintextVersion_V5  BodyPlaintextVersion = 5
	BodyPlaintextVersion_V6  BodyPlaintextVersion = 6
	BodyPlaintextVersion_V7  BodyPlaintextVersion = 7
	BodyPlaintextVersion_V8  BodyPlaintextVersion = 8
	BodyPlaintextVersion_V9  BodyPlaintextVersion = 9
	BodyPlaintextVersion_V10 BodyPlaintextVersion = 10
)

func (o BodyPlaintextVersion) DeepCopy() BodyPlaintextVersion { return o }

var BodyPlaintextVersionMap = map[string]BodyPlaintextVersion{
	"V1":  1,
	"V2":  2,
	"V3":  3,
	"V4":  4,
	"V5":  5,
	"V6":  6,
	"V7":  7,
	"V8":  8,
	"V9":  9,
	"V10": 10,
}

var BodyPlaintextVersionRevMap = map[BodyPlaintextVersion]string{
	1:  "V1",
	2:  "V2",
	3:  "V3",
	4:  "V4",
	5:  "V5",
	6:  "V6",
	7:  "V7",
	8:  "V8",
	9:  "V9",
	10: "V10",
}

func (e BodyPlaintextVersion) String() string {
	if v, ok := BodyPlaintextVersionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type BodyPlaintextMetaInfo struct {
	Crit bool `codec:"crit" json:"crit"`
}

func (o BodyPlaintextMetaInfo) DeepCopy() BodyPlaintextMetaInfo {
	return BodyPlaintextMetaInfo{
		Crit: o.Crit,
	}
}

type BodyPlaintextUnsupported struct {
	Mi BodyPlaintextMetaInfo `codec:"mi" json:"mi"`
}

func (o BodyPlaintextUnsupported) DeepCopy() BodyPlaintextUnsupported {
	return BodyPlaintextUnsupported{
		Mi: o.Mi.DeepCopy(),
	}
}

type BodyPlaintextV1 struct {
	MessageBody MessageBody `codec:"messageBody" json:"messageBody"`
}

func (o BodyPlaintextV1) DeepCopy() BodyPlaintextV1 {
	return BodyPlaintextV1{
		MessageBody: o.MessageBody.DeepCopy(),
	}
}

type BodyPlaintextV2 struct {
	MessageBody MessageBody           `codec:"messageBody" json:"messageBody"`
	Mi          BodyPlaintextMetaInfo `codec:"mi" json:"mi"`
}

func (o BodyPlaintextV2) DeepCopy() BodyPlaintextV2 {
	return BodyPlaintextV2{
		MessageBody: o.MessageBody.DeepCopy(),
		Mi:          o.Mi.DeepCopy(),
	}
}

type BodyPlaintext struct {
	Version__ BodyPlaintextVersion      `codec:"version" json:"version"`
	V1__      *BodyPlaintextV1          `codec:"v1,omitempty" json:"v1,omitempty"`
	V2__      *BodyPlaintextV2          `codec:"v2,omitempty" json:"v2,omitempty"`
	V3__      *BodyPlaintextUnsupported `codec:"v3,omitempty" json:"v3,omitempty"`
	V4__      *BodyPlaintextUnsupported `codec:"v4,omitempty" json:"v4,omitempty"`
	V5__      *BodyPlaintextUnsupported `codec:"v5,omitempty" json:"v5,omitempty"`
	V6__      *BodyPlaintextUnsupported `codec:"v6,omitempty" json:"v6,omitempty"`
	V7__      *BodyPlaintextUnsupported `codec:"v7,omitempty" json:"v7,omitempty"`
	V8__      *BodyPlaintextUnsupported `codec:"v8,omitempty" json:"v8,omitempty"`
	V9__      *BodyPlaintextUnsupported `codec:"v9,omitempty" json:"v9,omitempty"`
	V10__     *BodyPlaintextUnsupported `codec:"v10,omitempty" json:"v10,omitempty"`
}

func (o *BodyPlaintext) Version() (ret BodyPlaintextVersion, err error) {
	switch o.Version__ {
	case BodyPlaintextVersion_V1:
		if o.V1__ == nil {
			err = errors.New("unexpected nil value for V1__")
			return ret, err
		}
	case BodyPlaintextVersion_V2:
		if o.V2__ == nil {
			err = errors.New("unexpected nil value for V2__")
			return ret, err
		}
	case BodyPlaintextVersion_V3:
		if o.V3__ == nil {
			err = errors.New("unexpected nil value for V3__")
			return ret, err
		}
	case BodyPlaintextVersion_V4:
		if o.V4__ == nil {
			err = errors.New("unexpected nil value for V4__")
			return ret, err
		}
	case BodyPlaintextVersion_V5:
		if o.V5__ == nil {
			err = errors.New("unexpected nil value for V5__")
			return ret, err
		}
	case BodyPlaintextVersion_V6:
		if o.V6__ == nil {
			err = errors.New("unexpected nil value for V6__")
			return ret, err
		}
	case BodyPlaintextVersion_V7:
		if o.V7__ == nil {
			err = errors.New("unexpected nil value for V7__")
			return ret, err
		}
	case BodyPlaintextVersion_V8:
		if o.V8__ == nil {
			err = errors.New("unexpected nil value for V8__")
			return ret, err
		}
	case BodyPlaintextVersion_V9:
		if o.V9__ == nil {
			err = errors.New("unexpected nil value for V9__")
			return ret, err
		}
	case BodyPlaintextVersion_V10:
		if o.V10__ == nil {
			err = errors.New("unexpected nil value for V10__")
			return ret, err
		}
	}
	return o.Version__, nil
}

func (o BodyPlaintext) V1() (res BodyPlaintextV1) {
	if o.Version__ != BodyPlaintextVersion_V1 {
		panic("wrong case accessed")
	}
	if o.V1__ == nil {
		return
	}
	return *o.V1__
}

func (o BodyPlaintext) V2() (res BodyPlaintextV2) {
	if o.Version__ != BodyPlaintextVersion_V2 {
		panic("wrong case accessed")
	}
	if o.V2__ == nil {
		return
	}
	return *o.V2__
}

func (o BodyPlaintext) V3() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V3 {
		panic("wrong case accessed")
	}
	if o.V3__ == nil {
		return
	}
	return *o.V3__
}

func (o BodyPlaintext) V4() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V4 {
		panic("wrong case accessed")
	}
	if o.V4__ == nil {
		return
	}
	return *o.V4__
}

func (o BodyPlaintext) V5() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V5 {
		panic("wrong case accessed")
	}
	if o.V5__ == nil {
		return
	}
	return *o.V5__
}

func (o BodyPlaintext) V6() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V6 {
		panic("wrong case accessed")
	}
	if o.V6__ == nil {
		return
	}
	return *o.V6__
}

func (o BodyPlaintext) V7() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V7 {
		panic("wrong case accessed")
	}
	if o.V7__ == nil {
		return
	}
	return *o.V7__
}

func (o BodyPlaintext) V8() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V8 {
		panic("wrong case accessed")
	}
	if o.V8__ == nil {
		return
	}
	return *o.V8__
}

func (o BodyPlaintext) V9() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V9 {
		panic("wrong case accessed")
	}
	if o.V9__ == nil {
		return
	}
	return *o.V9__
}

func (o BodyPlaintext) V10() (res BodyPlaintextUnsupported) {
	if o.Version__ != BodyPlaintextVersion_V10 {
		panic("wrong case accessed")
	}
	if o.V10__ == nil {
		return
	}
	return *o.V10__
}

func NewBodyPlaintextWithV1(v BodyPlaintextV1) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V1,
		V1__:      &v,
	}
}

func NewBodyPlaintextWithV2(v BodyPlaintextV2) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V2,
		V2__:      &v,
	}
}

func NewBodyPlaintextWithV3(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V3,
		V3__:      &v,
	}
}

func NewBodyPlaintextWithV4(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V4,
		V4__:      &v,
	}
}

func NewBodyPlaintextWithV5(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V5,
		V5__:      &v,
	}
}

func NewBodyPlaintextWithV6(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V6,
		V6__:      &v,
	}
}

func NewBodyPlaintextWithV7(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V7,
		V7__:      &v,
	}
}

func NewBodyPlaintextWithV8(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V8,
		V8__:      &v,
	}
}

func NewBodyPlaintextWithV9(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V9,
		V9__:      &v,
	}
}

func NewBodyPlaintextWithV10(v BodyPlaintextUnsupported) BodyPlaintext {
	return BodyPlaintext{
		Version__: BodyPlaintextVersion_V10,
		V10__:     &v,
	}
}

func (o BodyPlaintext) DeepCopy() BodyPlaintext {
	return BodyPlaintext{
		Version__: o.Version__.DeepCopy(),
		V1__: (func(x *BodyPlaintextV1) *BodyPlaintextV1 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V1__),
		V2__: (func(x *BodyPlaintextV2) *BodyPlaintextV2 {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V2__),
		V3__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V3__),
		V4__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V4__),
		V5__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V5__),
		V6__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V6__),
		V7__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V7__),
		V8__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V8__),
		V9__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V9__),
		V10__: (func(x *BodyPlaintextUnsupported) *BodyPlaintextUnsupported {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.V10__),
	}
}

type MessagePlaintext struct {
	ClientHeader       MessageClientHeader `codec:"clientHeader" json:"clientHeader"`
	MessageBody        MessageBody         `codec:"messageBody" json:"messageBody"`
	SupersedesOutboxID *OutboxID           `codec:"supersedesOutboxID,omitempty" json:"supersedesOutboxID,omitempty"`
	Emojis             []HarvestedEmoji    `codec:"emojis" json:"emojis"`
}

func (o MessagePlaintext) DeepCopy() MessagePlaintext {
	return MessagePlaintext{
		ClientHeader: o.ClientHeader.DeepCopy(),
		MessageBody:  o.MessageBody.DeepCopy(),
		SupersedesOutboxID: (func(x *OutboxID) *OutboxID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SupersedesOutboxID),
		Emojis: (func(x []HarvestedEmoji) []HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make([]HarvestedEmoji, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Emojis),
	}
}

type MessageUnboxedValid struct {
	ClientHeader          MessageClientHeaderVerified `codec:"clientHeader" json:"clientHeader"`
	ServerHeader          MessageServerHeader         `codec:"serverHeader" json:"serverHeader"`
	MessageBody           MessageBody                 `codec:"messageBody" json:"messageBody"`
	SenderUsername        string                      `codec:"senderUsername" json:"senderUsername"`
	SenderDeviceName      string                      `codec:"senderDeviceName" json:"senderDeviceName"`
	SenderDeviceType      keybase1.DeviceTypeV2       `codec:"senderDeviceType" json:"senderDeviceType"`
	BodyHash              Hash                        `codec:"bodyHash" json:"bodyHash"`
	HeaderHash            Hash                        `codec:"headerHash" json:"headerHash"`
	HeaderSignature       *SignatureInfo              `codec:"headerSignature,omitempty" json:"headerSignature,omitempty"`
	VerificationKey       *[]byte                     `codec:"verificationKey,omitempty" json:"verificationKey,omitempty"`
	SenderDeviceRevokedAt *gregor1.Time               `codec:"senderDeviceRevokedAt,omitempty" json:"senderDeviceRevokedAt,omitempty"`
	AtMentionUsernames    []string                    `codec:"atMentionUsernames" json:"atMentionUsernames"`
	AtMentions            []gregor1.UID               `codec:"atMentions" json:"atMentions"`
	ChannelMention        ChannelMention              `codec:"channelMention" json:"channelMention"`
	MaybeMentions         []MaybeMention              `codec:"maybeMentions" json:"maybeMentions"`
	ChannelNameMentions   []ChannelNameMention        `codec:"channelNameMentions" json:"channelNameMentions"`
	Reactions             ReactionMap                 `codec:"reactions" json:"reactions"`
	Unfurls               map[MessageID]UnfurlResult  `codec:"unfurls" json:"unfurls"`
	Emojis                []HarvestedEmoji            `codec:"emojis" json:"emojis"`
	ReplyTo               *MessageUnboxed             `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	BotUsername           string                      `codec:"botUsername" json:"botUsername"`
}

func (o MessageUnboxedValid) DeepCopy() MessageUnboxedValid {
	return MessageUnboxedValid{
		ClientHeader:     o.ClientHeader.DeepCopy(),
		ServerHeader:     o.ServerHeader.DeepCopy(),
		MessageBody:      o.MessageBody.DeepCopy(),
		SenderUsername:   o.SenderUsername,
		SenderDeviceName: o.SenderDeviceName,
		SenderDeviceType: o.SenderDeviceType.DeepCopy(),
		BodyHash:         o.BodyHash.DeepCopy(),
		HeaderHash:       o.HeaderHash.DeepCopy(),
		HeaderSignature: (func(x *SignatureInfo) *SignatureInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.HeaderSignature),
		VerificationKey: (func(x *[]byte) *[]byte {
			if x == nil {
				return nil
			}
			tmp := (func(x []byte) []byte {
				if x == nil {
					return nil
				}
				return append([]byte{}, x...)
			})((*x))
			return &tmp
		})(o.VerificationKey),
		SenderDeviceRevokedAt: (func(x *gregor1.Time) *gregor1.Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SenderDeviceRevokedAt),
		AtMentionUsernames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.AtMentionUsernames),
		AtMentions: (func(x []gregor1.UID) []gregor1.UID {
			if x == nil {
				return nil
			}
			ret := make([]gregor1.UID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.AtMentions),
		ChannelMention: o.ChannelMention.DeepCopy(),
		MaybeMentions: (func(x []MaybeMention) []MaybeMention {
			if x == nil {
				return nil
			}
			ret := make([]MaybeMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MaybeMentions),
		ChannelNameMentions: (func(x []ChannelNameMention) []ChannelNameMention {
			if x == nil {
				return nil
			}
			ret := make([]ChannelNameMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ChannelNameMentions),
		Reactions: o.Reactions.DeepCopy(),
		Unfurls: (func(x map[MessageID]UnfurlResult) map[MessageID]UnfurlResult {
			if x == nil {
				return nil
			}
			ret := make(map[MessageID]UnfurlResult, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Unfurls),
		Emojis: (func(x []HarvestedEmoji) []HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make([]HarvestedEmoji, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Emojis),
		ReplyTo: (func(x *MessageUnboxed) *MessageUnboxed {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ReplyTo),
		BotUsername: o.BotUsername,
	}
}

type MessageUnboxedErrorType int

const (
	MessageUnboxedErrorType_MISC                MessageUnboxedErrorType = 0
	MessageUnboxedErrorType_BADVERSION_CRITICAL MessageUnboxedErrorType = 1
	MessageUnboxedErrorType_BADVERSION          MessageUnboxedErrorType = 2
	MessageUnboxedErrorType_IDENTIFY            MessageUnboxedErrorType = 3
	MessageUnboxedErrorType_EPHEMERAL           MessageUnboxedErrorType = 4
	MessageUnboxedErrorType_PAIRWISE_MISSING    MessageUnboxedErrorType = 5
)

func (o MessageUnboxedErrorType) DeepCopy() MessageUnboxedErrorType { return o }

var MessageUnboxedErrorTypeMap = map[string]MessageUnboxedErrorType{
	"MISC":                0,
	"BADVERSION_CRITICAL": 1,
	"BADVERSION":          2,
	"IDENTIFY":            3,
	"EPHEMERAL":           4,
	"PAIRWISE_MISSING":    5,
}

var MessageUnboxedErrorTypeRevMap = map[MessageUnboxedErrorType]string{
	0: "MISC",
	1: "BADVERSION_CRITICAL",
	2: "BADVERSION",
	3: "IDENTIFY",
	4: "EPHEMERAL",
	5: "PAIRWISE_MISSING",
}

func (e MessageUnboxedErrorType) String() string {
	if v, ok := MessageUnboxedErrorTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MessageUnboxedError struct {
	ErrType          MessageUnboxedErrorType `codec:"errType" json:"errType"`
	ErrMsg           string                  `codec:"errMsg" json:"errMsg"`
	InternalErrMsg   string                  `codec:"internalErrMsg" json:"internalErrMsg"`
	VersionKind      VersionKind             `codec:"versionKind" json:"versionKind"`
	VersionNumber    int                     `codec:"versionNumber" json:"versionNumber"`
	IsCritical       bool                    `codec:"isCritical" json:"isCritical"`
	SenderUsername   string                  `codec:"senderUsername" json:"senderUsername"`
	SenderDeviceName string                  `codec:"senderDeviceName" json:"senderDeviceName"`
	SenderDeviceType keybase1.DeviceTypeV2   `codec:"senderDeviceType" json:"senderDeviceType"`
	MessageID        MessageID               `codec:"messageID" json:"messageID"`
	MessageType      MessageType             `codec:"messageType" json:"messageType"`
	Ctime            gregor1.Time            `codec:"ctime" json:"ctime"`
	IsEphemeral      bool                    `codec:"isEphemeral" json:"isEphemeral"`
	ExplodedBy       *string                 `codec:"explodedBy,omitempty" json:"explodedBy,omitempty"`
	Etime            gregor1.Time            `codec:"etime" json:"etime"`
	BotUsername      string                  `codec:"botUsername" json:"botUsername"`
}

func (o MessageUnboxedError) DeepCopy() MessageUnboxedError {
	return MessageUnboxedError{
		ErrType:          o.ErrType.DeepCopy(),
		ErrMsg:           o.ErrMsg,
		InternalErrMsg:   o.InternalErrMsg,
		VersionKind:      o.VersionKind.DeepCopy(),
		VersionNumber:    o.VersionNumber,
		IsCritical:       o.IsCritical,
		SenderUsername:   o.SenderUsername,
		SenderDeviceName: o.SenderDeviceName,
		SenderDeviceType: o.SenderDeviceType.DeepCopy(),
		MessageID:        o.MessageID.DeepCopy(),
		MessageType:      o.MessageType.DeepCopy(),
		Ctime:            o.Ctime.DeepCopy(),
		IsEphemeral:      o.IsEphemeral,
		ExplodedBy: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ExplodedBy),
		Etime:       o.Etime.DeepCopy(),
		BotUsername: o.BotUsername,
	}
}

type MessageUnboxedPlaceholder struct {
	MessageID MessageID `codec:"messageID" json:"messageID"`
	Hidden    bool      `codec:"hidden" json:"hidden"`
}

func (o MessageUnboxedPlaceholder) DeepCopy() MessageUnboxedPlaceholder {
	return MessageUnboxedPlaceholder{
		MessageID: o.MessageID.DeepCopy(),
		Hidden:    o.Hidden,
	}
}

type JourneycardType int

const (
	JourneycardType_WELCOME          JourneycardType = 0
	JourneycardType_POPULAR_CHANNELS JourneycardType = 1
	JourneycardType_ADD_PEOPLE       JourneycardType = 2
	JourneycardType_CREATE_CHANNELS  JourneycardType = 3
	JourneycardType_MSG_ATTENTION    JourneycardType = 4
	JourneycardType_UNUSED           JourneycardType = 5
	JourneycardType_CHANNEL_INACTIVE JourneycardType = 6
	JourneycardType_MSG_NO_ANSWER    JourneycardType = 7
)

func (o JourneycardType) DeepCopy() JourneycardType { return o }

var JourneycardTypeMap = map[string]JourneycardType{
	"WELCOME":          0,
	"POPULAR_CHANNELS": 1,
	"ADD_PEOPLE":       2,
	"CREATE_CHANNELS":  3,
	"MSG_ATTENTION":    4,
	"UNUSED":           5,
	"CHANNEL_INACTIVE": 6,
	"MSG_NO_ANSWER":    7,
}

var JourneycardTypeRevMap = map[JourneycardType]string{
	0: "WELCOME",
	1: "POPULAR_CHANNELS",
	2: "ADD_PEOPLE",
	3: "CREATE_CHANNELS",
	4: "MSG_ATTENTION",
	5: "UNUSED",
	6: "CHANNEL_INACTIVE",
	7: "MSG_NO_ANSWER",
}

func (e JourneycardType) String() string {
	if v, ok := JourneycardTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MessageUnboxedJourneycard struct {
	PrevID         MessageID       `codec:"prevID" json:"prevID"`
	Ordinal        int             `codec:"ordinal" json:"ordinal"`
	CardType       JourneycardType `codec:"cardType" json:"cardType"`
	HighlightMsgID MessageID       `codec:"highlightMsgID" json:"highlightMsgID"`
	OpenTeam       bool            `codec:"openTeam" json:"openTeam"`
}

func (o MessageUnboxedJourneycard) DeepCopy() MessageUnboxedJourneycard {
	return MessageUnboxedJourneycard{
		PrevID:         o.PrevID.DeepCopy(),
		Ordinal:        o.Ordinal,
		CardType:       o.CardType.DeepCopy(),
		HighlightMsgID: o.HighlightMsgID.DeepCopy(),
		OpenTeam:       o.OpenTeam,
	}
}

type MessageUnboxed struct {
	State__       MessageUnboxedState        `codec:"state" json:"state"`
	Valid__       *MessageUnboxedValid       `codec:"valid,omitempty" json:"valid,omitempty"`
	Error__       *MessageUnboxedError       `codec:"error,omitempty" json:"error,omitempty"`
	Outbox__      *OutboxRecord              `codec:"outbox,omitempty" json:"outbox,omitempty"`
	Placeholder__ *MessageUnboxedPlaceholder `codec:"placeholder,omitempty" json:"placeholder,omitempty"`
	Journeycard__ *MessageUnboxedJourneycard `codec:"journeycard,omitempty" json:"journeycard,omitempty"`
}

func (o *MessageUnboxed) State() (ret MessageUnboxedState, err error) {
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

func (o MessageUnboxed) Valid() (res MessageUnboxedValid) {
	if o.State__ != MessageUnboxedState_VALID {
		panic("wrong case accessed")
	}
	if o.Valid__ == nil {
		return
	}
	return *o.Valid__
}

func (o MessageUnboxed) Error() (res MessageUnboxedError) {
	if o.State__ != MessageUnboxedState_ERROR {
		panic("wrong case accessed")
	}
	if o.Error__ == nil {
		return
	}
	return *o.Error__
}

func (o MessageUnboxed) Outbox() (res OutboxRecord) {
	if o.State__ != MessageUnboxedState_OUTBOX {
		panic("wrong case accessed")
	}
	if o.Outbox__ == nil {
		return
	}
	return *o.Outbox__
}

func (o MessageUnboxed) Placeholder() (res MessageUnboxedPlaceholder) {
	if o.State__ != MessageUnboxedState_PLACEHOLDER {
		panic("wrong case accessed")
	}
	if o.Placeholder__ == nil {
		return
	}
	return *o.Placeholder__
}

func (o MessageUnboxed) Journeycard() (res MessageUnboxedJourneycard) {
	if o.State__ != MessageUnboxedState_JOURNEYCARD {
		panic("wrong case accessed")
	}
	if o.Journeycard__ == nil {
		return
	}
	return *o.Journeycard__
}

func NewMessageUnboxedWithValid(v MessageUnboxedValid) MessageUnboxed {
	return MessageUnboxed{
		State__: MessageUnboxedState_VALID,
		Valid__: &v,
	}
}

func NewMessageUnboxedWithError(v MessageUnboxedError) MessageUnboxed {
	return MessageUnboxed{
		State__: MessageUnboxedState_ERROR,
		Error__: &v,
	}
}

func NewMessageUnboxedWithOutbox(v OutboxRecord) MessageUnboxed {
	return MessageUnboxed{
		State__:  MessageUnboxedState_OUTBOX,
		Outbox__: &v,
	}
}

func NewMessageUnboxedWithPlaceholder(v MessageUnboxedPlaceholder) MessageUnboxed {
	return MessageUnboxed{
		State__:       MessageUnboxedState_PLACEHOLDER,
		Placeholder__: &v,
	}
}

func NewMessageUnboxedWithJourneycard(v MessageUnboxedJourneycard) MessageUnboxed {
	return MessageUnboxed{
		State__:       MessageUnboxedState_JOURNEYCARD,
		Journeycard__: &v,
	}
}

func (o MessageUnboxed) DeepCopy() MessageUnboxed {
	return MessageUnboxed{
		State__: o.State__.DeepCopy(),
		Valid__: (func(x *MessageUnboxedValid) *MessageUnboxedValid {
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
		Outbox__: (func(x *OutboxRecord) *OutboxRecord {
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
		Journeycard__: (func(x *MessageUnboxedJourneycard) *MessageUnboxedJourneycard {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Journeycard__),
	}
}

type UnreadFirstNumLimit struct {
	NumRead int `codec:"NumRead" json:"NumRead"`
	AtLeast int `codec:"AtLeast" json:"AtLeast"`
	AtMost  int `codec:"AtMost" json:"AtMost"`
}

func (o UnreadFirstNumLimit) DeepCopy() UnreadFirstNumLimit {
	return UnreadFirstNumLimit{
		NumRead: o.NumRead,
		AtLeast: o.AtLeast,
		AtMost:  o.AtMost,
	}
}

type ConversationLocalParticipant struct {
	Username    string  `codec:"username" json:"username"`
	InConvName  bool    `codec:"inConvName" json:"inConvName"`
	Fullname    *string `codec:"fullname,omitempty" json:"fullname,omitempty"`
	ContactName *string `codec:"contactName,omitempty" json:"contactName,omitempty"`
}

func (o ConversationLocalParticipant) DeepCopy() ConversationLocalParticipant {
	return ConversationLocalParticipant{
		Username:   o.Username,
		InConvName: o.InConvName,
		Fullname: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Fullname),
		ContactName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.ContactName),
	}
}

type ConversationPinnedMessage struct {
	Message        MessageUnboxed `codec:"message" json:"message"`
	PinnerUsername string         `codec:"pinnerUsername" json:"pinnerUsername"`
}

func (o ConversationPinnedMessage) DeepCopy() ConversationPinnedMessage {
	return ConversationPinnedMessage{
		Message:        o.Message.DeepCopy(),
		PinnerUsername: o.PinnerUsername,
	}
}

type ConversationInfoLocal struct {
	Id             ConversationID                 `codec:"id" json:"id"`
	Triple         ConversationIDTriple           `codec:"triple" json:"triple"`
	TlfName        string                         `codec:"tlfName" json:"tlfName"`
	TopicName      string                         `codec:"topicName" json:"topicName"`
	Headline       string                         `codec:"headline" json:"headline"`
	HeadlineEmojis []HarvestedEmoji               `codec:"headlineEmojis" json:"headlineEmojis"`
	SnippetMsg     *MessageUnboxed                `codec:"snippetMsg,omitempty" json:"snippetMsg,omitempty"`
	PinnedMsg      *ConversationPinnedMessage     `codec:"pinnedMsg,omitempty" json:"pinnedMsg,omitempty"`
	Draft          *string                        `codec:"draft,omitempty" json:"draft,omitempty"`
	Visibility     keybase1.TLFVisibility         `codec:"visibility" json:"visibility"`
	IsDefaultConv  bool                           `codec:"isDefaultConv" json:"isDefaultConv"`
	Status         ConversationStatus             `codec:"status" json:"status"`
	MembersType    ConversationMembersType        `codec:"membersType" json:"membersType"`
	MemberStatus   ConversationMemberStatus       `codec:"memberStatus" json:"memberStatus"`
	TeamType       TeamType                       `codec:"teamType" json:"teamType"`
	Existence      ConversationExistence          `codec:"existence" json:"existence"`
	Version        ConversationVers               `codec:"version" json:"version"`
	LocalVersion   LocalConversationVers          `codec:"localVersion" json:"localVersion"`
	Participants   []ConversationLocalParticipant `codec:"participants" json:"participants"`
	FinalizeInfo   *ConversationFinalizeInfo      `codec:"finalizeInfo,omitempty" json:"finalizeInfo,omitempty"`
	ResetNames     []string                       `codec:"resetNames" json:"resetNames"`
}

func (o ConversationInfoLocal) DeepCopy() ConversationInfoLocal {
	return ConversationInfoLocal{
		Id:        o.Id.DeepCopy(),
		Triple:    o.Triple.DeepCopy(),
		TlfName:   o.TlfName,
		TopicName: o.TopicName,
		Headline:  o.Headline,
		HeadlineEmojis: (func(x []HarvestedEmoji) []HarvestedEmoji {
			if x == nil {
				return nil
			}
			ret := make([]HarvestedEmoji, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.HeadlineEmojis),
		SnippetMsg: (func(x *MessageUnboxed) *MessageUnboxed {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SnippetMsg),
		PinnedMsg: (func(x *ConversationPinnedMessage) *ConversationPinnedMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.PinnedMsg),
		Draft: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Draft),
		Visibility:    o.Visibility.DeepCopy(),
		IsDefaultConv: o.IsDefaultConv,
		Status:        o.Status.DeepCopy(),
		MembersType:   o.MembersType.DeepCopy(),
		MemberStatus:  o.MemberStatus.DeepCopy(),
		TeamType:      o.TeamType.DeepCopy(),
		Existence:     o.Existence.DeepCopy(),
		Version:       o.Version.DeepCopy(),
		LocalVersion:  o.LocalVersion.DeepCopy(),
		Participants: (func(x []ConversationLocalParticipant) []ConversationLocalParticipant {
			if x == nil {
				return nil
			}
			ret := make([]ConversationLocalParticipant, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Participants),
		FinalizeInfo: (func(x *ConversationFinalizeInfo) *ConversationFinalizeInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FinalizeInfo),
		ResetNames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ResetNames),
	}
}

type ConversationErrorType int

const (
	ConversationErrorType_PERMANENT        ConversationErrorType = 0
	ConversationErrorType_MISSINGINFO      ConversationErrorType = 1
	ConversationErrorType_SELFREKEYNEEDED  ConversationErrorType = 2
	ConversationErrorType_OTHERREKEYNEEDED ConversationErrorType = 3
	ConversationErrorType_IDENTIFY         ConversationErrorType = 4
	ConversationErrorType_TRANSIENT        ConversationErrorType = 5
	ConversationErrorType_NONE             ConversationErrorType = 6
)

func (o ConversationErrorType) DeepCopy() ConversationErrorType { return o }

var ConversationErrorTypeMap = map[string]ConversationErrorType{
	"PERMANENT":        0,
	"MISSINGINFO":      1,
	"SELFREKEYNEEDED":  2,
	"OTHERREKEYNEEDED": 3,
	"IDENTIFY":         4,
	"TRANSIENT":        5,
	"NONE":             6,
}

var ConversationErrorTypeRevMap = map[ConversationErrorType]string{
	0: "PERMANENT",
	1: "MISSINGINFO",
	2: "SELFREKEYNEEDED",
	3: "OTHERREKEYNEEDED",
	4: "IDENTIFY",
	5: "TRANSIENT",
	6: "NONE",
}

func (e ConversationErrorType) String() string {
	if v, ok := ConversationErrorTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConversationErrorLocal struct {
	Typ               ConversationErrorType   `codec:"typ" json:"typ"`
	Message           string                  `codec:"message" json:"message"`
	RemoteConv        Conversation            `codec:"remoteConv" json:"remoteConv"`
	UnverifiedTLFName string                  `codec:"unverifiedTLFName" json:"unverifiedTLFName"`
	RekeyInfo         *ConversationErrorRekey `codec:"rekeyInfo,omitempty" json:"rekeyInfo,omitempty"`
}

func (o ConversationErrorLocal) DeepCopy() ConversationErrorLocal {
	return ConversationErrorLocal{
		Typ:               o.Typ.DeepCopy(),
		Message:           o.Message,
		RemoteConv:        o.RemoteConv.DeepCopy(),
		UnverifiedTLFName: o.UnverifiedTLFName,
		RekeyInfo: (func(x *ConversationErrorRekey) *ConversationErrorRekey {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RekeyInfo),
	}
}

type ConversationErrorRekey struct {
	TlfName     string   `codec:"tlfName" json:"tlfName"`
	TlfPublic   bool     `codec:"tlfPublic" json:"tlfPublic"`
	Rekeyers    []string `codec:"rekeyers" json:"rekeyers"`
	WriterNames []string `codec:"writerNames" json:"writerNames"`
	ReaderNames []string `codec:"readerNames" json:"readerNames"`
}

func (o ConversationErrorRekey) DeepCopy() ConversationErrorRekey {
	return ConversationErrorRekey{
		TlfName:   o.TlfName,
		TlfPublic: o.TlfPublic,
		Rekeyers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Rekeyers),
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
		ReaderNames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ReaderNames),
	}
}

type ConversationMinWriterRoleInfoLocal struct {
	ChangedBy   string            `codec:"changedBy" json:"changedBy"`
	CannotWrite bool              `codec:"cannotWrite" json:"cannotWrite"`
	Role        keybase1.TeamRole `codec:"role" json:"role"`
}

func (o ConversationMinWriterRoleInfoLocal) DeepCopy() ConversationMinWriterRoleInfoLocal {
	return ConversationMinWriterRoleInfoLocal{
		ChangedBy:   o.ChangedBy,
		CannotWrite: o.CannotWrite,
		Role:        o.Role.DeepCopy(),
	}
}

type ConversationSettingsLocal struct {
	MinWriterRoleInfo *ConversationMinWriterRoleInfoLocal `codec:"minWriterRoleInfo,omitempty" json:"minWriterRoleInfo,omitempty"`
}

func (o ConversationSettingsLocal) DeepCopy() ConversationSettingsLocal {
	return ConversationSettingsLocal{
		MinWriterRoleInfo: (func(x *ConversationMinWriterRoleInfoLocal) *ConversationMinWriterRoleInfoLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MinWriterRoleInfo),
	}
}

type ConversationLocal struct {
	Error            *ConversationErrorLocal       `codec:"error,omitempty" json:"error,omitempty"`
	Info             ConversationInfoLocal         `codec:"info" json:"info"`
	ReaderInfo       ConversationReaderInfo        `codec:"readerInfo" json:"readerInfo"`
	CreatorInfo      *ConversationCreatorInfoLocal `codec:"creatorInfo,omitempty" json:"creatorInfo,omitempty"`
	Notifications    *ConversationNotificationInfo `codec:"notifications,omitempty" json:"notifications,omitempty"`
	Supersedes       []ConversationMetadata        `codec:"supersedes" json:"supersedes"`
	SupersededBy     []ConversationMetadata        `codec:"supersededBy" json:"supersededBy"`
	MaxMessages      []MessageSummary              `codec:"maxMessages" json:"maxMessages"`
	IsEmpty          bool                          `codec:"isEmpty" json:"isEmpty"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
	Expunge          Expunge                       `codec:"expunge" json:"expunge"`
	ConvRetention    *RetentionPolicy              `codec:"convRetention,omitempty" json:"convRetention,omitempty"`
	TeamRetention    *RetentionPolicy              `codec:"teamRetention,omitempty" json:"teamRetention,omitempty"`
	ConvSettings     *ConversationSettingsLocal    `codec:"convSettings,omitempty" json:"convSettings,omitempty"`
	Commands         ConversationCommandGroups     `codec:"commands" json:"commands"`
	BotCommands      ConversationCommandGroups     `codec:"botCommands" json:"botCommands"`
	BotAliases       map[string]string             `codec:"botAliases" json:"botAliases"`
}

func (o ConversationLocal) DeepCopy() ConversationLocal {
	return ConversationLocal{
		Error: (func(x *ConversationErrorLocal) *ConversationErrorLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Error),
		Info:       o.Info.DeepCopy(),
		ReaderInfo: o.ReaderInfo.DeepCopy(),
		CreatorInfo: (func(x *ConversationCreatorInfoLocal) *ConversationCreatorInfoLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.CreatorInfo),
		Notifications: (func(x *ConversationNotificationInfo) *ConversationNotificationInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Notifications),
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
		MaxMessages: (func(x []MessageSummary) []MessageSummary {
			if x == nil {
				return nil
			}
			ret := make([]MessageSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MaxMessages),
		IsEmpty: o.IsEmpty,
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
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
		ConvSettings: (func(x *ConversationSettingsLocal) *ConversationSettingsLocal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvSettings),
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
	}
}

type NonblockFetchRes struct {
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o NonblockFetchRes) DeepCopy() NonblockFetchRes {
	return NonblockFetchRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type ThreadView struct {
	Messages   []MessageUnboxed `codec:"messages" json:"messages"`
	Pagination *Pagination      `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

func (o ThreadView) DeepCopy() ThreadView {
	return ThreadView{
		Messages: (func(x []MessageUnboxed) []MessageUnboxed {
			if x == nil {
				return nil
			}
			ret := make([]MessageUnboxed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Messages),
		Pagination: (func(x *Pagination) *Pagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pagination),
	}
}

type MessageIDControlMode int

const (
	MessageIDControlMode_OLDERMESSAGES MessageIDControlMode = 0
	MessageIDControlMode_NEWERMESSAGES MessageIDControlMode = 1
	MessageIDControlMode_CENTERED      MessageIDControlMode = 2
	MessageIDControlMode_UNREADLINE    MessageIDControlMode = 3
)

func (o MessageIDControlMode) DeepCopy() MessageIDControlMode { return o }

var MessageIDControlModeMap = map[string]MessageIDControlMode{
	"OLDERMESSAGES": 0,
	"NEWERMESSAGES": 1,
	"CENTERED":      2,
	"UNREADLINE":    3,
}

var MessageIDControlModeRevMap = map[MessageIDControlMode]string{
	0: "OLDERMESSAGES",
	1: "NEWERMESSAGES",
	2: "CENTERED",
	3: "UNREADLINE",
}

func (e MessageIDControlMode) String() string {
	if v, ok := MessageIDControlModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MessageIDControl struct {
	Pivot *MessageID           `codec:"pivot,omitempty" json:"pivot,omitempty"`
	Mode  MessageIDControlMode `codec:"mode" json:"mode"`
	Num   int                  `codec:"num" json:"num"`
}

func (o MessageIDControl) DeepCopy() MessageIDControl {
	return MessageIDControl{
		Pivot: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pivot),
		Mode: o.Mode.DeepCopy(),
		Num:  o.Num,
	}
}

type GetThreadQuery struct {
	MarkAsRead               bool              `codec:"markAsRead" json:"markAsRead"`
	MessageTypes             []MessageType     `codec:"messageTypes" json:"messageTypes"`
	DisableResolveSupersedes bool              `codec:"disableResolveSupersedes" json:"disableResolveSupersedes"`
	EnableDeletePlaceholders bool              `codec:"enableDeletePlaceholders" json:"enableDeletePlaceholders"`
	DisablePostProcessThread bool              `codec:"disablePostProcessThread" json:"disablePostProcessThread"`
	Before                   *gregor1.Time     `codec:"before,omitempty" json:"before,omitempty"`
	After                    *gregor1.Time     `codec:"after,omitempty" json:"after,omitempty"`
	MessageIDControl         *MessageIDControl `codec:"messageIDControl,omitempty" json:"messageIDControl,omitempty"`
}

func (o GetThreadQuery) DeepCopy() GetThreadQuery {
	return GetThreadQuery{
		MarkAsRead: o.MarkAsRead,
		MessageTypes: (func(x []MessageType) []MessageType {
			if x == nil {
				return nil
			}
			ret := make([]MessageType, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MessageTypes),
		DisableResolveSupersedes: o.DisableResolveSupersedes,
		EnableDeletePlaceholders: o.EnableDeletePlaceholders,
		DisablePostProcessThread: o.DisablePostProcessThread,
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
		MessageIDControl: (func(x *MessageIDControl) *MessageIDControl {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MessageIDControl),
	}
}

type GetThreadLocalRes struct {
	Thread           ThreadView                    `codec:"thread" json:"thread"`
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o GetThreadLocalRes) DeepCopy() GetThreadLocalRes {
	return GetThreadLocalRes{
		Thread:  o.Thread.DeepCopy(),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type GetThreadNonblockCbMode int

const (
	GetThreadNonblockCbMode_FULL        GetThreadNonblockCbMode = 0
	GetThreadNonblockCbMode_INCREMENTAL GetThreadNonblockCbMode = 1
)

func (o GetThreadNonblockCbMode) DeepCopy() GetThreadNonblockCbMode { return o }

var GetThreadNonblockCbModeMap = map[string]GetThreadNonblockCbMode{
	"FULL":        0,
	"INCREMENTAL": 1,
}

var GetThreadNonblockCbModeRevMap = map[GetThreadNonblockCbMode]string{
	0: "FULL",
	1: "INCREMENTAL",
}

func (e GetThreadNonblockCbMode) String() string {
	if v, ok := GetThreadNonblockCbModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GetThreadNonblockPgMode int

const (
	GetThreadNonblockPgMode_DEFAULT GetThreadNonblockPgMode = 0
	GetThreadNonblockPgMode_SERVER  GetThreadNonblockPgMode = 1
)

func (o GetThreadNonblockPgMode) DeepCopy() GetThreadNonblockPgMode { return o }

var GetThreadNonblockPgModeMap = map[string]GetThreadNonblockPgMode{
	"DEFAULT": 0,
	"SERVER":  1,
}

var GetThreadNonblockPgModeRevMap = map[GetThreadNonblockPgMode]string{
	0: "DEFAULT",
	1: "SERVER",
}

func (e GetThreadNonblockPgMode) String() string {
	if v, ok := GetThreadNonblockPgModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UnreadlineRes struct {
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
	UnreadlineID     *MessageID                    `codec:"unreadlineID,omitempty" json:"unreadlineID,omitempty"`
}

func (o UnreadlineRes) DeepCopy() UnreadlineRes {
	return UnreadlineRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
		UnreadlineID: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.UnreadlineID),
	}
}

type NameQuery struct {
	Name        string                  `codec:"name" json:"name"`
	TlfID       *TLFID                  `codec:"tlfID,omitempty" json:"tlfID,omitempty"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
}

func (o NameQuery) DeepCopy() NameQuery {
	return NameQuery{
		Name: o.Name,
		TlfID: (func(x *TLFID) *TLFID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TlfID),
		MembersType: o.MembersType.DeepCopy(),
	}
}

type GetInboxLocalQuery struct {
	Name              *NameQuery                 `codec:"name,omitempty" json:"name,omitempty"`
	TopicName         *string                    `codec:"topicName,omitempty" json:"topicName,omitempty"`
	ConvIDs           []ConversationID           `codec:"convIDs" json:"convIDs"`
	TopicType         *TopicType                 `codec:"topicType,omitempty" json:"topicType,omitempty"`
	TlfVisibility     *keybase1.TLFVisibility    `codec:"tlfVisibility,omitempty" json:"tlfVisibility,omitempty"`
	Before            *gregor1.Time              `codec:"before,omitempty" json:"before,omitempty"`
	After             *gregor1.Time              `codec:"after,omitempty" json:"after,omitempty"`
	OneChatTypePerTLF *bool                      `codec:"oneChatTypePerTLF,omitempty" json:"oneChatTypePerTLF,omitempty"`
	Status            []ConversationStatus       `codec:"status" json:"status"`
	MemberStatus      []ConversationMemberStatus `codec:"memberStatus" json:"memberStatus"`
	UnreadOnly        bool                       `codec:"unreadOnly" json:"unreadOnly"`
	ReadOnly          bool                       `codec:"readOnly" json:"readOnly"`
	ComputeActiveList bool                       `codec:"computeActiveList" json:"computeActiveList"`
}

func (o GetInboxLocalQuery) DeepCopy() GetInboxLocalQuery {
	return GetInboxLocalQuery{
		Name: (func(x *NameQuery) *NameQuery {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Name),
		TopicName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.TopicName),
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
		TopicType: (func(x *TopicType) *TopicType {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TopicType),
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
		UnreadOnly:        o.UnreadOnly,
		ReadOnly:          o.ReadOnly,
		ComputeActiveList: o.ComputeActiveList,
	}
}

type GetInboxAndUnboxLocalRes struct {
	Conversations    []ConversationLocal           `codec:"conversations" json:"conversations"`
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o GetInboxAndUnboxLocalRes) DeepCopy() GetInboxAndUnboxLocalRes {
	return GetInboxAndUnboxLocalRes{
		Conversations: (func(x []ConversationLocal) []ConversationLocal {
			if x == nil {
				return nil
			}
			ret := make([]ConversationLocal, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type GetInboxAndUnboxUILocalRes struct {
	Conversations    []InboxUIItem                 `codec:"conversations" json:"conversations"`
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o GetInboxAndUnboxUILocalRes) DeepCopy() GetInboxAndUnboxUILocalRes {
	return GetInboxAndUnboxUILocalRes{
		Conversations: (func(x []InboxUIItem) []InboxUIItem {
			if x == nil {
				return nil
			}
			ret := make([]InboxUIItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type InboxLayoutReselectMode int

const (
	InboxLayoutReselectMode_DEFAULT InboxLayoutReselectMode = 0
	InboxLayoutReselectMode_FORCE   InboxLayoutReselectMode = 1
)

func (o InboxLayoutReselectMode) DeepCopy() InboxLayoutReselectMode { return o }

var InboxLayoutReselectModeMap = map[string]InboxLayoutReselectMode{
	"DEFAULT": 0,
	"FORCE":   1,
}

var InboxLayoutReselectModeRevMap = map[InboxLayoutReselectMode]string{
	0: "DEFAULT",
	1: "FORCE",
}

func (e InboxLayoutReselectMode) String() string {
	if v, ok := InboxLayoutReselectModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PostLocalRes struct {
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	MessageID        MessageID                     `codec:"messageID" json:"messageID"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o PostLocalRes) DeepCopy() PostLocalRes {
	return PostLocalRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		MessageID: o.MessageID.DeepCopy(),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type PostLocalNonblockRes struct {
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	OutboxID         OutboxID                      `codec:"outboxID" json:"outboxID"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o PostLocalNonblockRes) DeepCopy() PostLocalNonblockRes {
	return PostLocalNonblockRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		OutboxID: o.OutboxID.DeepCopy(),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type EditTarget struct {
	MessageID *MessageID `codec:"messageID,omitempty" json:"messageID,omitempty"`
	OutboxID  *OutboxID  `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
}

func (o EditTarget) DeepCopy() EditTarget {
	return EditTarget{
		MessageID: (func(x *MessageID) *MessageID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.MessageID),
		OutboxID: (func(x *OutboxID) *OutboxID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxID),
	}
}

type SetConversationStatusLocalRes struct {
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o SetConversationStatusLocalRes) DeepCopy() SetConversationStatusLocalRes {
	return SetConversationStatusLocalRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type NewConversationsLocalRes struct {
	Results          []NewConversationsLocalResult `codec:"results" json:"results"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o NewConversationsLocalRes) DeepCopy() NewConversationsLocalRes {
	return NewConversationsLocalRes{
		Results: (func(x []NewConversationsLocalResult) []NewConversationsLocalResult {
			if x == nil {
				return nil
			}
			ret := make([]NewConversationsLocalResult, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Results),
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type NewConversationsLocalResult struct {
	Result *NewConversationLocalRes `codec:"result,omitempty" json:"result,omitempty"`
	Err    *string                  `codec:"err,omitempty" json:"err,omitempty"`
}

func (o NewConversationsLocalResult) DeepCopy() NewConversationsLocalResult {
	return NewConversationsLocalResult{
		Result: (func(x *NewConversationLocalRes) *NewConversationLocalRes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Result),
		Err: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Err),
	}
}

type NewConversationLocalArgument struct {
	TlfName       string                  `codec:"tlfName" json:"tlfName"`
	TopicType     TopicType               `codec:"topicType" json:"topicType"`
	TlfVisibility keybase1.TLFVisibility  `codec:"tlfVisibility" json:"tlfVisibility"`
	TopicName     *string                 `codec:"topicName,omitempty" json:"topicName,omitempty"`
	MembersType   ConversationMembersType `codec:"membersType" json:"membersType"`
}

func (o NewConversationLocalArgument) DeepCopy() NewConversationLocalArgument {
	return NewConversationLocalArgument{
		TlfName:       o.TlfName,
		TopicType:     o.TopicType.DeepCopy(),
		TlfVisibility: o.TlfVisibility.DeepCopy(),
		TopicName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.TopicName),
		MembersType: o.MembersType.DeepCopy(),
	}
}

type NewConversationLocalRes struct {
	Conv             ConversationLocal             `codec:"conv" json:"conv"`
	UiConv           InboxUIItem                   `codec:"uiConv" json:"uiConv"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o NewConversationLocalRes) DeepCopy() NewConversationLocalRes {
	return NewConversationLocalRes{
		Conv:   o.Conv.DeepCopy(),
		UiConv: o.UiConv.DeepCopy(),
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type GetInboxSummaryForCLILocalQuery struct {
	TopicType           TopicType              `codec:"topicType" json:"topicType"`
	After               string                 `codec:"after" json:"after"`
	Before              string                 `codec:"before" json:"before"`
	Visibility          keybase1.TLFVisibility `codec:"visibility" json:"visibility"`
	Status              []ConversationStatus   `codec:"status" json:"status"`
	ConvIDs             []ConversationID       `codec:"convIDs" json:"convIDs"`
	UnreadFirst         bool                   `codec:"unreadFirst" json:"unreadFirst"`
	UnreadFirstLimit    UnreadFirstNumLimit    `codec:"unreadFirstLimit" json:"unreadFirstLimit"`
	ActivitySortedLimit int                    `codec:"activitySortedLimit" json:"activitySortedLimit"`
}

func (o GetInboxSummaryForCLILocalQuery) DeepCopy() GetInboxSummaryForCLILocalQuery {
	return GetInboxSummaryForCLILocalQuery{
		TopicType:  o.TopicType.DeepCopy(),
		After:      o.After,
		Before:     o.Before,
		Visibility: o.Visibility.DeepCopy(),
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
		UnreadFirst:         o.UnreadFirst,
		UnreadFirstLimit:    o.UnreadFirstLimit.DeepCopy(),
		ActivitySortedLimit: o.ActivitySortedLimit,
	}
}

type GetInboxSummaryForCLILocalRes struct {
	Conversations []ConversationLocal `codec:"conversations" json:"conversations"`
	Offline       bool                `codec:"offline" json:"offline"`
	RateLimits    []RateLimit         `codec:"rateLimits" json:"rateLimits"`
}

func (o GetInboxSummaryForCLILocalRes) DeepCopy() GetInboxSummaryForCLILocalRes {
	return GetInboxSummaryForCLILocalRes{
		Conversations: (func(x []ConversationLocal) []ConversationLocal {
			if x == nil {
				return nil
			}
			ret := make([]ConversationLocal, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type GetConversationForCLILocalQuery struct {
	MarkAsRead   bool                `codec:"markAsRead" json:"markAsRead"`
	MessageTypes []MessageType       `codec:"MessageTypes" json:"MessageTypes"`
	Since        *string             `codec:"Since,omitempty" json:"Since,omitempty"`
	Limit        UnreadFirstNumLimit `codec:"limit" json:"limit"`
	Conv         ConversationLocal   `codec:"conv" json:"conv"`
}

func (o GetConversationForCLILocalQuery) DeepCopy() GetConversationForCLILocalQuery {
	return GetConversationForCLILocalQuery{
		MarkAsRead: o.MarkAsRead,
		MessageTypes: (func(x []MessageType) []MessageType {
			if x == nil {
				return nil
			}
			ret := make([]MessageType, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MessageTypes),
		Since: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Since),
		Limit: o.Limit.DeepCopy(),
		Conv:  o.Conv.DeepCopy(),
	}
}

type GetConversationForCLILocalRes struct {
	Conversation ConversationLocal `codec:"conversation" json:"conversation"`
	Messages     []MessageUnboxed  `codec:"messages" json:"messages"`
	Offline      bool              `codec:"offline" json:"offline"`
	RateLimits   []RateLimit       `codec:"rateLimits" json:"rateLimits"`
}

func (o GetConversationForCLILocalRes) DeepCopy() GetConversationForCLILocalRes {
	return GetConversationForCLILocalRes{
		Conversation: o.Conversation.DeepCopy(),
		Messages: (func(x []MessageUnboxed) []MessageUnboxed {
			if x == nil {
				return nil
			}
			ret := make([]MessageUnboxed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Messages),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type GetMessagesLocalRes struct {
	Messages         []MessageUnboxed              `codec:"messages" json:"messages"`
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o GetMessagesLocalRes) DeepCopy() GetMessagesLocalRes {
	return GetMessagesLocalRes{
		Messages: (func(x []MessageUnboxed) []MessageUnboxed {
			if x == nil {
				return nil
			}
			ret := make([]MessageUnboxed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Messages),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type PostFileAttachmentArg struct {
	ConversationID    ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName           string                       `codec:"tlfName" json:"tlfName"`
	Visibility        keybase1.TLFVisibility       `codec:"visibility" json:"visibility"`
	Filename          string                       `codec:"filename" json:"filename"`
	Title             string                       `codec:"title" json:"title"`
	Metadata          []byte                       `codec:"metadata" json:"metadata"`
	IdentifyBehavior  keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	CallerPreview     *MakePreviewRes              `codec:"callerPreview,omitempty" json:"callerPreview,omitempty"`
	OutboxID          *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	EphemeralLifetime *gregor1.DurationSec         `codec:"ephemeralLifetime,omitempty" json:"ephemeralLifetime,omitempty"`
}

func (o PostFileAttachmentArg) DeepCopy() PostFileAttachmentArg {
	return PostFileAttachmentArg{
		ConversationID: o.ConversationID.DeepCopy(),
		TlfName:        o.TlfName,
		Visibility:     o.Visibility.DeepCopy(),
		Filename:       o.Filename,
		Title:          o.Title,
		Metadata: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Metadata),
		IdentifyBehavior: o.IdentifyBehavior.DeepCopy(),
		CallerPreview: (func(x *MakePreviewRes) *MakePreviewRes {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.CallerPreview),
		OutboxID: (func(x *OutboxID) *OutboxID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.OutboxID),
		EphemeralLifetime: (func(x *gregor1.DurationSec) *gregor1.DurationSec {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EphemeralLifetime),
	}
}

type GetNextAttachmentMessageLocalRes struct {
	Message          *UIMessage                    `codec:"message,omitempty" json:"message,omitempty"`
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o GetNextAttachmentMessageLocalRes) DeepCopy() GetNextAttachmentMessageLocalRes {
	return GetNextAttachmentMessageLocalRes{
		Message: (func(x *UIMessage) *UIMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Message),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type DownloadAttachmentLocalRes struct {
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o DownloadAttachmentLocalRes) DeepCopy() DownloadAttachmentLocalRes {
	return DownloadAttachmentLocalRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type DownloadFileAttachmentLocalRes struct {
	FilePath         string                        `codec:"filePath" json:"filePath"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o DownloadFileAttachmentLocalRes) DeepCopy() DownloadFileAttachmentLocalRes {
	return DownloadFileAttachmentLocalRes{
		FilePath: o.FilePath,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type PreviewLocationTyp int

const (
	PreviewLocationTyp_URL   PreviewLocationTyp = 0
	PreviewLocationTyp_FILE  PreviewLocationTyp = 1
	PreviewLocationTyp_BYTES PreviewLocationTyp = 2
)

func (o PreviewLocationTyp) DeepCopy() PreviewLocationTyp { return o }

var PreviewLocationTypMap = map[string]PreviewLocationTyp{
	"URL":   0,
	"FILE":  1,
	"BYTES": 2,
}

var PreviewLocationTypRevMap = map[PreviewLocationTyp]string{
	0: "URL",
	1: "FILE",
	2: "BYTES",
}

func (e PreviewLocationTyp) String() string {
	if v, ok := PreviewLocationTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PreviewLocation struct {
	Ltyp__  PreviewLocationTyp `codec:"ltyp" json:"ltyp"`
	Url__   *string            `codec:"url,omitempty" json:"url,omitempty"`
	File__  *string            `codec:"file,omitempty" json:"file,omitempty"`
	Bytes__ *[]byte            `codec:"bytes,omitempty" json:"bytes,omitempty"`
}

func (o *PreviewLocation) Ltyp() (ret PreviewLocationTyp, err error) {
	switch o.Ltyp__ {
	case PreviewLocationTyp_URL:
		if o.Url__ == nil {
			err = errors.New("unexpected nil value for Url__")
			return ret, err
		}
	case PreviewLocationTyp_FILE:
		if o.File__ == nil {
			err = errors.New("unexpected nil value for File__")
			return ret, err
		}
	case PreviewLocationTyp_BYTES:
		if o.Bytes__ == nil {
			err = errors.New("unexpected nil value for Bytes__")
			return ret, err
		}
	}
	return o.Ltyp__, nil
}

func (o PreviewLocation) Url() (res string) {
	if o.Ltyp__ != PreviewLocationTyp_URL {
		panic("wrong case accessed")
	}
	if o.Url__ == nil {
		return
	}
	return *o.Url__
}

func (o PreviewLocation) File() (res string) {
	if o.Ltyp__ != PreviewLocationTyp_FILE {
		panic("wrong case accessed")
	}
	if o.File__ == nil {
		return
	}
	return *o.File__
}

func (o PreviewLocation) Bytes() (res []byte) {
	if o.Ltyp__ != PreviewLocationTyp_BYTES {
		panic("wrong case accessed")
	}
	if o.Bytes__ == nil {
		return
	}
	return *o.Bytes__
}

func NewPreviewLocationWithUrl(v string) PreviewLocation {
	return PreviewLocation{
		Ltyp__: PreviewLocationTyp_URL,
		Url__:  &v,
	}
}

func NewPreviewLocationWithFile(v string) PreviewLocation {
	return PreviewLocation{
		Ltyp__: PreviewLocationTyp_FILE,
		File__: &v,
	}
}

func NewPreviewLocationWithBytes(v []byte) PreviewLocation {
	return PreviewLocation{
		Ltyp__:  PreviewLocationTyp_BYTES,
		Bytes__: &v,
	}
}

func (o PreviewLocation) DeepCopy() PreviewLocation {
	return PreviewLocation{
		Ltyp__: o.Ltyp__.DeepCopy(),
		Url__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Url__),
		File__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.File__),
		Bytes__: (func(x *[]byte) *[]byte {
			if x == nil {
				return nil
			}
			tmp := (func(x []byte) []byte {
				if x == nil {
					return nil
				}
				return append([]byte{}, x...)
			})((*x))
			return &tmp
		})(o.Bytes__),
	}
}

type MakePreviewRes struct {
	MimeType        string           `codec:"mimeType" json:"mimeType"`
	PreviewMimeType *string          `codec:"previewMimeType,omitempty" json:"previewMimeType,omitempty"`
	Location        *PreviewLocation `codec:"location,omitempty" json:"location,omitempty"`
	Metadata        *AssetMetadata   `codec:"metadata,omitempty" json:"metadata,omitempty"`
	BaseMetadata    *AssetMetadata   `codec:"baseMetadata,omitempty" json:"baseMetadata,omitempty"`
}

func (o MakePreviewRes) DeepCopy() MakePreviewRes {
	return MakePreviewRes{
		MimeType: o.MimeType,
		PreviewMimeType: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.PreviewMimeType),
		Location: (func(x *PreviewLocation) *PreviewLocation {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Location),
		Metadata: (func(x *AssetMetadata) *AssetMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Metadata),
		BaseMetadata: (func(x *AssetMetadata) *AssetMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.BaseMetadata),
	}
}

type MarkAsReadLocalRes struct {
	Offline    bool        `codec:"offline" json:"offline"`
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o MarkAsReadLocalRes) DeepCopy() MarkAsReadLocalRes {
	return MarkAsReadLocalRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type MarkTLFAsReadLocalRes struct {
	Offline    bool        `codec:"offline" json:"offline"`
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o MarkTLFAsReadLocalRes) DeepCopy() MarkTLFAsReadLocalRes {
	return MarkTLFAsReadLocalRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type FindConversationsLocalRes struct {
	Conversations    []ConversationLocal           `codec:"conversations" json:"conversations"`
	UiConversations  []InboxUIItem                 `codec:"uiConversations" json:"uiConversations"`
	Offline          bool                          `codec:"offline" json:"offline"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o FindConversationsLocalRes) DeepCopy() FindConversationsLocalRes {
	return FindConversationsLocalRes{
		Conversations: (func(x []ConversationLocal) []ConversationLocal {
			if x == nil {
				return nil
			}
			ret := make([]ConversationLocal, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		UiConversations: (func(x []InboxUIItem) []InboxUIItem {
			if x == nil {
				return nil
			}
			ret := make([]InboxUIItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.UiConversations),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type JoinLeaveConversationLocalRes struct {
	Offline    bool        `codec:"offline" json:"offline"`
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o JoinLeaveConversationLocalRes) DeepCopy() JoinLeaveConversationLocalRes {
	return JoinLeaveConversationLocalRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type PreviewConversationLocalRes struct {
	Conv       InboxUIItem `codec:"conv" json:"conv"`
	Offline    bool        `codec:"offline" json:"offline"`
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o PreviewConversationLocalRes) DeepCopy() PreviewConversationLocalRes {
	return PreviewConversationLocalRes{
		Conv:    o.Conv.DeepCopy(),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type DeleteConversationLocalRes struct {
	Offline    bool        `codec:"offline" json:"offline"`
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o DeleteConversationLocalRes) DeepCopy() DeleteConversationLocalRes {
	return DeleteConversationLocalRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type RemoveFromConversationLocalRes struct {
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o RemoveFromConversationLocalRes) DeepCopy() RemoveFromConversationLocalRes {
	return RemoveFromConversationLocalRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type GetTLFConversationsLocalRes struct {
	Convs      []InboxUIItem `codec:"convs" json:"convs"`
	Offline    bool          `codec:"offline" json:"offline"`
	RateLimits []RateLimit   `codec:"rateLimits" json:"rateLimits"`
}

func (o GetTLFConversationsLocalRes) DeepCopy() GetTLFConversationsLocalRes {
	return GetTLFConversationsLocalRes{
		Convs: (func(x []InboxUIItem) []InboxUIItem {
			if x == nil {
				return nil
			}
			ret := make([]InboxUIItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Convs),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type GetChannelMembershipsLocalRes struct {
	Channels   []ChannelNameMention `codec:"channels" json:"channels"`
	Offline    bool                 `codec:"offline" json:"offline"`
	RateLimits []RateLimit          `codec:"rateLimits" json:"rateLimits"`
}

func (o GetChannelMembershipsLocalRes) DeepCopy() GetChannelMembershipsLocalRes {
	return GetChannelMembershipsLocalRes{
		Channels: (func(x []ChannelNameMention) []ChannelNameMention {
			if x == nil {
				return nil
			}
			ret := make([]ChannelNameMention, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Channels),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type GetMutualTeamsLocalRes struct {
	TeamIDs    []keybase1.TeamID `codec:"teamIDs" json:"teamIDs"`
	Offline    bool              `codec:"offline" json:"offline"`
	RateLimits []RateLimit       `codec:"rateLimits" json:"rateLimits"`
}

func (o GetMutualTeamsLocalRes) DeepCopy() GetMutualTeamsLocalRes {
	return GetMutualTeamsLocalRes{
		TeamIDs: (func(x []keybase1.TeamID) []keybase1.TeamID {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TeamID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.TeamIDs),
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type SetAppNotificationSettingsLocalRes struct {
	Offline    bool        `codec:"offline" json:"offline"`
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o SetAppNotificationSettingsLocalRes) DeepCopy() SetAppNotificationSettingsLocalRes {
	return SetAppNotificationSettingsLocalRes{
		Offline: o.Offline,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type AppNotificationSettingLocal struct {
	DeviceType keybase1.DeviceType `codec:"deviceType" json:"deviceType"`
	Kind       NotificationKind    `codec:"kind" json:"kind"`
	Enabled    bool                `codec:"enabled" json:"enabled"`
}

func (o AppNotificationSettingLocal) DeepCopy() AppNotificationSettingLocal {
	return AppNotificationSettingLocal{
		DeviceType: o.DeviceType.DeepCopy(),
		Kind:       o.Kind.DeepCopy(),
		Enabled:    o.Enabled,
	}
}

type ResetConvMember struct {
	Username string         `codec:"username" json:"username"`
	Uid      gregor1.UID    `codec:"uid" json:"uid"`
	Conv     ConversationID `codec:"conv" json:"conv"`
}

func (o ResetConvMember) DeepCopy() ResetConvMember {
	return ResetConvMember{
		Username: o.Username,
		Uid:      o.Uid.DeepCopy(),
		Conv:     o.Conv.DeepCopy(),
	}
}

type GetAllResetConvMembersRes struct {
	Members    []ResetConvMember `codec:"members" json:"members"`
	RateLimits []RateLimit       `codec:"rateLimits" json:"rateLimits"`
}

func (o GetAllResetConvMembersRes) DeepCopy() GetAllResetConvMembersRes {
	return GetAllResetConvMembersRes{
		Members: (func(x []ResetConvMember) []ResetConvMember {
			if x == nil {
				return nil
			}
			ret := make([]ResetConvMember, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Members),
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type SearchRegexpRes struct {
	Offline          bool                          `codec:"offline" json:"offline"`
	Hits             []ChatSearchHit               `codec:"hits" json:"hits"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o SearchRegexpRes) DeepCopy() SearchRegexpRes {
	return SearchRegexpRes{
		Offline: o.Offline,
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
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type SearchInboxRes struct {
	Offline          bool                          `codec:"offline" json:"offline"`
	Res              *ChatSearchInboxResults       `codec:"res,omitempty" json:"res,omitempty"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o SearchInboxRes) DeepCopy() SearchInboxRes {
	return SearchInboxRes{
		Offline: o.Offline,
		Res: (func(x *ChatSearchInboxResults) *ChatSearchInboxResults {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Res),
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type SimpleSearchInboxConvNamesHit struct {
	Name    string         `codec:"name" json:"name"`
	ConvID  ConversationID `codec:"convID" json:"convID"`
	IsTeam  bool           `codec:"isTeam" json:"isTeam"`
	Parts   []string       `codec:"parts" json:"parts"`
	TlfName string         `codec:"tlfName" json:"tlfName"`
}

func (o SimpleSearchInboxConvNamesHit) DeepCopy() SimpleSearchInboxConvNamesHit {
	return SimpleSearchInboxConvNamesHit{
		Name:   o.Name,
		ConvID: o.ConvID.DeepCopy(),
		IsTeam: o.IsTeam,
		Parts: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Parts),
		TlfName: o.TlfName,
	}
}

type ProfileSearchConvStats struct {
	Err            string               `codec:"err" json:"err"`
	ConvName       string               `codec:"convName" json:"convName"`
	MinConvID      MessageID            `codec:"minConvID" json:"minConvID"`
	MaxConvID      MessageID            `codec:"maxConvID" json:"maxConvID"`
	NumMissing     int                  `codec:"numMissing" json:"numMissing"`
	NumMessages    int                  `codec:"numMessages" json:"numMessages"`
	IndexSizeDisk  int                  `codec:"indexSizeDisk" json:"indexSizeDisk"`
	IndexSizeMem   int64                `codec:"indexSizeMem" json:"indexSizeMem"`
	DurationMsec   gregor1.DurationMsec `codec:"durationMsec" json:"durationMsec"`
	PercentIndexed int                  `codec:"percentIndexed" json:"percentIndexed"`
}

func (o ProfileSearchConvStats) DeepCopy() ProfileSearchConvStats {
	return ProfileSearchConvStats{
		Err:            o.Err,
		ConvName:       o.ConvName,
		MinConvID:      o.MinConvID.DeepCopy(),
		MaxConvID:      o.MaxConvID.DeepCopy(),
		NumMissing:     o.NumMissing,
		NumMessages:    o.NumMessages,
		IndexSizeDisk:  o.IndexSizeDisk,
		IndexSizeMem:   o.IndexSizeMem,
		DurationMsec:   o.DurationMsec.DeepCopy(),
		PercentIndexed: o.PercentIndexed,
	}
}

type BuiltinCommandGroup struct {
	Typ      ConversationBuiltinCommandTyp `codec:"typ" json:"typ"`
	Commands []ConversationCommand         `codec:"commands" json:"commands"`
}

func (o BuiltinCommandGroup) DeepCopy() BuiltinCommandGroup {
	return BuiltinCommandGroup{
		Typ: o.Typ.DeepCopy(),
		Commands: (func(x []ConversationCommand) []ConversationCommand {
			if x == nil {
				return nil
			}
			ret := make([]ConversationCommand, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Commands),
	}
}

type StaticConfig struct {
	DeletableByDeleteHistory []MessageType         `codec:"deletableByDeleteHistory" json:"deletableByDeleteHistory"`
	BuiltinCommands          []BuiltinCommandGroup `codec:"builtinCommands" json:"builtinCommands"`
}

func (o StaticConfig) DeepCopy() StaticConfig {
	return StaticConfig{
		DeletableByDeleteHistory: (func(x []MessageType) []MessageType {
			if x == nil {
				return nil
			}
			ret := make([]MessageType, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.DeletableByDeleteHistory),
		BuiltinCommands: (func(x []BuiltinCommandGroup) []BuiltinCommandGroup {
			if x == nil {
				return nil
			}
			ret := make([]BuiltinCommandGroup, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.BuiltinCommands),
	}
}

type UnfurlPromptAction int

const (
	UnfurlPromptAction_ALWAYS  UnfurlPromptAction = 0
	UnfurlPromptAction_NEVER   UnfurlPromptAction = 1
	UnfurlPromptAction_ACCEPT  UnfurlPromptAction = 2
	UnfurlPromptAction_NOTNOW  UnfurlPromptAction = 3
	UnfurlPromptAction_ONETIME UnfurlPromptAction = 4
)

func (o UnfurlPromptAction) DeepCopy() UnfurlPromptAction { return o }

var UnfurlPromptActionMap = map[string]UnfurlPromptAction{
	"ALWAYS":  0,
	"NEVER":   1,
	"ACCEPT":  2,
	"NOTNOW":  3,
	"ONETIME": 4,
}

var UnfurlPromptActionRevMap = map[UnfurlPromptAction]string{
	0: "ALWAYS",
	1: "NEVER",
	2: "ACCEPT",
	3: "NOTNOW",
	4: "ONETIME",
}

func (e UnfurlPromptAction) String() string {
	if v, ok := UnfurlPromptActionRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UnfurlPromptResult struct {
	ActionType__ UnfurlPromptAction `codec:"actionType" json:"actionType"`
	Accept__     *string            `codec:"accept,omitempty" json:"accept,omitempty"`
	Onetime__    *string            `codec:"onetime,omitempty" json:"onetime,omitempty"`
}

func (o *UnfurlPromptResult) ActionType() (ret UnfurlPromptAction, err error) {
	switch o.ActionType__ {
	case UnfurlPromptAction_ACCEPT:
		if o.Accept__ == nil {
			err = errors.New("unexpected nil value for Accept__")
			return ret, err
		}
	case UnfurlPromptAction_ONETIME:
		if o.Onetime__ == nil {
			err = errors.New("unexpected nil value for Onetime__")
			return ret, err
		}
	}
	return o.ActionType__, nil
}

func (o UnfurlPromptResult) Accept() (res string) {
	if o.ActionType__ != UnfurlPromptAction_ACCEPT {
		panic("wrong case accessed")
	}
	if o.Accept__ == nil {
		return
	}
	return *o.Accept__
}

func (o UnfurlPromptResult) Onetime() (res string) {
	if o.ActionType__ != UnfurlPromptAction_ONETIME {
		panic("wrong case accessed")
	}
	if o.Onetime__ == nil {
		return
	}
	return *o.Onetime__
}

func NewUnfurlPromptResultWithAlways() UnfurlPromptResult {
	return UnfurlPromptResult{
		ActionType__: UnfurlPromptAction_ALWAYS,
	}
}

func NewUnfurlPromptResultWithNever() UnfurlPromptResult {
	return UnfurlPromptResult{
		ActionType__: UnfurlPromptAction_NEVER,
	}
}

func NewUnfurlPromptResultWithNotnow() UnfurlPromptResult {
	return UnfurlPromptResult{
		ActionType__: UnfurlPromptAction_NOTNOW,
	}
}

func NewUnfurlPromptResultWithAccept(v string) UnfurlPromptResult {
	return UnfurlPromptResult{
		ActionType__: UnfurlPromptAction_ACCEPT,
		Accept__:     &v,
	}
}

func NewUnfurlPromptResultWithOnetime(v string) UnfurlPromptResult {
	return UnfurlPromptResult{
		ActionType__: UnfurlPromptAction_ONETIME,
		Onetime__:    &v,
	}
}

func (o UnfurlPromptResult) DeepCopy() UnfurlPromptResult {
	return UnfurlPromptResult{
		ActionType__: o.ActionType__.DeepCopy(),
		Accept__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Accept__),
		Onetime__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Onetime__),
	}
}

type GalleryItemTyp int

const (
	GalleryItemTyp_MEDIA GalleryItemTyp = 0
	GalleryItemTyp_LINK  GalleryItemTyp = 1
	GalleryItemTyp_DOC   GalleryItemTyp = 2
)

func (o GalleryItemTyp) DeepCopy() GalleryItemTyp { return o }

var GalleryItemTypMap = map[string]GalleryItemTyp{
	"MEDIA": 0,
	"LINK":  1,
	"DOC":   2,
}

var GalleryItemTypRevMap = map[GalleryItemTyp]string{
	0: "MEDIA",
	1: "LINK",
	2: "DOC",
}

func (e GalleryItemTyp) String() string {
	if v, ok := GalleryItemTypRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type LoadGalleryRes struct {
	Messages         []UIMessage                   `codec:"messages" json:"messages"`
	Last             bool                          `codec:"last" json:"last"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o LoadGalleryRes) DeepCopy() LoadGalleryRes {
	return LoadGalleryRes{
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
		Last: o.Last,
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type LoadFlipRes struct {
	Status           UICoinFlipStatus              `codec:"status" json:"status"`
	RateLimits       []RateLimit                   `codec:"rateLimits" json:"rateLimits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures" json:"identifyFailures"`
}

func (o LoadFlipRes) DeepCopy() LoadFlipRes {
	return LoadFlipRes{
		Status: o.Status.DeepCopy(),
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
		IdentifyFailures: (func(x []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
			if x == nil {
				return nil
			}
			ret := make([]keybase1.TLFIdentifyFailure, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IdentifyFailures),
	}
}

type UserBotExtendedDescription struct {
	Title       string `codec:"title" json:"title"`
	DesktopBody string `codec:"desktopBody" json:"desktop_body"`
	MobileBody  string `codec:"mobileBody" json:"mobile_body"`
}

func (o UserBotExtendedDescription) DeepCopy() UserBotExtendedDescription {
	return UserBotExtendedDescription{
		Title:       o.Title,
		DesktopBody: o.DesktopBody,
		MobileBody:  o.MobileBody,
	}
}

type UserBotCommandOutput struct {
	Name                string                      `codec:"name" json:"name"`
	Description         string                      `codec:"description" json:"description"`
	Usage               string                      `codec:"usage" json:"usage"`
	ExtendedDescription *UserBotExtendedDescription `codec:"extendedDescription,omitempty" json:"extended_description,omitempty"`
	Username            string                      `codec:"username" json:"username"`
}

func (o UserBotCommandOutput) DeepCopy() UserBotCommandOutput {
	return UserBotCommandOutput{
		Name:        o.Name,
		Description: o.Description,
		Usage:       o.Usage,
		ExtendedDescription: (func(x *UserBotExtendedDescription) *UserBotExtendedDescription {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ExtendedDescription),
		Username: o.Username,
	}
}

type UserBotCommandInput struct {
	Name                string                      `codec:"name" json:"name"`
	Description         string                      `codec:"description" json:"description"`
	Usage               string                      `codec:"usage" json:"usage"`
	ExtendedDescription *UserBotExtendedDescription `codec:"extendedDescription,omitempty" json:"extended_description,omitempty"`
}

func (o UserBotCommandInput) DeepCopy() UserBotCommandInput {
	return UserBotCommandInput{
		Name:        o.Name,
		Description: o.Description,
		Usage:       o.Usage,
		ExtendedDescription: (func(x *UserBotExtendedDescription) *UserBotExtendedDescription {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ExtendedDescription),
	}
}

type AdvertiseCommandsParam struct {
	Typ      BotCommandsAdvertisementTyp `codec:"typ" json:"typ"`
	Commands []UserBotCommandInput       `codec:"commands" json:"commands"`
	TeamName *string                     `codec:"teamName,omitempty" json:"teamName,omitempty"`
	ConvID   *ConversationID             `codec:"convID,omitempty" json:"convID,omitempty"`
}

func (o AdvertiseCommandsParam) DeepCopy() AdvertiseCommandsParam {
	return AdvertiseCommandsParam{
		Typ: o.Typ.DeepCopy(),
		Commands: (func(x []UserBotCommandInput) []UserBotCommandInput {
			if x == nil {
				return nil
			}
			ret := make([]UserBotCommandInput, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Commands),
		TeamName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.TeamName),
		ConvID: (func(x *ConversationID) *ConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvID),
	}
}

type AdvertiseBotCommandsLocalRes struct {
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o AdvertiseBotCommandsLocalRes) DeepCopy() AdvertiseBotCommandsLocalRes {
	return AdvertiseBotCommandsLocalRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type ListBotCommandsLocalRes struct {
	Commands   []UserBotCommandOutput `codec:"commands" json:"commands"`
	RateLimits []RateLimit            `codec:"rateLimits" json:"rateLimits"`
}

func (o ListBotCommandsLocalRes) DeepCopy() ListBotCommandsLocalRes {
	return ListBotCommandsLocalRes{
		Commands: (func(x []UserBotCommandOutput) []UserBotCommandOutput {
			if x == nil {
				return nil
			}
			ret := make([]UserBotCommandOutput, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Commands),
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type ClearBotCommandsFilter struct {
	Typ      BotCommandsAdvertisementTyp `codec:"typ" json:"typ"`
	TeamName *string                     `codec:"teamName,omitempty" json:"teamName,omitempty"`
	ConvID   *ConversationID             `codec:"convID,omitempty" json:"convID,omitempty"`
}

func (o ClearBotCommandsFilter) DeepCopy() ClearBotCommandsFilter {
	return ClearBotCommandsFilter{
		Typ: o.Typ.DeepCopy(),
		TeamName: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.TeamName),
		ConvID: (func(x *ConversationID) *ConversationID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConvID),
	}
}

type ClearBotCommandsLocalRes struct {
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o ClearBotCommandsLocalRes) DeepCopy() ClearBotCommandsLocalRes {
	return ClearBotCommandsLocalRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type PinMessageRes struct {
	RateLimits []RateLimit `codec:"rateLimits" json:"rateLimits"`
}

func (o PinMessageRes) DeepCopy() PinMessageRes {
	return PinMessageRes{
		RateLimits: (func(x []RateLimit) []RateLimit {
			if x == nil {
				return nil
			}
			ret := make([]RateLimit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type ConvSearchHit struct {
	Name   string         `codec:"name" json:"name"`
	ConvID ConversationID `codec:"convID" json:"convID"`
	IsTeam bool           `codec:"isTeam" json:"isTeam"`
	Parts  []string       `codec:"parts" json:"parts"`
}

func (o ConvSearchHit) DeepCopy() ConvSearchHit {
	return ConvSearchHit{
		Name:   o.Name,
		ConvID: o.ConvID.DeepCopy(),
		IsTeam: o.IsTeam,
		Parts: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Parts),
	}
}

type LocalMtimeUpdate struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Mtime  gregor1.Time   `codec:"mtime" json:"mtime"`
}

func (o LocalMtimeUpdate) DeepCopy() LocalMtimeUpdate {
	return LocalMtimeUpdate{
		ConvID: o.ConvID.DeepCopy(),
		Mtime:  o.Mtime.DeepCopy(),
	}
}

type SnippetDecoration int

const (
	SnippetDecoration_NONE                   SnippetDecoration = 0
	SnippetDecoration_PENDING_MESSAGE        SnippetDecoration = 1
	SnippetDecoration_FAILED_PENDING_MESSAGE SnippetDecoration = 2
	SnippetDecoration_EXPLODING_MESSAGE      SnippetDecoration = 3
	SnippetDecoration_EXPLODED_MESSAGE       SnippetDecoration = 4
	SnippetDecoration_AUDIO_ATTACHMENT       SnippetDecoration = 5
	SnippetDecoration_VIDEO_ATTACHMENT       SnippetDecoration = 6
	SnippetDecoration_PHOTO_ATTACHMENT       SnippetDecoration = 7
	SnippetDecoration_FILE_ATTACHMENT        SnippetDecoration = 8
	SnippetDecoration_STELLAR_RECEIVED       SnippetDecoration = 9
	SnippetDecoration_STELLAR_SENT           SnippetDecoration = 10
	SnippetDecoration_PINNED_MESSAGE         SnippetDecoration = 11
)

func (o SnippetDecoration) DeepCopy() SnippetDecoration { return o }

var SnippetDecorationMap = map[string]SnippetDecoration{
	"NONE":                   0,
	"PENDING_MESSAGE":        1,
	"FAILED_PENDING_MESSAGE": 2,
	"EXPLODING_MESSAGE":      3,
	"EXPLODED_MESSAGE":       4,
	"AUDIO_ATTACHMENT":       5,
	"VIDEO_ATTACHMENT":       6,
	"PHOTO_ATTACHMENT":       7,
	"FILE_ATTACHMENT":        8,
	"STELLAR_RECEIVED":       9,
	"STELLAR_SENT":           10,
	"PINNED_MESSAGE":         11,
}

var SnippetDecorationRevMap = map[SnippetDecoration]string{
	0:  "NONE",
	1:  "PENDING_MESSAGE",
	2:  "FAILED_PENDING_MESSAGE",
	3:  "EXPLODING_MESSAGE",
	4:  "EXPLODED_MESSAGE",
	5:  "AUDIO_ATTACHMENT",
	6:  "VIDEO_ATTACHMENT",
	7:  "PHOTO_ATTACHMENT",
	8:  "FILE_ATTACHMENT",
	9:  "STELLAR_RECEIVED",
	10: "STELLAR_SENT",
	11: "PINNED_MESSAGE",
}

func (e SnippetDecoration) String() string {
	if v, ok := SnippetDecorationRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type WelcomeMessageDisplay struct {
	Set     bool   `codec:"set" json:"set"`
	Display string `codec:"display" json:"display"`
	Raw     string `codec:"raw" json:"raw"`
}

func (o WelcomeMessageDisplay) DeepCopy() WelcomeMessageDisplay {
	return WelcomeMessageDisplay{
		Set:     o.Set,
		Display: o.Display,
		Raw:     o.Raw,
	}
}

type WelcomeMessage struct {
	Set bool   `codec:"set" json:"set"`
	Raw string `codec:"raw" json:"raw"`
}

func (o WelcomeMessage) DeepCopy() WelcomeMessage {
	return WelcomeMessage{
		Set: o.Set,
		Raw: o.Raw,
	}
}

type GetDefaultTeamChannelsLocalRes struct {
	Convs     []InboxUIItem `codec:"convs" json:"convs"`
	RateLimit *RateLimit    `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o GetDefaultTeamChannelsLocalRes) DeepCopy() GetDefaultTeamChannelsLocalRes {
	return GetDefaultTeamChannelsLocalRes{
		Convs: (func(x []InboxUIItem) []InboxUIItem {
			if x == nil {
				return nil
			}
			ret := make([]InboxUIItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Convs),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type SetDefaultTeamChannelsLocalRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o SetDefaultTeamChannelsLocalRes) DeepCopy() SetDefaultTeamChannelsLocalRes {
	return SetDefaultTeamChannelsLocalRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type LastActiveTimeAll struct {
	Teams    map[TLFIDStr]gregor1.Time  `codec:"teams" json:"teams"`
	Channels map[ConvIDStr]gregor1.Time `codec:"channels" json:"channels"`
}

func (o LastActiveTimeAll) DeepCopy() LastActiveTimeAll {
	return LastActiveTimeAll{
		Teams: (func(x map[TLFIDStr]gregor1.Time) map[TLFIDStr]gregor1.Time {
			if x == nil {
				return nil
			}
			ret := make(map[TLFIDStr]gregor1.Time, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Teams),
		Channels: (func(x map[ConvIDStr]gregor1.Time) map[ConvIDStr]gregor1.Time {
			if x == nil {
				return nil
			}
			ret := make(map[ConvIDStr]gregor1.Time, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Channels),
	}
}

type LastActiveStatusAll struct {
	Teams    map[TLFIDStr]LastActiveStatus  `codec:"teams" json:"teams"`
	Channels map[ConvIDStr]LastActiveStatus `codec:"channels" json:"channels"`
}

func (o LastActiveStatusAll) DeepCopy() LastActiveStatusAll {
	return LastActiveStatusAll{
		Teams: (func(x map[TLFIDStr]LastActiveStatus) map[TLFIDStr]LastActiveStatus {
			if x == nil {
				return nil
			}
			ret := make(map[TLFIDStr]LastActiveStatus, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Teams),
		Channels: (func(x map[ConvIDStr]LastActiveStatus) map[ConvIDStr]LastActiveStatus {
			if x == nil {
				return nil
			}
			ret := make(map[ConvIDStr]LastActiveStatus, len(x))
			for k, v := range x {
				kCopy := k.DeepCopy()
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Channels),
	}
}

type EmojiError struct {
	Clidisplay string `codec:"clidisplay" json:"clidisplay"`
	Uidisplay  string `codec:"uidisplay" json:"uidisplay"`
}

func (o EmojiError) DeepCopy() EmojiError {
	return EmojiError{
		Clidisplay: o.Clidisplay,
		Uidisplay:  o.Uidisplay,
	}
}

type AddEmojiRes struct {
	RateLimit *RateLimit  `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
	Error     *EmojiError `codec:"error,omitempty" json:"error,omitempty"`
}

func (o AddEmojiRes) DeepCopy() AddEmojiRes {
	return AddEmojiRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
		Error: (func(x *EmojiError) *EmojiError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Error),
	}
}

type AddEmojisRes struct {
	RateLimit        *RateLimit            `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
	SuccessFilenames []string              `codec:"successFilenames" json:"successFilenames"`
	FailedFilenames  map[string]EmojiError `codec:"failedFilenames" json:"failedFilenames"`
}

func (o AddEmojisRes) DeepCopy() AddEmojisRes {
	return AddEmojisRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
		SuccessFilenames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.SuccessFilenames),
		FailedFilenames: (func(x map[string]EmojiError) map[string]EmojiError {
			if x == nil {
				return nil
			}
			ret := make(map[string]EmojiError, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.FailedFilenames),
	}
}

type AddEmojiAliasRes struct {
	RateLimit *RateLimit  `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
	Error     *EmojiError `codec:"error,omitempty" json:"error,omitempty"`
}

func (o AddEmojiAliasRes) DeepCopy() AddEmojiAliasRes {
	return AddEmojiAliasRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
		Error: (func(x *EmojiError) *EmojiError {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Error),
	}
}

type RemoveEmojiRes struct {
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o RemoveEmojiRes) DeepCopy() RemoveEmojiRes {
	return RemoveEmojiRes{
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type UserEmojiRes struct {
	Emojis    UserEmojis `codec:"emojis" json:"emojis"`
	RateLimit *RateLimit `codec:"rateLimit,omitempty" json:"rateLimit,omitempty"`
}

func (o UserEmojiRes) DeepCopy() UserEmojiRes {
	return UserEmojiRes{
		Emojis: o.Emojis.DeepCopy(),
		RateLimit: (func(x *RateLimit) *RateLimit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RateLimit),
	}
}

type EmojiFetchOpts struct {
	GetCreationInfo bool `codec:"getCreationInfo" json:"getCreationInfo"`
	GetAliases      bool `codec:"getAliases" json:"getAliases"`
	OnlyInTeam      bool `codec:"onlyInTeam" json:"onlyInTeam"`
}

func (o EmojiFetchOpts) DeepCopy() EmojiFetchOpts {
	return EmojiFetchOpts{
		GetCreationInfo: o.GetCreationInfo,
		GetAliases:      o.GetAliases,
		OnlyInTeam:      o.OnlyInTeam,
	}
}

type GetThreadLocalArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	Reason           GetThreadReason              `codec:"reason" json:"reason"`
	Query            *GetThreadQuery              `codec:"query,omitempty" json:"query,omitempty"`
	Pagination       *Pagination                  `codec:"pagination,omitempty" json:"pagination,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetThreadNonblockArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	CbMode           GetThreadNonblockCbMode      `codec:"cbMode" json:"cbMode"`
	Reason           GetThreadReason              `codec:"reason" json:"reason"`
	Pgmode           GetThreadNonblockPgMode      `codec:"pgmode" json:"pgmode"`
	Query            *GetThreadQuery              `codec:"query,omitempty" json:"query,omitempty"`
	KnownRemotes     []string                     `codec:"knownRemotes" json:"knownRemotes"`
	Pagination       *UIPagination                `codec:"pagination,omitempty" json:"pagination,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetUnreadlineArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	ConvID           ConversationID               `codec:"convID" json:"convID"`
	ReadMsgID        MessageID                    `codec:"readMsgID" json:"readMsgID"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetInboxAndUnboxLocalArg struct {
	Query            *GetInboxLocalQuery          `codec:"query,omitempty" json:"query,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetInboxAndUnboxUILocalArg struct {
	Query            *GetInboxLocalQuery          `codec:"query,omitempty" json:"query,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type RequestInboxLayoutArg struct {
	ReselectMode InboxLayoutReselectMode `codec:"reselectMode" json:"reselectMode"`
}

type RequestInboxUnboxArg struct {
	ConvIDs []ConversationID `codec:"convIDs" json:"convIDs"`
}

type RequestInboxSmallIncreaseArg struct {
}

type RequestInboxSmallResetArg struct {
}

type GetInboxNonblockLocalArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	MaxUnbox         *int                         `codec:"maxUnbox,omitempty" json:"maxUnbox,omitempty"`
	SkipUnverified   bool                         `codec:"skipUnverified" json:"skipUnverified"`
	Query            *GetInboxLocalQuery          `codec:"query,omitempty" json:"query,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostLocalArg struct {
	SessionID          int                          `codec:"sessionID" json:"sessionID"`
	ConversationID     ConversationID               `codec:"conversationID" json:"conversationID"`
	Msg                MessagePlaintext             `codec:"msg" json:"msg"`
	ReplyTo            *MessageID                   `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	IdentifyBehavior   keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	SkipInChatPayments bool                         `codec:"skipInChatPayments" json:"skipInChatPayments"`
}

type GenerateOutboxIDArg struct {
}

type PostLocalNonblockArg struct {
	SessionID          int                          `codec:"sessionID" json:"sessionID"`
	ConversationID     ConversationID               `codec:"conversationID" json:"conversationID"`
	Msg                MessagePlaintext             `codec:"msg" json:"msg"`
	ClientPrev         MessageID                    `codec:"clientPrev" json:"clientPrev"`
	OutboxID           *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	ReplyTo            *MessageID                   `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	IdentifyBehavior   keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	SkipInChatPayments bool                         `codec:"skipInChatPayments" json:"skipInChatPayments"`
}

type ForwardMessageArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	SrcConvID        ConversationID               `codec:"srcConvID" json:"srcConvID"`
	DstConvID        ConversationID               `codec:"dstConvID" json:"dstConvID"`
	MsgID            MessageID                    `codec:"msgID" json:"msgID"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	Title            string                       `codec:"title" json:"title"`
}

type ForwardMessageNonblockArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	SrcConvID        ConversationID               `codec:"srcConvID" json:"srcConvID"`
	DstConvID        ConversationID               `codec:"dstConvID" json:"dstConvID"`
	MsgID            MessageID                    `codec:"msgID" json:"msgID"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	Title            string                       `codec:"title" json:"title"`
}

type PostTextNonblockArg struct {
	SessionID         int                          `codec:"sessionID" json:"sessionID"`
	ConversationID    ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName           string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic         bool                         `codec:"tlfPublic" json:"tlfPublic"`
	Body              string                       `codec:"body" json:"body"`
	ClientPrev        MessageID                    `codec:"clientPrev" json:"clientPrev"`
	ReplyTo           *MessageID                   `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	OutboxID          *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	IdentifyBehavior  keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	EphemeralLifetime *gregor1.DurationSec         `codec:"ephemeralLifetime,omitempty" json:"ephemeralLifetime,omitempty"`
}

type PostDeleteNonblockArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	Supersedes       MessageID                    `codec:"supersedes" json:"supersedes"`
	ClientPrev       MessageID                    `codec:"clientPrev" json:"clientPrev"`
	OutboxID         *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostEditNonblockArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	Target           EditTarget                   `codec:"target" json:"target"`
	Body             string                       `codec:"body" json:"body"`
	OutboxID         *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	ClientPrev       MessageID                    `codec:"clientPrev" json:"clientPrev"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostReactionNonblockArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	Supersedes       MessageID                    `codec:"supersedes" json:"supersedes"`
	Body             string                       `codec:"body" json:"body"`
	OutboxID         *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	ClientPrev       MessageID                    `codec:"clientPrev" json:"clientPrev"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostHeadlineNonblockArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	Headline         string                       `codec:"headline" json:"headline"`
	OutboxID         *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	ClientPrev       MessageID                    `codec:"clientPrev" json:"clientPrev"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostHeadlineArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	Headline         string                       `codec:"headline" json:"headline"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostMetadataNonblockArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	ChannelName      string                       `codec:"channelName" json:"channelName"`
	OutboxID         *OutboxID                    `codec:"outboxID,omitempty" json:"outboxID,omitempty"`
	ClientPrev       MessageID                    `codec:"clientPrev" json:"clientPrev"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostMetadataArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	ChannelName      string                       `codec:"channelName" json:"channelName"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostDeleteHistoryUptoArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	Upto             MessageID                    `codec:"upto" json:"upto"`
}

type PostDeleteHistoryThroughArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	Through          MessageID                    `codec:"through" json:"through"`
}

type PostDeleteHistoryByAgeArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TlfPublic        bool                         `codec:"tlfPublic" json:"tlfPublic"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
	Age              gregor1.DurationSec          `codec:"age" json:"age"`
}

type SetConversationStatusLocalArg struct {
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	Status           ConversationStatus           `codec:"status" json:"status"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type NewConversationsLocalArg struct {
	NewConversationLocalArguments []NewConversationLocalArgument `codec:"newConversationLocalArguments" json:"newConversationLocalArguments"`
	IdentifyBehavior              keybase1.TLFIdentifyBehavior   `codec:"identifyBehavior" json:"identifyBehavior"`
}

type NewConversationLocalArg struct {
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	TopicType        TopicType                    `codec:"topicType" json:"topicType"`
	TlfVisibility    keybase1.TLFVisibility       `codec:"tlfVisibility" json:"tlfVisibility"`
	TopicName        *string                      `codec:"topicName,omitempty" json:"topicName,omitempty"`
	MembersType      ConversationMembersType      `codec:"membersType" json:"membersType"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetInboxSummaryForCLILocalArg struct {
	Query GetInboxSummaryForCLILocalQuery `codec:"query" json:"query"`
}

type GetConversationForCLILocalArg struct {
	Query GetConversationForCLILocalQuery `codec:"query" json:"query"`
}

type GetMessagesLocalArg struct {
	ConversationID           ConversationID               `codec:"conversationID" json:"conversationID"`
	MessageIDs               []MessageID                  `codec:"messageIDs" json:"messageIDs"`
	DisableResolveSupersedes bool                         `codec:"disableResolveSupersedes" json:"disableResolveSupersedes"`
	IdentifyBehavior         keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type PostFileAttachmentLocalArg struct {
	SessionID int                   `codec:"sessionID" json:"sessionID"`
	Arg       PostFileAttachmentArg `codec:"arg" json:"arg"`
}

type PostFileAttachmentLocalNonblockArg struct {
	SessionID  int                   `codec:"sessionID" json:"sessionID"`
	Arg        PostFileAttachmentArg `codec:"arg" json:"arg"`
	ClientPrev MessageID             `codec:"clientPrev" json:"clientPrev"`
}

type GetNextAttachmentMessageLocalArg struct {
	ConvID           ConversationID               `codec:"convID" json:"convID"`
	MessageID        MessageID                    `codec:"messageID" json:"messageID"`
	BackInTime       bool                         `codec:"backInTime" json:"backInTime"`
	AssetTypes       []AssetMetadataType          `codec:"assetTypes" json:"assetTypes"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type DownloadAttachmentLocalArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	MessageID        MessageID                    `codec:"messageID" json:"messageID"`
	Sink             keybase1.Stream              `codec:"sink" json:"sink"`
	Preview          bool                         `codec:"preview" json:"preview"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type DownloadFileAttachmentLocalArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	ConversationID   ConversationID               `codec:"conversationID" json:"conversationID"`
	MessageID        MessageID                    `codec:"messageID" json:"messageID"`
	DownloadToCache  bool                         `codec:"downloadToCache" json:"downloadToCache"`
	Preview          bool                         `codec:"preview" json:"preview"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type ConfigureFileAttachmentDownloadLocalArg struct {
	CacheDirOverride    string `codec:"cacheDirOverride" json:"cacheDirOverride"`
	DownloadDirOverride string `codec:"downloadDirOverride" json:"downloadDirOverride"`
}

type MakePreviewArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Filename  string   `codec:"filename" json:"filename"`
	OutboxID  OutboxID `codec:"outboxID" json:"outboxID"`
}

type MakeAudioPreviewArg struct {
	Amps     []float64 `codec:"amps" json:"amps"`
	Duration int       `codec:"duration" json:"duration"`
}

type GetUploadTempFileArg struct {
	OutboxID OutboxID `codec:"outboxID" json:"outboxID"`
	Filename string   `codec:"filename" json:"filename"`
}

type MakeUploadTempFileArg struct {
	OutboxID OutboxID `codec:"outboxID" json:"outboxID"`
	Filename string   `codec:"filename" json:"filename"`
	Data     []byte   `codec:"data" json:"data"`
}

type CancelUploadTempFileArg struct {
	OutboxID OutboxID `codec:"outboxID" json:"outboxID"`
}

type CancelPostArg struct {
	OutboxID OutboxID `codec:"outboxID" json:"outboxID"`
}

type RetryPostArg struct {
	OutboxID         OutboxID                      `codec:"outboxID" json:"outboxID"`
	IdentifyBehavior *keybase1.TLFIdentifyBehavior `codec:"identifyBehavior,omitempty" json:"identifyBehavior,omitempty"`
}

type MarkAsReadLocalArg struct {
	SessionID      int            `codec:"sessionID" json:"sessionID"`
	ConversationID ConversationID `codec:"conversationID" json:"conversationID"`
	MsgID          *MessageID     `codec:"msgID,omitempty" json:"msgID,omitempty"`
	ForceUnread    bool           `codec:"forceUnread" json:"forceUnread"`
}

type MarkTLFAsReadLocalArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	TlfID     TLFID `codec:"tlfID" json:"tlfID"`
}

type FindConversationsLocalArg struct {
	TlfName          string                       `codec:"tlfName" json:"tlfName"`
	MembersType      ConversationMembersType      `codec:"membersType" json:"membersType"`
	Visibility       keybase1.TLFVisibility       `codec:"visibility" json:"visibility"`
	TopicType        TopicType                    `codec:"topicType" json:"topicType"`
	TopicName        string                       `codec:"topicName" json:"topicName"`
	OneChatPerTLF    *bool                        `codec:"oneChatPerTLF,omitempty" json:"oneChatPerTLF,omitempty"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type FindGeneralConvFromTeamIDArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
}

type UpdateTypingArg struct {
	ConversationID ConversationID `codec:"conversationID" json:"conversationID"`
	Typing         bool           `codec:"typing" json:"typing"`
}

type UpdateUnsentTextArg struct {
	ConversationID ConversationID `codec:"conversationID" json:"conversationID"`
	TlfName        string         `codec:"tlfName" json:"tlfName"`
	Text           string         `codec:"text" json:"text"`
}

type JoinConversationLocalArg struct {
	TlfName    string                 `codec:"tlfName" json:"tlfName"`
	TopicType  TopicType              `codec:"topicType" json:"topicType"`
	Visibility keybase1.TLFVisibility `codec:"visibility" json:"visibility"`
	TopicName  string                 `codec:"topicName" json:"topicName"`
}

type JoinConversationByIDLocalArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type LeaveConversationLocalArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type PreviewConversationByIDLocalArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type DeleteConversationLocalArg struct {
	SessionID   int            `codec:"sessionID" json:"sessionID"`
	ConvID      ConversationID `codec:"convID" json:"convID"`
	ChannelName string         `codec:"channelName" json:"channelName"`
	Confirmed   bool           `codec:"confirmed" json:"confirmed"`
}

type RemoveFromConversationLocalArg struct {
	ConvID    ConversationID `codec:"convID" json:"convID"`
	Usernames []string       `codec:"usernames" json:"usernames"`
}

type GetTLFConversationsLocalArg struct {
	TlfName     string                  `codec:"tlfName" json:"tlfName"`
	TopicType   TopicType               `codec:"topicType" json:"topicType"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
}

type GetChannelMembershipsLocalArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
	Uid    gregor1.UID     `codec:"uid" json:"uid"`
}

type GetMutualTeamsLocalArg struct {
	Usernames []string `codec:"usernames" json:"usernames"`
}

type SetAppNotificationSettingsLocalArg struct {
	ConvID      ConversationID                `codec:"convID" json:"convID"`
	ChannelWide bool                          `codec:"channelWide" json:"channelWide"`
	Settings    []AppNotificationSettingLocal `codec:"settings" json:"settings"`
}

type SetGlobalAppNotificationSettingsLocalArg struct {
	Settings map[string]bool `codec:"settings" json:"settings"`
}

type GetGlobalAppNotificationSettingsLocalArg struct {
}

type UnboxMobilePushNotificationArg struct {
	Payload     string                  `codec:"payload" json:"payload"`
	ConvID      string                  `codec:"convID" json:"convID"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
	PushIDs     []string                `codec:"pushIDs" json:"pushIDs"`
	ShouldAck   bool                    `codec:"shouldAck" json:"shouldAck"`
}

type AddTeamMemberAfterResetArg struct {
	Username string         `codec:"username" json:"username"`
	ConvID   ConversationID `codec:"convID" json:"convID"`
}

type GetAllResetConvMembersArg struct {
}

type SetConvRetentionLocalArg struct {
	ConvID ConversationID  `codec:"convID" json:"convID"`
	Policy RetentionPolicy `codec:"policy" json:"policy"`
}

type SetTeamRetentionLocalArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
	Policy RetentionPolicy `codec:"policy" json:"policy"`
}

type GetTeamRetentionLocalArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
}

type SetConvMinWriterRoleLocalArg struct {
	ConvID ConversationID    `codec:"convID" json:"convID"`
	Role   keybase1.TeamRole `codec:"role" json:"role"`
}

type UpgradeKBFSConversationToImpteamArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type SearchRegexpArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	ConvID           ConversationID               `codec:"convID" json:"convID"`
	Query            string                       `codec:"query" json:"query"`
	Opts             SearchOpts                   `codec:"opts" json:"opts"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type CancelActiveInboxSearchArg struct {
}

type SearchInboxArg struct {
	SessionID        int                          `codec:"sessionID" json:"sessionID"`
	Query            string                       `codec:"query" json:"query"`
	Opts             SearchOpts                   `codec:"opts" json:"opts"`
	NamesOnly        bool                         `codec:"namesOnly" json:"namesOnly"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type SimpleSearchInboxConvNamesArg struct {
	Query string `codec:"query" json:"query"`
}

type CancelActiveSearchArg struct {
}

type ProfileChatSearchArg struct {
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetStaticConfigArg struct {
}

type ResolveUnfurlPromptArg struct {
	ConvID           ConversationID               `codec:"convID" json:"convID"`
	MsgID            MessageID                    `codec:"msgID" json:"msgID"`
	Result           UnfurlPromptResult           `codec:"result" json:"result"`
	IdentifyBehavior keybase1.TLFIdentifyBehavior `codec:"identifyBehavior" json:"identifyBehavior"`
}

type GetUnfurlSettingsArg struct {
}

type SaveUnfurlSettingsArg struct {
	Mode      UnfurlMode `codec:"mode" json:"mode"`
	Whitelist []string   `codec:"whitelist" json:"whitelist"`
}

type ToggleMessageCollapseArg struct {
	ConvID   ConversationID `codec:"convID" json:"convID"`
	MsgID    MessageID      `codec:"msgID" json:"msgID"`
	Collapse bool           `codec:"collapse" json:"collapse"`
}

type BulkAddToConvArg struct {
	ConvID    ConversationID `codec:"convID" json:"convID"`
	Usernames []string       `codec:"usernames" json:"usernames"`
}

type BulkAddToManyConvsArg struct {
	Conversations []ConversationID `codec:"conversations" json:"conversations"`
	Usernames     []string         `codec:"usernames" json:"usernames"`
}

type PutReacjiSkinToneArg struct {
	SkinTone keybase1.ReacjiSkinTone `codec:"skinTone" json:"skinTone"`
}

type ResolveMaybeMentionArg struct {
	Mention MaybeMention `codec:"mention" json:"mention"`
}

type LoadGalleryArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	ConvID    ConversationID `codec:"convID" json:"convID"`
	Typ       GalleryItemTyp `codec:"typ" json:"typ"`
	Num       int            `codec:"num" json:"num"`
	FromMsgID *MessageID     `codec:"fromMsgID,omitempty" json:"fromMsgID,omitempty"`
}

type LoadFlipArg struct {
	HostConvID ConversationID `codec:"hostConvID" json:"hostConvID"`
	HostMsgID  MessageID      `codec:"hostMsgID" json:"hostMsgID"`
	FlipConvID ConversationID `codec:"flipConvID" json:"flipConvID"`
	GameID     FlipGameID     `codec:"gameID" json:"gameID"`
}

type LocationUpdateArg struct {
	Coord Coordinate `codec:"coord" json:"coord"`
}

type AdvertiseBotCommandsLocalArg struct {
	Alias          *string                  `codec:"alias,omitempty" json:"alias,omitempty"`
	Advertisements []AdvertiseCommandsParam `codec:"advertisements" json:"advertisements"`
}

type ListBotCommandsLocalArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type ListPublicBotCommandsLocalArg struct {
	Username string `codec:"username" json:"username"`
}

type ClearBotCommandsLocalArg struct {
	Filter *ClearBotCommandsFilter `codec:"filter,omitempty" json:"filter,omitempty"`
}

type PinMessageArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	MsgID  MessageID      `codec:"msgID" json:"msgID"`
}

type UnpinMessageArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type IgnorePinnedMessageArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type AddBotMemberArg struct {
	ConvID      ConversationID            `codec:"convID" json:"convID"`
	Username    string                    `codec:"username" json:"username"`
	BotSettings *keybase1.TeamBotSettings `codec:"botSettings,omitempty" json:"botSettings,omitempty"`
	Role        keybase1.TeamRole         `codec:"role" json:"role"`
}

type EditBotMemberArg struct {
	ConvID      ConversationID            `codec:"convID" json:"convID"`
	Username    string                    `codec:"username" json:"username"`
	BotSettings *keybase1.TeamBotSettings `codec:"botSettings,omitempty" json:"botSettings,omitempty"`
	Role        keybase1.TeamRole         `codec:"role" json:"role"`
}

type RemoveBotMemberArg struct {
	ConvID   ConversationID `codec:"convID" json:"convID"`
	Username string         `codec:"username" json:"username"`
}

type SetBotMemberSettingsArg struct {
	ConvID      ConversationID           `codec:"convID" json:"convID"`
	Username    string                   `codec:"username" json:"username"`
	BotSettings keybase1.TeamBotSettings `codec:"botSettings" json:"botSettings"`
}

type GetBotMemberSettingsArg struct {
	ConvID   ConversationID `codec:"convID" json:"convID"`
	Username string         `codec:"username" json:"username"`
}

type GetTeamRoleInConversationArg struct {
	ConvID   ConversationID `codec:"convID" json:"convID"`
	Username string         `codec:"username" json:"username"`
}

type AddBotConvSearchArg struct {
	Term string `codec:"term" json:"term"`
}

type ForwardMessageConvSearchArg struct {
	Term string `codec:"term" json:"term"`
}

type TeamIDFromTLFNameArg struct {
	TlfName     string                  `codec:"tlfName" json:"tlfName"`
	MembersType ConversationMembersType `codec:"membersType" json:"membersType"`
	TlfPublic   bool                    `codec:"tlfPublic" json:"tlfPublic"`
}

type DismissJourneycardArg struct {
	ConvID   ConversationID  `codec:"convID" json:"convID"`
	CardType JourneycardType `codec:"cardType" json:"cardType"`
}

type SetWelcomeMessageArg struct {
	TeamID  keybase1.TeamID `codec:"teamID" json:"teamID"`
	Message WelcomeMessage  `codec:"message" json:"message"`
}

type GetWelcomeMessageArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
}

type GetDefaultTeamChannelsLocalArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
}

type SetDefaultTeamChannelsLocalArg struct {
	TeamID keybase1.TeamID `codec:"teamID" json:"teamID"`
	Convs  []ConvIDStr     `codec:"convs" json:"convs"`
}

type GetLastActiveForTLFArg struct {
	TlfID TLFIDStr `codec:"tlfID" json:"tlfID"`
}

type GetLastActiveForTeamsArg struct {
}

type GetRecentJoinsLocalArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type RefreshParticipantsArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type GetLastActiveAtLocalArg struct {
	TeamID   keybase1.TeamID `codec:"teamID" json:"teamID"`
	Username string          `codec:"username" json:"username"`
}

type GetLastActiveAtMultiLocalArg struct {
	TeamIDs  []keybase1.TeamID `codec:"teamIDs" json:"teamIDs"`
	Username string            `codec:"username" json:"username"`
}

type GetParticipantsArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
}

type AddEmojiArg struct {
	ConvID         ConversationID `codec:"convID" json:"convID"`
	Alias          string         `codec:"alias" json:"alias"`
	Filename       string         `codec:"filename" json:"filename"`
	AllowOverwrite bool           `codec:"allowOverwrite" json:"allowOverwrite"`
}

type AddEmojisArg struct {
	ConvID         ConversationID `codec:"convID" json:"convID"`
	Aliases        []string       `codec:"aliases" json:"aliases"`
	Filenames      []string       `codec:"filenames" json:"filenames"`
	AllowOverwrite []bool         `codec:"allowOverwrite" json:"allowOverwrite"`
}

type AddEmojiAliasArg struct {
	ConvID        ConversationID `codec:"convID" json:"convID"`
	NewAlias      string         `codec:"newAlias" json:"newAlias"`
	ExistingAlias string         `codec:"existingAlias" json:"existingAlias"`
}

type RemoveEmojiArg struct {
	ConvID ConversationID `codec:"convID" json:"convID"`
	Alias  string         `codec:"alias" json:"alias"`
}

type UserEmojisArg struct {
	Opts   EmojiFetchOpts  `codec:"opts" json:"opts"`
	ConvID *ConversationID `codec:"convID,omitempty" json:"convID,omitempty"`
}

type ToggleEmojiAnimationsArg struct {
	Enabled bool `codec:"enabled" json:"enabled"`
}

type LocalInterface interface {
	GetThreadLocal(context.Context, GetThreadLocalArg) (GetThreadLocalRes, error)
	GetThreadNonblock(context.Context, GetThreadNonblockArg) (NonblockFetchRes, error)
	GetUnreadline(context.Context, GetUnreadlineArg) (UnreadlineRes, error)
	GetInboxAndUnboxLocal(context.Context, GetInboxAndUnboxLocalArg) (GetInboxAndUnboxLocalRes, error)
	GetInboxAndUnboxUILocal(context.Context, GetInboxAndUnboxUILocalArg) (GetInboxAndUnboxUILocalRes, error)
	RequestInboxLayout(context.Context, InboxLayoutReselectMode) error
	RequestInboxUnbox(context.Context, []ConversationID) error
	RequestInboxSmallIncrease(context.Context) error
	RequestInboxSmallReset(context.Context) error
	GetInboxNonblockLocal(context.Context, GetInboxNonblockLocalArg) (NonblockFetchRes, error)
	PostLocal(context.Context, PostLocalArg) (PostLocalRes, error)
	GenerateOutboxID(context.Context) (OutboxID, error)
	PostLocalNonblock(context.Context, PostLocalNonblockArg) (PostLocalNonblockRes, error)
	ForwardMessage(context.Context, ForwardMessageArg) (PostLocalRes, error)
	ForwardMessageNonblock(context.Context, ForwardMessageNonblockArg) (PostLocalNonblockRes, error)
	PostTextNonblock(context.Context, PostTextNonblockArg) (PostLocalNonblockRes, error)
	PostDeleteNonblock(context.Context, PostDeleteNonblockArg) (PostLocalNonblockRes, error)
	PostEditNonblock(context.Context, PostEditNonblockArg) (PostLocalNonblockRes, error)
	PostReactionNonblock(context.Context, PostReactionNonblockArg) (PostLocalNonblockRes, error)
	PostHeadlineNonblock(context.Context, PostHeadlineNonblockArg) (PostLocalNonblockRes, error)
	PostHeadline(context.Context, PostHeadlineArg) (PostLocalRes, error)
	PostMetadataNonblock(context.Context, PostMetadataNonblockArg) (PostLocalNonblockRes, error)
	PostMetadata(context.Context, PostMetadataArg) (PostLocalRes, error)
	PostDeleteHistoryUpto(context.Context, PostDeleteHistoryUptoArg) (PostLocalRes, error)
	PostDeleteHistoryThrough(context.Context, PostDeleteHistoryThroughArg) (PostLocalRes, error)
	PostDeleteHistoryByAge(context.Context, PostDeleteHistoryByAgeArg) (PostLocalRes, error)
	SetConversationStatusLocal(context.Context, SetConversationStatusLocalArg) (SetConversationStatusLocalRes, error)
	NewConversationsLocal(context.Context, NewConversationsLocalArg) (NewConversationsLocalRes, error)
	NewConversationLocal(context.Context, NewConversationLocalArg) (NewConversationLocalRes, error)
	GetInboxSummaryForCLILocal(context.Context, GetInboxSummaryForCLILocalQuery) (GetInboxSummaryForCLILocalRes, error)
	GetConversationForCLILocal(context.Context, GetConversationForCLILocalQuery) (GetConversationForCLILocalRes, error)
	GetMessagesLocal(context.Context, GetMessagesLocalArg) (GetMessagesLocalRes, error)
	PostFileAttachmentLocal(context.Context, PostFileAttachmentLocalArg) (PostLocalRes, error)
	PostFileAttachmentLocalNonblock(context.Context, PostFileAttachmentLocalNonblockArg) (PostLocalNonblockRes, error)
	GetNextAttachmentMessageLocal(context.Context, GetNextAttachmentMessageLocalArg) (GetNextAttachmentMessageLocalRes, error)
	DownloadAttachmentLocal(context.Context, DownloadAttachmentLocalArg) (DownloadAttachmentLocalRes, error)
	DownloadFileAttachmentLocal(context.Context, DownloadFileAttachmentLocalArg) (DownloadFileAttachmentLocalRes, error)
	ConfigureFileAttachmentDownloadLocal(context.Context, ConfigureFileAttachmentDownloadLocalArg) error
	MakePreview(context.Context, MakePreviewArg) (MakePreviewRes, error)
	MakeAudioPreview(context.Context, MakeAudioPreviewArg) (MakePreviewRes, error)
	GetUploadTempFile(context.Context, GetUploadTempFileArg) (string, error)
	MakeUploadTempFile(context.Context, MakeUploadTempFileArg) (string, error)
	CancelUploadTempFile(context.Context, OutboxID) error
	CancelPost(context.Context, OutboxID) error
	RetryPost(context.Context, RetryPostArg) error
	MarkAsReadLocal(context.Context, MarkAsReadLocalArg) (MarkAsReadLocalRes, error)
	MarkTLFAsReadLocal(context.Context, MarkTLFAsReadLocalArg) (MarkTLFAsReadLocalRes, error)
	FindConversationsLocal(context.Context, FindConversationsLocalArg) (FindConversationsLocalRes, error)
	FindGeneralConvFromTeamID(context.Context, keybase1.TeamID) (InboxUIItem, error)
	UpdateTyping(context.Context, UpdateTypingArg) error
	UpdateUnsentText(context.Context, UpdateUnsentTextArg) error
	JoinConversationLocal(context.Context, JoinConversationLocalArg) (JoinLeaveConversationLocalRes, error)
	JoinConversationByIDLocal(context.Context, ConversationID) (JoinLeaveConversationLocalRes, error)
	LeaveConversationLocal(context.Context, ConversationID) (JoinLeaveConversationLocalRes, error)
	PreviewConversationByIDLocal(context.Context, ConversationID) (PreviewConversationLocalRes, error)
	DeleteConversationLocal(context.Context, DeleteConversationLocalArg) (DeleteConversationLocalRes, error)
	RemoveFromConversationLocal(context.Context, RemoveFromConversationLocalArg) (RemoveFromConversationLocalRes, error)
	GetTLFConversationsLocal(context.Context, GetTLFConversationsLocalArg) (GetTLFConversationsLocalRes, error)
	GetChannelMembershipsLocal(context.Context, GetChannelMembershipsLocalArg) (GetChannelMembershipsLocalRes, error)
	GetMutualTeamsLocal(context.Context, []string) (GetMutualTeamsLocalRes, error)
	SetAppNotificationSettingsLocal(context.Context, SetAppNotificationSettingsLocalArg) (SetAppNotificationSettingsLocalRes, error)
	SetGlobalAppNotificationSettingsLocal(context.Context, map[string]bool) error
	GetGlobalAppNotificationSettingsLocal(context.Context) (GlobalAppNotificationSettings, error)
	UnboxMobilePushNotification(context.Context, UnboxMobilePushNotificationArg) (string, error)
	AddTeamMemberAfterReset(context.Context, AddTeamMemberAfterResetArg) error
	GetAllResetConvMembers(context.Context) (GetAllResetConvMembersRes, error)
	SetConvRetentionLocal(context.Context, SetConvRetentionLocalArg) error
	SetTeamRetentionLocal(context.Context, SetTeamRetentionLocalArg) error
	GetTeamRetentionLocal(context.Context, keybase1.TeamID) (*RetentionPolicy, error)
	SetConvMinWriterRoleLocal(context.Context, SetConvMinWriterRoleLocalArg) error
	UpgradeKBFSConversationToImpteam(context.Context, ConversationID) error
	SearchRegexp(context.Context, SearchRegexpArg) (SearchRegexpRes, error)
	CancelActiveInboxSearch(context.Context) error
	SearchInbox(context.Context, SearchInboxArg) (SearchInboxRes, error)
	SimpleSearchInboxConvNames(context.Context, string) ([]SimpleSearchInboxConvNamesHit, error)
	CancelActiveSearch(context.Context) error
	ProfileChatSearch(context.Context, keybase1.TLFIdentifyBehavior) (map[ConvIDStr]ProfileSearchConvStats, error)
	GetStaticConfig(context.Context) (StaticConfig, error)
	ResolveUnfurlPrompt(context.Context, ResolveUnfurlPromptArg) error
	GetUnfurlSettings(context.Context) (UnfurlSettingsDisplay, error)
	SaveUnfurlSettings(context.Context, SaveUnfurlSettingsArg) error
	ToggleMessageCollapse(context.Context, ToggleMessageCollapseArg) error
	BulkAddToConv(context.Context, BulkAddToConvArg) error
	BulkAddToManyConvs(context.Context, BulkAddToManyConvsArg) error
	PutReacjiSkinTone(context.Context, keybase1.ReacjiSkinTone) (keybase1.UserReacjis, error)
	ResolveMaybeMention(context.Context, MaybeMention) error
	LoadGallery(context.Context, LoadGalleryArg) (LoadGalleryRes, error)
	LoadFlip(context.Context, LoadFlipArg) (LoadFlipRes, error)
	LocationUpdate(context.Context, Coordinate) error
	AdvertiseBotCommandsLocal(context.Context, AdvertiseBotCommandsLocalArg) (AdvertiseBotCommandsLocalRes, error)
	ListBotCommandsLocal(context.Context, ConversationID) (ListBotCommandsLocalRes, error)
	ListPublicBotCommandsLocal(context.Context, string) (ListBotCommandsLocalRes, error)
	ClearBotCommandsLocal(context.Context, *ClearBotCommandsFilter) (ClearBotCommandsLocalRes, error)
	PinMessage(context.Context, PinMessageArg) (PinMessageRes, error)
	UnpinMessage(context.Context, ConversationID) (PinMessageRes, error)
	IgnorePinnedMessage(context.Context, ConversationID) error
	AddBotMember(context.Context, AddBotMemberArg) error
	EditBotMember(context.Context, EditBotMemberArg) error
	RemoveBotMember(context.Context, RemoveBotMemberArg) error
	SetBotMemberSettings(context.Context, SetBotMemberSettingsArg) error
	GetBotMemberSettings(context.Context, GetBotMemberSettingsArg) (keybase1.TeamBotSettings, error)
	GetTeamRoleInConversation(context.Context, GetTeamRoleInConversationArg) (keybase1.TeamRole, error)
	AddBotConvSearch(context.Context, string) ([]ConvSearchHit, error)
	ForwardMessageConvSearch(context.Context, string) ([]ConvSearchHit, error)
	TeamIDFromTLFName(context.Context, TeamIDFromTLFNameArg) (keybase1.TeamID, error)
	DismissJourneycard(context.Context, DismissJourneycardArg) error
	SetWelcomeMessage(context.Context, SetWelcomeMessageArg) error
	GetWelcomeMessage(context.Context, keybase1.TeamID) (WelcomeMessageDisplay, error)
	GetDefaultTeamChannelsLocal(context.Context, keybase1.TeamID) (GetDefaultTeamChannelsLocalRes, error)
	SetDefaultTeamChannelsLocal(context.Context, SetDefaultTeamChannelsLocalArg) (SetDefaultTeamChannelsLocalRes, error)
	GetLastActiveForTLF(context.Context, TLFIDStr) (LastActiveStatus, error)
	GetLastActiveForTeams(context.Context) (LastActiveStatusAll, error)
	GetRecentJoinsLocal(context.Context, ConversationID) (int, error)
	RefreshParticipants(context.Context, ConversationID) error
	GetLastActiveAtLocal(context.Context, GetLastActiveAtLocalArg) (gregor1.Time, error)
	GetLastActiveAtMultiLocal(context.Context, GetLastActiveAtMultiLocalArg) (map[keybase1.TeamID]gregor1.Time, error)
	GetParticipants(context.Context, ConversationID) ([]ConversationLocalParticipant, error)
	AddEmoji(context.Context, AddEmojiArg) (AddEmojiRes, error)
	AddEmojis(context.Context, AddEmojisArg) (AddEmojisRes, error)
	AddEmojiAlias(context.Context, AddEmojiAliasArg) (AddEmojiAliasRes, error)
	RemoveEmoji(context.Context, RemoveEmojiArg) (RemoveEmojiRes, error)
	UserEmojis(context.Context, UserEmojisArg) (UserEmojiRes, error)
	ToggleEmojiAnimations(context.Context, bool) error
}

func LocalProtocol(i LocalInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "chat.1.local",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getThreadLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetThreadLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetThreadLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetThreadLocalArg)(nil), args)
						return
					}
					ret, err = i.GetThreadLocal(ctx, typedArgs[0])
					return
				},
			},
			"getThreadNonblock": {
				MakeArg: func() interface{} {
					var ret [1]GetThreadNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetThreadNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetThreadNonblockArg)(nil), args)
						return
					}
					ret, err = i.GetThreadNonblock(ctx, typedArgs[0])
					return
				},
			},
			"getUnreadline": {
				MakeArg: func() interface{} {
					var ret [1]GetUnreadlineArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUnreadlineArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUnreadlineArg)(nil), args)
						return
					}
					ret, err = i.GetUnreadline(ctx, typedArgs[0])
					return
				},
			},
			"getInboxAndUnboxLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetInboxAndUnboxLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInboxAndUnboxLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInboxAndUnboxLocalArg)(nil), args)
						return
					}
					ret, err = i.GetInboxAndUnboxLocal(ctx, typedArgs[0])
					return
				},
			},
			"getInboxAndUnboxUILocal": {
				MakeArg: func() interface{} {
					var ret [1]GetInboxAndUnboxUILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInboxAndUnboxUILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInboxAndUnboxUILocalArg)(nil), args)
						return
					}
					ret, err = i.GetInboxAndUnboxUILocal(ctx, typedArgs[0])
					return
				},
			},
			"requestInboxLayout": {
				MakeArg: func() interface{} {
					var ret [1]RequestInboxLayoutArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RequestInboxLayoutArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RequestInboxLayoutArg)(nil), args)
						return
					}
					err = i.RequestInboxLayout(ctx, typedArgs[0].ReselectMode)
					return
				},
			},
			"requestInboxUnbox": {
				MakeArg: func() interface{} {
					var ret [1]RequestInboxUnboxArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RequestInboxUnboxArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RequestInboxUnboxArg)(nil), args)
						return
					}
					err = i.RequestInboxUnbox(ctx, typedArgs[0].ConvIDs)
					return
				},
			},
			"requestInboxSmallIncrease": {
				MakeArg: func() interface{} {
					var ret [1]RequestInboxSmallIncreaseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.RequestInboxSmallIncrease(ctx)
					return
				},
			},
			"requestInboxSmallReset": {
				MakeArg: func() interface{} {
					var ret [1]RequestInboxSmallResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.RequestInboxSmallReset(ctx)
					return
				},
			},
			"getInboxNonblockLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetInboxNonblockLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInboxNonblockLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInboxNonblockLocalArg)(nil), args)
						return
					}
					ret, err = i.GetInboxNonblockLocal(ctx, typedArgs[0])
					return
				},
			},
			"postLocal": {
				MakeArg: func() interface{} {
					var ret [1]PostLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostLocalArg)(nil), args)
						return
					}
					ret, err = i.PostLocal(ctx, typedArgs[0])
					return
				},
			},
			"generateOutboxID": {
				MakeArg: func() interface{} {
					var ret [1]GenerateOutboxIDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GenerateOutboxID(ctx)
					return
				},
			},
			"postLocalNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostLocalNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostLocalNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostLocalNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostLocalNonblock(ctx, typedArgs[0])
					return
				},
			},
			"forwardMessage": {
				MakeArg: func() interface{} {
					var ret [1]ForwardMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ForwardMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ForwardMessageArg)(nil), args)
						return
					}
					ret, err = i.ForwardMessage(ctx, typedArgs[0])
					return
				},
			},
			"forwardMessageNonblock": {
				MakeArg: func() interface{} {
					var ret [1]ForwardMessageNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ForwardMessageNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ForwardMessageNonblockArg)(nil), args)
						return
					}
					ret, err = i.ForwardMessageNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postTextNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostTextNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostTextNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostTextNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostTextNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postDeleteNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostDeleteNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostDeleteNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostDeleteNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostDeleteNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postEditNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostEditNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostEditNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostEditNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostEditNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postReactionNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostReactionNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostReactionNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostReactionNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostReactionNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postHeadlineNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostHeadlineNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostHeadlineNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostHeadlineNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostHeadlineNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postHeadline": {
				MakeArg: func() interface{} {
					var ret [1]PostHeadlineArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostHeadlineArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostHeadlineArg)(nil), args)
						return
					}
					ret, err = i.PostHeadline(ctx, typedArgs[0])
					return
				},
			},
			"postMetadataNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostMetadataNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostMetadataNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostMetadataNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostMetadataNonblock(ctx, typedArgs[0])
					return
				},
			},
			"postMetadata": {
				MakeArg: func() interface{} {
					var ret [1]PostMetadataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostMetadataArg)(nil), args)
						return
					}
					ret, err = i.PostMetadata(ctx, typedArgs[0])
					return
				},
			},
			"postDeleteHistoryUpto": {
				MakeArg: func() interface{} {
					var ret [1]PostDeleteHistoryUptoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostDeleteHistoryUptoArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostDeleteHistoryUptoArg)(nil), args)
						return
					}
					ret, err = i.PostDeleteHistoryUpto(ctx, typedArgs[0])
					return
				},
			},
			"postDeleteHistoryThrough": {
				MakeArg: func() interface{} {
					var ret [1]PostDeleteHistoryThroughArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostDeleteHistoryThroughArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostDeleteHistoryThroughArg)(nil), args)
						return
					}
					ret, err = i.PostDeleteHistoryThrough(ctx, typedArgs[0])
					return
				},
			},
			"postDeleteHistoryByAge": {
				MakeArg: func() interface{} {
					var ret [1]PostDeleteHistoryByAgeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostDeleteHistoryByAgeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostDeleteHistoryByAgeArg)(nil), args)
						return
					}
					ret, err = i.PostDeleteHistoryByAge(ctx, typedArgs[0])
					return
				},
			},
			"SetConversationStatusLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetConversationStatusLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetConversationStatusLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetConversationStatusLocalArg)(nil), args)
						return
					}
					ret, err = i.SetConversationStatusLocal(ctx, typedArgs[0])
					return
				},
			},
			"newConversationsLocal": {
				MakeArg: func() interface{} {
					var ret [1]NewConversationsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewConversationsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewConversationsLocalArg)(nil), args)
						return
					}
					ret, err = i.NewConversationsLocal(ctx, typedArgs[0])
					return
				},
			},
			"newConversationLocal": {
				MakeArg: func() interface{} {
					var ret [1]NewConversationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]NewConversationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]NewConversationLocalArg)(nil), args)
						return
					}
					ret, err = i.NewConversationLocal(ctx, typedArgs[0])
					return
				},
			},
			"getInboxSummaryForCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]GetInboxSummaryForCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetInboxSummaryForCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetInboxSummaryForCLILocalArg)(nil), args)
						return
					}
					ret, err = i.GetInboxSummaryForCLILocal(ctx, typedArgs[0].Query)
					return
				},
			},
			"getConversationForCLILocal": {
				MakeArg: func() interface{} {
					var ret [1]GetConversationForCLILocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetConversationForCLILocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetConversationForCLILocalArg)(nil), args)
						return
					}
					ret, err = i.GetConversationForCLILocal(ctx, typedArgs[0].Query)
					return
				},
			},
			"GetMessagesLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetMessagesLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMessagesLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMessagesLocalArg)(nil), args)
						return
					}
					ret, err = i.GetMessagesLocal(ctx, typedArgs[0])
					return
				},
			},
			"postFileAttachmentLocal": {
				MakeArg: func() interface{} {
					var ret [1]PostFileAttachmentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostFileAttachmentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostFileAttachmentLocalArg)(nil), args)
						return
					}
					ret, err = i.PostFileAttachmentLocal(ctx, typedArgs[0])
					return
				},
			},
			"postFileAttachmentLocalNonblock": {
				MakeArg: func() interface{} {
					var ret [1]PostFileAttachmentLocalNonblockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PostFileAttachmentLocalNonblockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PostFileAttachmentLocalNonblockArg)(nil), args)
						return
					}
					ret, err = i.PostFileAttachmentLocalNonblock(ctx, typedArgs[0])
					return
				},
			},
			"getNextAttachmentMessageLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetNextAttachmentMessageLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetNextAttachmentMessageLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetNextAttachmentMessageLocalArg)(nil), args)
						return
					}
					ret, err = i.GetNextAttachmentMessageLocal(ctx, typedArgs[0])
					return
				},
			},
			"DownloadAttachmentLocal": {
				MakeArg: func() interface{} {
					var ret [1]DownloadAttachmentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DownloadAttachmentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DownloadAttachmentLocalArg)(nil), args)
						return
					}
					ret, err = i.DownloadAttachmentLocal(ctx, typedArgs[0])
					return
				},
			},
			"DownloadFileAttachmentLocal": {
				MakeArg: func() interface{} {
					var ret [1]DownloadFileAttachmentLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DownloadFileAttachmentLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DownloadFileAttachmentLocalArg)(nil), args)
						return
					}
					ret, err = i.DownloadFileAttachmentLocal(ctx, typedArgs[0])
					return
				},
			},
			"ConfigureFileAttachmentDownloadLocal": {
				MakeArg: func() interface{} {
					var ret [1]ConfigureFileAttachmentDownloadLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ConfigureFileAttachmentDownloadLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ConfigureFileAttachmentDownloadLocalArg)(nil), args)
						return
					}
					err = i.ConfigureFileAttachmentDownloadLocal(ctx, typedArgs[0])
					return
				},
			},
			"makePreview": {
				MakeArg: func() interface{} {
					var ret [1]MakePreviewArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MakePreviewArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MakePreviewArg)(nil), args)
						return
					}
					ret, err = i.MakePreview(ctx, typedArgs[0])
					return
				},
			},
			"makeAudioPreview": {
				MakeArg: func() interface{} {
					var ret [1]MakeAudioPreviewArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MakeAudioPreviewArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MakeAudioPreviewArg)(nil), args)
						return
					}
					ret, err = i.MakeAudioPreview(ctx, typedArgs[0])
					return
				},
			},
			"getUploadTempFile": {
				MakeArg: func() interface{} {
					var ret [1]GetUploadTempFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUploadTempFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUploadTempFileArg)(nil), args)
						return
					}
					ret, err = i.GetUploadTempFile(ctx, typedArgs[0])
					return
				},
			},
			"makeUploadTempFile": {
				MakeArg: func() interface{} {
					var ret [1]MakeUploadTempFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MakeUploadTempFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MakeUploadTempFileArg)(nil), args)
						return
					}
					ret, err = i.MakeUploadTempFile(ctx, typedArgs[0])
					return
				},
			},
			"cancelUploadTempFile": {
				MakeArg: func() interface{} {
					var ret [1]CancelUploadTempFileArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelUploadTempFileArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelUploadTempFileArg)(nil), args)
						return
					}
					err = i.CancelUploadTempFile(ctx, typedArgs[0].OutboxID)
					return
				},
			},
			"CancelPost": {
				MakeArg: func() interface{} {
					var ret [1]CancelPostArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelPostArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelPostArg)(nil), args)
						return
					}
					err = i.CancelPost(ctx, typedArgs[0].OutboxID)
					return
				},
			},
			"RetryPost": {
				MakeArg: func() interface{} {
					var ret [1]RetryPostArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RetryPostArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RetryPostArg)(nil), args)
						return
					}
					err = i.RetryPost(ctx, typedArgs[0])
					return
				},
			},
			"markAsReadLocal": {
				MakeArg: func() interface{} {
					var ret [1]MarkAsReadLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MarkAsReadLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MarkAsReadLocalArg)(nil), args)
						return
					}
					ret, err = i.MarkAsReadLocal(ctx, typedArgs[0])
					return
				},
			},
			"markTLFAsReadLocal": {
				MakeArg: func() interface{} {
					var ret [1]MarkTLFAsReadLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]MarkTLFAsReadLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]MarkTLFAsReadLocalArg)(nil), args)
						return
					}
					ret, err = i.MarkTLFAsReadLocal(ctx, typedArgs[0])
					return
				},
			},
			"findConversationsLocal": {
				MakeArg: func() interface{} {
					var ret [1]FindConversationsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindConversationsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindConversationsLocalArg)(nil), args)
						return
					}
					ret, err = i.FindConversationsLocal(ctx, typedArgs[0])
					return
				},
			},
			"findGeneralConvFromTeamID": {
				MakeArg: func() interface{} {
					var ret [1]FindGeneralConvFromTeamIDArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]FindGeneralConvFromTeamIDArg)
					if !ok {
						err = rpc.NewTypeError((*[1]FindGeneralConvFromTeamIDArg)(nil), args)
						return
					}
					ret, err = i.FindGeneralConvFromTeamID(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"updateTyping": {
				MakeArg: func() interface{} {
					var ret [1]UpdateTypingArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateTypingArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateTypingArg)(nil), args)
						return
					}
					err = i.UpdateTyping(ctx, typedArgs[0])
					return
				},
			},
			"updateUnsentText": {
				MakeArg: func() interface{} {
					var ret [1]UpdateUnsentTextArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateUnsentTextArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateUnsentTextArg)(nil), args)
						return
					}
					err = i.UpdateUnsentText(ctx, typedArgs[0])
					return
				},
			},
			"joinConversationLocal": {
				MakeArg: func() interface{} {
					var ret [1]JoinConversationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]JoinConversationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]JoinConversationLocalArg)(nil), args)
						return
					}
					ret, err = i.JoinConversationLocal(ctx, typedArgs[0])
					return
				},
			},
			"joinConversationByIDLocal": {
				MakeArg: func() interface{} {
					var ret [1]JoinConversationByIDLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]JoinConversationByIDLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]JoinConversationByIDLocalArg)(nil), args)
						return
					}
					ret, err = i.JoinConversationByIDLocal(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"leaveConversationLocal": {
				MakeArg: func() interface{} {
					var ret [1]LeaveConversationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LeaveConversationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LeaveConversationLocalArg)(nil), args)
						return
					}
					ret, err = i.LeaveConversationLocal(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"previewConversationByIDLocal": {
				MakeArg: func() interface{} {
					var ret [1]PreviewConversationByIDLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PreviewConversationByIDLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PreviewConversationByIDLocalArg)(nil), args)
						return
					}
					ret, err = i.PreviewConversationByIDLocal(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"deleteConversationLocal": {
				MakeArg: func() interface{} {
					var ret [1]DeleteConversationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeleteConversationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeleteConversationLocalArg)(nil), args)
						return
					}
					ret, err = i.DeleteConversationLocal(ctx, typedArgs[0])
					return
				},
			},
			"removeFromConversationLocal": {
				MakeArg: func() interface{} {
					var ret [1]RemoveFromConversationLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RemoveFromConversationLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RemoveFromConversationLocalArg)(nil), args)
						return
					}
					ret, err = i.RemoveFromConversationLocal(ctx, typedArgs[0])
					return
				},
			},
			"getTLFConversationsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetTLFConversationsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTLFConversationsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTLFConversationsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetTLFConversationsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getChannelMembershipsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetChannelMembershipsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetChannelMembershipsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetChannelMembershipsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetChannelMembershipsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getMutualTeamsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetMutualTeamsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetMutualTeamsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetMutualTeamsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetMutualTeamsLocal(ctx, typedArgs[0].Usernames)
					return
				},
			},
			"setAppNotificationSettingsLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetAppNotificationSettingsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetAppNotificationSettingsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetAppNotificationSettingsLocalArg)(nil), args)
						return
					}
					ret, err = i.SetAppNotificationSettingsLocal(ctx, typedArgs[0])
					return
				},
			},
			"setGlobalAppNotificationSettingsLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetGlobalAppNotificationSettingsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetGlobalAppNotificationSettingsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetGlobalAppNotificationSettingsLocalArg)(nil), args)
						return
					}
					err = i.SetGlobalAppNotificationSettingsLocal(ctx, typedArgs[0].Settings)
					return
				},
			},
			"getGlobalAppNotificationSettingsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetGlobalAppNotificationSettingsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetGlobalAppNotificationSettingsLocal(ctx)
					return
				},
			},
			"unboxMobilePushNotification": {
				MakeArg: func() interface{} {
					var ret [1]UnboxMobilePushNotificationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UnboxMobilePushNotificationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UnboxMobilePushNotificationArg)(nil), args)
						return
					}
					ret, err = i.UnboxMobilePushNotification(ctx, typedArgs[0])
					return
				},
			},
			"addTeamMemberAfterReset": {
				MakeArg: func() interface{} {
					var ret [1]AddTeamMemberAfterResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddTeamMemberAfterResetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddTeamMemberAfterResetArg)(nil), args)
						return
					}
					err = i.AddTeamMemberAfterReset(ctx, typedArgs[0])
					return
				},
			},
			"getAllResetConvMembers": {
				MakeArg: func() interface{} {
					var ret [1]GetAllResetConvMembersArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetAllResetConvMembers(ctx)
					return
				},
			},
			"setConvRetentionLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetConvRetentionLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetConvRetentionLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetConvRetentionLocalArg)(nil), args)
						return
					}
					err = i.SetConvRetentionLocal(ctx, typedArgs[0])
					return
				},
			},
			"setTeamRetentionLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetTeamRetentionLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetTeamRetentionLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetTeamRetentionLocalArg)(nil), args)
						return
					}
					err = i.SetTeamRetentionLocal(ctx, typedArgs[0])
					return
				},
			},
			"getTeamRetentionLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetTeamRetentionLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTeamRetentionLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTeamRetentionLocalArg)(nil), args)
						return
					}
					ret, err = i.GetTeamRetentionLocal(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"setConvMinWriterRoleLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetConvMinWriterRoleLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetConvMinWriterRoleLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetConvMinWriterRoleLocalArg)(nil), args)
						return
					}
					err = i.SetConvMinWriterRoleLocal(ctx, typedArgs[0])
					return
				},
			},
			"upgradeKBFSConversationToImpteam": {
				MakeArg: func() interface{} {
					var ret [1]UpgradeKBFSConversationToImpteamArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpgradeKBFSConversationToImpteamArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpgradeKBFSConversationToImpteamArg)(nil), args)
						return
					}
					err = i.UpgradeKBFSConversationToImpteam(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"searchRegexp": {
				MakeArg: func() interface{} {
					var ret [1]SearchRegexpArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SearchRegexpArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SearchRegexpArg)(nil), args)
						return
					}
					ret, err = i.SearchRegexp(ctx, typedArgs[0])
					return
				},
			},
			"cancelActiveInboxSearch": {
				MakeArg: func() interface{} {
					var ret [1]CancelActiveInboxSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.CancelActiveInboxSearch(ctx)
					return
				},
			},
			"searchInbox": {
				MakeArg: func() interface{} {
					var ret [1]SearchInboxArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SearchInboxArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SearchInboxArg)(nil), args)
						return
					}
					ret, err = i.SearchInbox(ctx, typedArgs[0])
					return
				},
			},
			"simpleSearchInboxConvNames": {
				MakeArg: func() interface{} {
					var ret [1]SimpleSearchInboxConvNamesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SimpleSearchInboxConvNamesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SimpleSearchInboxConvNamesArg)(nil), args)
						return
					}
					ret, err = i.SimpleSearchInboxConvNames(ctx, typedArgs[0].Query)
					return
				},
			},
			"cancelActiveSearch": {
				MakeArg: func() interface{} {
					var ret [1]CancelActiveSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.CancelActiveSearch(ctx)
					return
				},
			},
			"profileChatSearch": {
				MakeArg: func() interface{} {
					var ret [1]ProfileChatSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ProfileChatSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ProfileChatSearchArg)(nil), args)
						return
					}
					ret, err = i.ProfileChatSearch(ctx, typedArgs[0].IdentifyBehavior)
					return
				},
			},
			"getStaticConfig": {
				MakeArg: func() interface{} {
					var ret [1]GetStaticConfigArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetStaticConfig(ctx)
					return
				},
			},
			"resolveUnfurlPrompt": {
				MakeArg: func() interface{} {
					var ret [1]ResolveUnfurlPromptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResolveUnfurlPromptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResolveUnfurlPromptArg)(nil), args)
						return
					}
					err = i.ResolveUnfurlPrompt(ctx, typedArgs[0])
					return
				},
			},
			"getUnfurlSettings": {
				MakeArg: func() interface{} {
					var ret [1]GetUnfurlSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetUnfurlSettings(ctx)
					return
				},
			},
			"saveUnfurlSettings": {
				MakeArg: func() interface{} {
					var ret [1]SaveUnfurlSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SaveUnfurlSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SaveUnfurlSettingsArg)(nil), args)
						return
					}
					err = i.SaveUnfurlSettings(ctx, typedArgs[0])
					return
				},
			},
			"toggleMessageCollapse": {
				MakeArg: func() interface{} {
					var ret [1]ToggleMessageCollapseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ToggleMessageCollapseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ToggleMessageCollapseArg)(nil), args)
						return
					}
					err = i.ToggleMessageCollapse(ctx, typedArgs[0])
					return
				},
			},
			"bulkAddToConv": {
				MakeArg: func() interface{} {
					var ret [1]BulkAddToConvArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BulkAddToConvArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BulkAddToConvArg)(nil), args)
						return
					}
					err = i.BulkAddToConv(ctx, typedArgs[0])
					return
				},
			},
			"bulkAddToManyConvs": {
				MakeArg: func() interface{} {
					var ret [1]BulkAddToManyConvsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]BulkAddToManyConvsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]BulkAddToManyConvsArg)(nil), args)
						return
					}
					err = i.BulkAddToManyConvs(ctx, typedArgs[0])
					return
				},
			},
			"putReacjiSkinTone": {
				MakeArg: func() interface{} {
					var ret [1]PutReacjiSkinToneArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PutReacjiSkinToneArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PutReacjiSkinToneArg)(nil), args)
						return
					}
					ret, err = i.PutReacjiSkinTone(ctx, typedArgs[0].SkinTone)
					return
				},
			},
			"resolveMaybeMention": {
				MakeArg: func() interface{} {
					var ret [1]ResolveMaybeMentionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResolveMaybeMentionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResolveMaybeMentionArg)(nil), args)
						return
					}
					err = i.ResolveMaybeMention(ctx, typedArgs[0].Mention)
					return
				},
			},
			"loadGallery": {
				MakeArg: func() interface{} {
					var ret [1]LoadGalleryArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadGalleryArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadGalleryArg)(nil), args)
						return
					}
					ret, err = i.LoadGallery(ctx, typedArgs[0])
					return
				},
			},
			"loadFlip": {
				MakeArg: func() interface{} {
					var ret [1]LoadFlipArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoadFlipArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoadFlipArg)(nil), args)
						return
					}
					ret, err = i.LoadFlip(ctx, typedArgs[0])
					return
				},
			},
			"locationUpdate": {
				MakeArg: func() interface{} {
					var ret [1]LocationUpdateArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LocationUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LocationUpdateArg)(nil), args)
						return
					}
					err = i.LocationUpdate(ctx, typedArgs[0].Coord)
					return
				},
			},
			"advertiseBotCommandsLocal": {
				MakeArg: func() interface{} {
					var ret [1]AdvertiseBotCommandsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AdvertiseBotCommandsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AdvertiseBotCommandsLocalArg)(nil), args)
						return
					}
					ret, err = i.AdvertiseBotCommandsLocal(ctx, typedArgs[0])
					return
				},
			},
			"listBotCommandsLocal": {
				MakeArg: func() interface{} {
					var ret [1]ListBotCommandsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListBotCommandsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListBotCommandsLocalArg)(nil), args)
						return
					}
					ret, err = i.ListBotCommandsLocal(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"listPublicBotCommandsLocal": {
				MakeArg: func() interface{} {
					var ret [1]ListPublicBotCommandsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ListPublicBotCommandsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ListPublicBotCommandsLocalArg)(nil), args)
						return
					}
					ret, err = i.ListPublicBotCommandsLocal(ctx, typedArgs[0].Username)
					return
				},
			},
			"clearBotCommandsLocal": {
				MakeArg: func() interface{} {
					var ret [1]ClearBotCommandsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ClearBotCommandsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ClearBotCommandsLocalArg)(nil), args)
						return
					}
					ret, err = i.ClearBotCommandsLocal(ctx, typedArgs[0].Filter)
					return
				},
			},
			"pinMessage": {
				MakeArg: func() interface{} {
					var ret [1]PinMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PinMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PinMessageArg)(nil), args)
						return
					}
					ret, err = i.PinMessage(ctx, typedArgs[0])
					return
				},
			},
			"unpinMessage": {
				MakeArg: func() interface{} {
					var ret [1]UnpinMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UnpinMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UnpinMessageArg)(nil), args)
						return
					}
					ret, err = i.UnpinMessage(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"ignorePinnedMessage": {
				MakeArg: func() interface{} {
					var ret [1]IgnorePinnedMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IgnorePinnedMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IgnorePinnedMessageArg)(nil), args)
						return
					}
					err = i.IgnorePinnedMessage(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"addBotMember": {
				MakeArg: func() interface{} {
					var ret [1]AddBotMemberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddBotMemberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddBotMemberArg)(nil), args)
						return
					}
					err = i.AddBotMember(ctx, typedArgs[0])
					return
				},
			},
			"editBotMember": {
				MakeArg: func() interface{} {
					var ret [1]EditBotMemberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EditBotMemberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EditBotMemberArg)(nil), args)
						return
					}
					err = i.EditBotMember(ctx, typedArgs[0])
					return
				},
			},
			"removeBotMember": {
				MakeArg: func() interface{} {
					var ret [1]RemoveBotMemberArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RemoveBotMemberArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RemoveBotMemberArg)(nil), args)
						return
					}
					err = i.RemoveBotMember(ctx, typedArgs[0])
					return
				},
			},
			"setBotMemberSettings": {
				MakeArg: func() interface{} {
					var ret [1]SetBotMemberSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetBotMemberSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetBotMemberSettingsArg)(nil), args)
						return
					}
					err = i.SetBotMemberSettings(ctx, typedArgs[0])
					return
				},
			},
			"getBotMemberSettings": {
				MakeArg: func() interface{} {
					var ret [1]GetBotMemberSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetBotMemberSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetBotMemberSettingsArg)(nil), args)
						return
					}
					ret, err = i.GetBotMemberSettings(ctx, typedArgs[0])
					return
				},
			},
			"getTeamRoleInConversation": {
				MakeArg: func() interface{} {
					var ret [1]GetTeamRoleInConversationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetTeamRoleInConversationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetTeamRoleInConversationArg)(nil), args)
						return
					}
					ret, err = i.GetTeamRoleInConversation(ctx, typedArgs[0])
					return
				},
			},
			"addBotConvSearch": {
				MakeArg: func() interface{} {
					var ret [1]AddBotConvSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddBotConvSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddBotConvSearchArg)(nil), args)
						return
					}
					ret, err = i.AddBotConvSearch(ctx, typedArgs[0].Term)
					return
				},
			},
			"forwardMessageConvSearch": {
				MakeArg: func() interface{} {
					var ret [1]ForwardMessageConvSearchArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ForwardMessageConvSearchArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ForwardMessageConvSearchArg)(nil), args)
						return
					}
					ret, err = i.ForwardMessageConvSearch(ctx, typedArgs[0].Term)
					return
				},
			},
			"teamIDFromTLFName": {
				MakeArg: func() interface{} {
					var ret [1]TeamIDFromTLFNameArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TeamIDFromTLFNameArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TeamIDFromTLFNameArg)(nil), args)
						return
					}
					ret, err = i.TeamIDFromTLFName(ctx, typedArgs[0])
					return
				},
			},
			"dismissJourneycard": {
				MakeArg: func() interface{} {
					var ret [1]DismissJourneycardArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DismissJourneycardArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DismissJourneycardArg)(nil), args)
						return
					}
					err = i.DismissJourneycard(ctx, typedArgs[0])
					return
				},
			},
			"setWelcomeMessage": {
				MakeArg: func() interface{} {
					var ret [1]SetWelcomeMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetWelcomeMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetWelcomeMessageArg)(nil), args)
						return
					}
					err = i.SetWelcomeMessage(ctx, typedArgs[0])
					return
				},
			},
			"getWelcomeMessage": {
				MakeArg: func() interface{} {
					var ret [1]GetWelcomeMessageArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetWelcomeMessageArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetWelcomeMessageArg)(nil), args)
						return
					}
					ret, err = i.GetWelcomeMessage(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"getDefaultTeamChannelsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetDefaultTeamChannelsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetDefaultTeamChannelsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetDefaultTeamChannelsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetDefaultTeamChannelsLocal(ctx, typedArgs[0].TeamID)
					return
				},
			},
			"setDefaultTeamChannelsLocal": {
				MakeArg: func() interface{} {
					var ret [1]SetDefaultTeamChannelsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetDefaultTeamChannelsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetDefaultTeamChannelsLocalArg)(nil), args)
						return
					}
					ret, err = i.SetDefaultTeamChannelsLocal(ctx, typedArgs[0])
					return
				},
			},
			"getLastActiveForTLF": {
				MakeArg: func() interface{} {
					var ret [1]GetLastActiveForTLFArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetLastActiveForTLFArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetLastActiveForTLFArg)(nil), args)
						return
					}
					ret, err = i.GetLastActiveForTLF(ctx, typedArgs[0].TlfID)
					return
				},
			},
			"getLastActiveForTeams": {
				MakeArg: func() interface{} {
					var ret [1]GetLastActiveForTeamsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetLastActiveForTeams(ctx)
					return
				},
			},
			"getRecentJoinsLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetRecentJoinsLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetRecentJoinsLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetRecentJoinsLocalArg)(nil), args)
						return
					}
					ret, err = i.GetRecentJoinsLocal(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"refreshParticipants": {
				MakeArg: func() interface{} {
					var ret [1]RefreshParticipantsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RefreshParticipantsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RefreshParticipantsArg)(nil), args)
						return
					}
					err = i.RefreshParticipants(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"getLastActiveAtLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetLastActiveAtLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetLastActiveAtLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetLastActiveAtLocalArg)(nil), args)
						return
					}
					ret, err = i.GetLastActiveAtLocal(ctx, typedArgs[0])
					return
				},
			},
			"getLastActiveAtMultiLocal": {
				MakeArg: func() interface{} {
					var ret [1]GetLastActiveAtMultiLocalArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetLastActiveAtMultiLocalArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetLastActiveAtMultiLocalArg)(nil), args)
						return
					}
					ret, err = i.GetLastActiveAtMultiLocal(ctx, typedArgs[0])
					return
				},
			},
			"getParticipants": {
				MakeArg: func() interface{} {
					var ret [1]GetParticipantsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetParticipantsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetParticipantsArg)(nil), args)
						return
					}
					ret, err = i.GetParticipants(ctx, typedArgs[0].ConvID)
					return
				},
			},
			"addEmoji": {
				MakeArg: func() interface{} {
					var ret [1]AddEmojiArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddEmojiArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddEmojiArg)(nil), args)
						return
					}
					ret, err = i.AddEmoji(ctx, typedArgs[0])
					return
				},
			},
			"addEmojis": {
				MakeArg: func() interface{} {
					var ret [1]AddEmojisArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddEmojisArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddEmojisArg)(nil), args)
						return
					}
					ret, err = i.AddEmojis(ctx, typedArgs[0])
					return
				},
			},
			"addEmojiAlias": {
				MakeArg: func() interface{} {
					var ret [1]AddEmojiAliasArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AddEmojiAliasArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AddEmojiAliasArg)(nil), args)
						return
					}
					ret, err = i.AddEmojiAlias(ctx, typedArgs[0])
					return
				},
			},
			"removeEmoji": {
				MakeArg: func() interface{} {
					var ret [1]RemoveEmojiArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RemoveEmojiArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RemoveEmojiArg)(nil), args)
						return
					}
					ret, err = i.RemoveEmoji(ctx, typedArgs[0])
					return
				},
			},
			"userEmojis": {
				MakeArg: func() interface{} {
					var ret [1]UserEmojisArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UserEmojisArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UserEmojisArg)(nil), args)
						return
					}
					ret, err = i.UserEmojis(ctx, typedArgs[0])
					return
				},
			},
			"toggleEmojiAnimations": {
				MakeArg: func() interface{} {
					var ret [1]ToggleEmojiAnimationsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ToggleEmojiAnimationsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ToggleEmojiAnimationsArg)(nil), args)
						return
					}
					err = i.ToggleEmojiAnimations(ctx, typedArgs[0].Enabled)
					return
				},
			},
		},
	}
}

type LocalClient struct {
	Cli rpc.GenericClient
}

func (c LocalClient) GetThreadLocal(ctx context.Context, __arg GetThreadLocalArg) (res GetThreadLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getThreadLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetThreadNonblock(ctx context.Context, __arg GetThreadNonblockArg) (res NonblockFetchRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getThreadNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) GetUnreadline(ctx context.Context, __arg GetUnreadlineArg) (res UnreadlineRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getUnreadline", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetInboxAndUnboxLocal(ctx context.Context, __arg GetInboxAndUnboxLocalArg) (res GetInboxAndUnboxLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getInboxAndUnboxLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetInboxAndUnboxUILocal(ctx context.Context, __arg GetInboxAndUnboxUILocalArg) (res GetInboxAndUnboxUILocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getInboxAndUnboxUILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) RequestInboxLayout(ctx context.Context, reselectMode InboxLayoutReselectMode) (err error) {
	__arg := RequestInboxLayoutArg{ReselectMode: reselectMode}
	err = c.Cli.Call(ctx, "chat.1.local.requestInboxLayout", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) RequestInboxUnbox(ctx context.Context, convIDs []ConversationID) (err error) {
	__arg := RequestInboxUnboxArg{ConvIDs: convIDs}
	err = c.Cli.Call(ctx, "chat.1.local.requestInboxUnbox", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) RequestInboxSmallIncrease(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.requestInboxSmallIncrease", []interface{}{RequestInboxSmallIncreaseArg{}}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) RequestInboxSmallReset(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.requestInboxSmallReset", []interface{}{RequestInboxSmallResetArg{}}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetInboxNonblockLocal(ctx context.Context, __arg GetInboxNonblockLocalArg) (res NonblockFetchRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getInboxNonblockLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostLocal(ctx context.Context, __arg PostLocalArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GenerateOutboxID(ctx context.Context) (res OutboxID, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.generateOutboxID", []interface{}{GenerateOutboxIDArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostLocalNonblock(ctx context.Context, __arg PostLocalNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postLocalNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) ForwardMessage(ctx context.Context, __arg ForwardMessageArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.forwardMessage", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ForwardMessageNonblock(ctx context.Context, __arg ForwardMessageNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.forwardMessageNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostTextNonblock(ctx context.Context, __arg PostTextNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postTextNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostDeleteNonblock(ctx context.Context, __arg PostDeleteNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postDeleteNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostEditNonblock(ctx context.Context, __arg PostEditNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postEditNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostReactionNonblock(ctx context.Context, __arg PostReactionNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postReactionNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostHeadlineNonblock(ctx context.Context, __arg PostHeadlineNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postHeadlineNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostHeadline(ctx context.Context, __arg PostHeadlineArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postHeadline", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostMetadataNonblock(ctx context.Context, __arg PostMetadataNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postMetadataNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) PostMetadata(ctx context.Context, __arg PostMetadataArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postMetadata", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostDeleteHistoryUpto(ctx context.Context, __arg PostDeleteHistoryUptoArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postDeleteHistoryUpto", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostDeleteHistoryThrough(ctx context.Context, __arg PostDeleteHistoryThroughArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postDeleteHistoryThrough", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostDeleteHistoryByAge(ctx context.Context, __arg PostDeleteHistoryByAgeArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postDeleteHistoryByAge", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetConversationStatusLocal(ctx context.Context, __arg SetConversationStatusLocalArg) (res SetConversationStatusLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.SetConversationStatusLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) NewConversationsLocal(ctx context.Context, __arg NewConversationsLocalArg) (res NewConversationsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.newConversationsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) NewConversationLocal(ctx context.Context, __arg NewConversationLocalArg) (res NewConversationLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.newConversationLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetInboxSummaryForCLILocal(ctx context.Context, query GetInboxSummaryForCLILocalQuery) (res GetInboxSummaryForCLILocalRes, err error) {
	__arg := GetInboxSummaryForCLILocalArg{Query: query}
	err = c.Cli.Call(ctx, "chat.1.local.getInboxSummaryForCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetConversationForCLILocal(ctx context.Context, query GetConversationForCLILocalQuery) (res GetConversationForCLILocalRes, err error) {
	__arg := GetConversationForCLILocalArg{Query: query}
	err = c.Cli.Call(ctx, "chat.1.local.getConversationForCLILocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetMessagesLocal(ctx context.Context, __arg GetMessagesLocalArg) (res GetMessagesLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.GetMessagesLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostFileAttachmentLocal(ctx context.Context, __arg PostFileAttachmentLocalArg) (res PostLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postFileAttachmentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PostFileAttachmentLocalNonblock(ctx context.Context, __arg PostFileAttachmentLocalNonblockArg) (res PostLocalNonblockRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.postFileAttachmentLocalNonblock", []interface{}{__arg}, &res, 30000*time.Millisecond)
	return
}

func (c LocalClient) GetNextAttachmentMessageLocal(ctx context.Context, __arg GetNextAttachmentMessageLocalArg) (res GetNextAttachmentMessageLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getNextAttachmentMessageLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) DownloadAttachmentLocal(ctx context.Context, __arg DownloadAttachmentLocalArg) (res DownloadAttachmentLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.DownloadAttachmentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) DownloadFileAttachmentLocal(ctx context.Context, __arg DownloadFileAttachmentLocalArg) (res DownloadFileAttachmentLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.DownloadFileAttachmentLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ConfigureFileAttachmentDownloadLocal(ctx context.Context, __arg ConfigureFileAttachmentDownloadLocalArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.ConfigureFileAttachmentDownloadLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) MakePreview(ctx context.Context, __arg MakePreviewArg) (res MakePreviewRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.makePreview", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) MakeAudioPreview(ctx context.Context, __arg MakeAudioPreviewArg) (res MakePreviewRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.makeAudioPreview", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetUploadTempFile(ctx context.Context, __arg GetUploadTempFileArg) (res string, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getUploadTempFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) MakeUploadTempFile(ctx context.Context, __arg MakeUploadTempFileArg) (res string, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.makeUploadTempFile", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) CancelUploadTempFile(ctx context.Context, outboxID OutboxID) (err error) {
	__arg := CancelUploadTempFileArg{OutboxID: outboxID}
	err = c.Cli.Call(ctx, "chat.1.local.cancelUploadTempFile", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) CancelPost(ctx context.Context, outboxID OutboxID) (err error) {
	__arg := CancelPostArg{OutboxID: outboxID}
	err = c.Cli.Call(ctx, "chat.1.local.CancelPost", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) RetryPost(ctx context.Context, __arg RetryPostArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.RetryPost", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) MarkAsReadLocal(ctx context.Context, __arg MarkAsReadLocalArg) (res MarkAsReadLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.markAsReadLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) MarkTLFAsReadLocal(ctx context.Context, __arg MarkTLFAsReadLocalArg) (res MarkTLFAsReadLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.markTLFAsReadLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) FindConversationsLocal(ctx context.Context, __arg FindConversationsLocalArg) (res FindConversationsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.findConversationsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) FindGeneralConvFromTeamID(ctx context.Context, teamID keybase1.TeamID) (res InboxUIItem, err error) {
	__arg := FindGeneralConvFromTeamIDArg{TeamID: teamID}
	err = c.Cli.Call(ctx, "chat.1.local.findGeneralConvFromTeamID", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) UpdateTyping(ctx context.Context, __arg UpdateTypingArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.updateTyping", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) UpdateUnsentText(ctx context.Context, __arg UpdateUnsentTextArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.updateUnsentText", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) JoinConversationLocal(ctx context.Context, __arg JoinConversationLocalArg) (res JoinLeaveConversationLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.joinConversationLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) JoinConversationByIDLocal(ctx context.Context, convID ConversationID) (res JoinLeaveConversationLocalRes, err error) {
	__arg := JoinConversationByIDLocalArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.joinConversationByIDLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) LeaveConversationLocal(ctx context.Context, convID ConversationID) (res JoinLeaveConversationLocalRes, err error) {
	__arg := LeaveConversationLocalArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.leaveConversationLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PreviewConversationByIDLocal(ctx context.Context, convID ConversationID) (res PreviewConversationLocalRes, err error) {
	__arg := PreviewConversationByIDLocalArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.previewConversationByIDLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) DeleteConversationLocal(ctx context.Context, __arg DeleteConversationLocalArg) (res DeleteConversationLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.deleteConversationLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) RemoveFromConversationLocal(ctx context.Context, __arg RemoveFromConversationLocalArg) (res RemoveFromConversationLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.removeFromConversationLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetTLFConversationsLocal(ctx context.Context, __arg GetTLFConversationsLocalArg) (res GetTLFConversationsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getTLFConversationsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetChannelMembershipsLocal(ctx context.Context, __arg GetChannelMembershipsLocalArg) (res GetChannelMembershipsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getChannelMembershipsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetMutualTeamsLocal(ctx context.Context, usernames []string) (res GetMutualTeamsLocalRes, err error) {
	__arg := GetMutualTeamsLocalArg{Usernames: usernames}
	err = c.Cli.Call(ctx, "chat.1.local.getMutualTeamsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetAppNotificationSettingsLocal(ctx context.Context, __arg SetAppNotificationSettingsLocalArg) (res SetAppNotificationSettingsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setAppNotificationSettingsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetGlobalAppNotificationSettingsLocal(ctx context.Context, settings map[string]bool) (err error) {
	__arg := SetGlobalAppNotificationSettingsLocalArg{Settings: settings}
	err = c.Cli.Call(ctx, "chat.1.local.setGlobalAppNotificationSettingsLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetGlobalAppNotificationSettingsLocal(ctx context.Context) (res GlobalAppNotificationSettings, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getGlobalAppNotificationSettingsLocal", []interface{}{GetGlobalAppNotificationSettingsLocalArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) UnboxMobilePushNotification(ctx context.Context, __arg UnboxMobilePushNotificationArg) (res string, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.unboxMobilePushNotification", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AddTeamMemberAfterReset(ctx context.Context, __arg AddTeamMemberAfterResetArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.addTeamMemberAfterReset", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetAllResetConvMembers(ctx context.Context) (res GetAllResetConvMembersRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getAllResetConvMembers", []interface{}{GetAllResetConvMembersArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetConvRetentionLocal(ctx context.Context, __arg SetConvRetentionLocalArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setConvRetentionLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SetTeamRetentionLocal(ctx context.Context, __arg SetTeamRetentionLocalArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setTeamRetentionLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetTeamRetentionLocal(ctx context.Context, teamID keybase1.TeamID) (res *RetentionPolicy, err error) {
	__arg := GetTeamRetentionLocalArg{TeamID: teamID}
	err = c.Cli.Call(ctx, "chat.1.local.getTeamRetentionLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetConvMinWriterRoleLocal(ctx context.Context, __arg SetConvMinWriterRoleLocalArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setConvMinWriterRoleLocal", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) UpgradeKBFSConversationToImpteam(ctx context.Context, convID ConversationID) (err error) {
	__arg := UpgradeKBFSConversationToImpteamArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.upgradeKBFSConversationToImpteam", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SearchRegexp(ctx context.Context, __arg SearchRegexpArg) (res SearchRegexpRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.searchRegexp", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) CancelActiveInboxSearch(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.cancelActiveInboxSearch", []interface{}{CancelActiveInboxSearchArg{}}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SearchInbox(ctx context.Context, __arg SearchInboxArg) (res SearchInboxRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.searchInbox", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SimpleSearchInboxConvNames(ctx context.Context, query string) (res []SimpleSearchInboxConvNamesHit, err error) {
	__arg := SimpleSearchInboxConvNamesArg{Query: query}
	err = c.Cli.Call(ctx, "chat.1.local.simpleSearchInboxConvNames", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) CancelActiveSearch(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.cancelActiveSearch", []interface{}{CancelActiveSearchArg{}}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ProfileChatSearch(ctx context.Context, identifyBehavior keybase1.TLFIdentifyBehavior) (res map[ConvIDStr]ProfileSearchConvStats, err error) {
	__arg := ProfileChatSearchArg{IdentifyBehavior: identifyBehavior}
	err = c.Cli.Call(ctx, "chat.1.local.profileChatSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetStaticConfig(ctx context.Context) (res StaticConfig, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getStaticConfig", []interface{}{GetStaticConfigArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ResolveUnfurlPrompt(ctx context.Context, __arg ResolveUnfurlPromptArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.resolveUnfurlPrompt", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetUnfurlSettings(ctx context.Context) (res UnfurlSettingsDisplay, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getUnfurlSettings", []interface{}{GetUnfurlSettingsArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SaveUnfurlSettings(ctx context.Context, __arg SaveUnfurlSettingsArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.saveUnfurlSettings", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) ToggleMessageCollapse(ctx context.Context, __arg ToggleMessageCollapseArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.toggleMessageCollapse", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) BulkAddToConv(ctx context.Context, __arg BulkAddToConvArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.bulkAddToConv", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) BulkAddToManyConvs(ctx context.Context, __arg BulkAddToManyConvsArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.bulkAddToManyConvs", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) PutReacjiSkinTone(ctx context.Context, skinTone keybase1.ReacjiSkinTone) (res keybase1.UserReacjis, err error) {
	__arg := PutReacjiSkinToneArg{SkinTone: skinTone}
	err = c.Cli.Call(ctx, "chat.1.local.putReacjiSkinTone", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ResolveMaybeMention(ctx context.Context, mention MaybeMention) (err error) {
	__arg := ResolveMaybeMentionArg{Mention: mention}
	err = c.Cli.Call(ctx, "chat.1.local.resolveMaybeMention", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) LoadGallery(ctx context.Context, __arg LoadGalleryArg) (res LoadGalleryRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.loadGallery", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) LoadFlip(ctx context.Context, __arg LoadFlipArg) (res LoadFlipRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.loadFlip", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) LocationUpdate(ctx context.Context, coord Coordinate) (err error) {
	__arg := LocationUpdateArg{Coord: coord}
	err = c.Cli.Call(ctx, "chat.1.local.locationUpdate", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) AdvertiseBotCommandsLocal(ctx context.Context, __arg AdvertiseBotCommandsLocalArg) (res AdvertiseBotCommandsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.advertiseBotCommandsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ListBotCommandsLocal(ctx context.Context, convID ConversationID) (res ListBotCommandsLocalRes, err error) {
	__arg := ListBotCommandsLocalArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.listBotCommandsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ListPublicBotCommandsLocal(ctx context.Context, username string) (res ListBotCommandsLocalRes, err error) {
	__arg := ListPublicBotCommandsLocalArg{Username: username}
	err = c.Cli.Call(ctx, "chat.1.local.listPublicBotCommandsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ClearBotCommandsLocal(ctx context.Context, filter *ClearBotCommandsFilter) (res ClearBotCommandsLocalRes, err error) {
	__arg := ClearBotCommandsLocalArg{Filter: filter}
	err = c.Cli.Call(ctx, "chat.1.local.clearBotCommandsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) PinMessage(ctx context.Context, __arg PinMessageArg) (res PinMessageRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.pinMessage", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) UnpinMessage(ctx context.Context, convID ConversationID) (res PinMessageRes, err error) {
	__arg := UnpinMessageArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.unpinMessage", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) IgnorePinnedMessage(ctx context.Context, convID ConversationID) (err error) {
	__arg := IgnorePinnedMessageArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.ignorePinnedMessage", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) AddBotMember(ctx context.Context, __arg AddBotMemberArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.addBotMember", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) EditBotMember(ctx context.Context, __arg EditBotMemberArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.editBotMember", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) RemoveBotMember(ctx context.Context, __arg RemoveBotMemberArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.removeBotMember", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SetBotMemberSettings(ctx context.Context, __arg SetBotMemberSettingsArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setBotMemberSettings", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetBotMemberSettings(ctx context.Context, __arg GetBotMemberSettingsArg) (res keybase1.TeamBotSettings, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getBotMemberSettings", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetTeamRoleInConversation(ctx context.Context, __arg GetTeamRoleInConversationArg) (res keybase1.TeamRole, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getTeamRoleInConversation", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AddBotConvSearch(ctx context.Context, term string) (res []ConvSearchHit, err error) {
	__arg := AddBotConvSearchArg{Term: term}
	err = c.Cli.Call(ctx, "chat.1.local.addBotConvSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ForwardMessageConvSearch(ctx context.Context, term string) (res []ConvSearchHit, err error) {
	__arg := ForwardMessageConvSearchArg{Term: term}
	err = c.Cli.Call(ctx, "chat.1.local.forwardMessageConvSearch", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) TeamIDFromTLFName(ctx context.Context, __arg TeamIDFromTLFNameArg) (res keybase1.TeamID, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.teamIDFromTLFName", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) DismissJourneycard(ctx context.Context, __arg DismissJourneycardArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.dismissJourneycard", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) SetWelcomeMessage(ctx context.Context, __arg SetWelcomeMessageArg) (err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setWelcomeMessage", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetWelcomeMessage(ctx context.Context, teamID keybase1.TeamID) (res WelcomeMessageDisplay, err error) {
	__arg := GetWelcomeMessageArg{TeamID: teamID}
	err = c.Cli.Call(ctx, "chat.1.local.getWelcomeMessage", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetDefaultTeamChannelsLocal(ctx context.Context, teamID keybase1.TeamID) (res GetDefaultTeamChannelsLocalRes, err error) {
	__arg := GetDefaultTeamChannelsLocalArg{TeamID: teamID}
	err = c.Cli.Call(ctx, "chat.1.local.getDefaultTeamChannelsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) SetDefaultTeamChannelsLocal(ctx context.Context, __arg SetDefaultTeamChannelsLocalArg) (res SetDefaultTeamChannelsLocalRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.setDefaultTeamChannelsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetLastActiveForTLF(ctx context.Context, tlfID TLFIDStr) (res LastActiveStatus, err error) {
	__arg := GetLastActiveForTLFArg{TlfID: tlfID}
	err = c.Cli.Call(ctx, "chat.1.local.getLastActiveForTLF", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetLastActiveForTeams(ctx context.Context) (res LastActiveStatusAll, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getLastActiveForTeams", []interface{}{GetLastActiveForTeamsArg{}}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetRecentJoinsLocal(ctx context.Context, convID ConversationID) (res int, err error) {
	__arg := GetRecentJoinsLocalArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.getRecentJoinsLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) RefreshParticipants(ctx context.Context, convID ConversationID) (err error) {
	__arg := RefreshParticipantsArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.refreshParticipants", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LocalClient) GetLastActiveAtLocal(ctx context.Context, __arg GetLastActiveAtLocalArg) (res gregor1.Time, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getLastActiveAtLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetLastActiveAtMultiLocal(ctx context.Context, __arg GetLastActiveAtMultiLocalArg) (res map[keybase1.TeamID]gregor1.Time, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.getLastActiveAtMultiLocal", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) GetParticipants(ctx context.Context, convID ConversationID) (res []ConversationLocalParticipant, err error) {
	__arg := GetParticipantsArg{ConvID: convID}
	err = c.Cli.Call(ctx, "chat.1.local.getParticipants", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AddEmoji(ctx context.Context, __arg AddEmojiArg) (res AddEmojiRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.addEmoji", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AddEmojis(ctx context.Context, __arg AddEmojisArg) (res AddEmojisRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.addEmojis", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) AddEmojiAlias(ctx context.Context, __arg AddEmojiAliasArg) (res AddEmojiAliasRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.addEmojiAlias", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) RemoveEmoji(ctx context.Context, __arg RemoveEmojiArg) (res RemoveEmojiRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.removeEmoji", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) UserEmojis(ctx context.Context, __arg UserEmojisArg) (res UserEmojiRes, err error) {
	err = c.Cli.Call(ctx, "chat.1.local.userEmojis", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c LocalClient) ToggleEmojiAnimations(ctx context.Context, enabled bool) (err error) {
	__arg := ToggleEmojiAnimationsArg{Enabled: enabled}
	err = c.Cli.Call(ctx, "chat.1.local.toggleEmojiAnimations", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
