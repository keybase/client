// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/chat1/local.avdl

package chat1

import (
	"errors"
	"fmt"

	gregor1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/gregor1"
	keybase1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
	stellar1 "github.com/keybase/go-keybase-chat-bot/kbchat/types/stellar1"
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
	Body         string             `codec:"body" json:"body"`
	Payments     []TextPayment      `codec:"payments" json:"payments"`
	ReplyTo      *MessageID         `codec:"replyTo,omitempty" json:"replyTo,omitempty"`
	ReplyToUID   *gregor1.UID       `codec:"replyToUID,omitempty" json:"replyToUID,omitempty"`
	UserMentions []KnownUserMention `codec:"userMentions" json:"userMentions"`
	TeamMentions []KnownTeamMention `codec:"teamMentions" json:"teamMentions"`
	LiveLocation *LiveLocation      `codec:"liveLocation,omitempty" json:"liveLocation,omitempty"`
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
	MessageID    MessageID          `codec:"messageID" json:"messageID"`
	Body         string             `codec:"body" json:"body"`
	UserMentions []KnownUserMention `codec:"userMentions" json:"userMentions"`
	TeamMentions []KnownTeamMention `codec:"teamMentions" json:"teamMentions"`
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
	Headline string `codec:"headline" json:"headline"`
}

func (o MessageHeadline) DeepCopy() MessageHeadline {
	return MessageHeadline{
		Headline: o.Headline,
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
}

func (e MessageSystemType) String() string {
	if v, ok := MessageSystemTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type MessageSystemAddedToTeam struct {
	Team           string            `codec:"team" json:"team"`
	Adder          string            `codec:"adder" json:"adder"`
	Addee          string            `codec:"addee" json:"addee"`
	Role           keybase1.TeamRole `codec:"role" json:"role"`
	BulkAdds       []string          `codec:"bulkAdds" json:"bulkAdds"`
	Owners         []string          `codec:"owners" json:"owners"`
	Admins         []string          `codec:"admins" json:"admins"`
	Writers        []string          `codec:"writers" json:"writers"`
	Readers        []string          `codec:"readers" json:"readers"`
	Bots           []string          `codec:"bots" json:"bots"`
	RestrictedBots []string          `codec:"restrictedBots" json:"restrictedBots"`
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
		Owners: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Owners),
		Admins: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Admins),
		Writers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Writers),
		Readers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Readers),
		Bots: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Bots),
		RestrictedBots: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.RestrictedBots),
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
	Object   Asset   `codec:"object" json:"object"`
	Preview  *Asset  `codec:"preview,omitempty" json:"preview,omitempty"`
	Previews []Asset `codec:"previews" json:"previews"`
	Metadata []byte  `codec:"metadata" json:"metadata"`
	Uploaded bool    `codec:"uploaded" json:"uploaded"`
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
	MessageID MessageID `codec:"m" json:"m"`
	Body      string    `codec:"b" json:"b"`
}

func (o MessageReaction) DeepCopy() MessageReaction {
	return MessageReaction{
		MessageID: o.MessageID.DeepCopy(),
		Body:      o.Body,
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
	}
}

type MessageUnboxedValid struct {
	ClientHeader          MessageClientHeaderVerified `codec:"clientHeader" json:"clientHeader"`
	ServerHeader          MessageServerHeader         `codec:"serverHeader" json:"serverHeader"`
	MessageBody           MessageBody                 `codec:"messageBody" json:"messageBody"`
	SenderUsername        string                      `codec:"senderUsername" json:"senderUsername"`
	SenderDeviceName      string                      `codec:"senderDeviceName" json:"senderDeviceName"`
	SenderDeviceType      string                      `codec:"senderDeviceType" json:"senderDeviceType"`
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
		SenderDeviceType: o.SenderDeviceType,
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
	SenderDeviceType string                  `codec:"senderDeviceType" json:"senderDeviceType"`
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
		SenderDeviceType: o.SenderDeviceType,
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
	Id            ConversationID                 `codec:"id" json:"id"`
	Triple        ConversationIDTriple           `codec:"triple" json:"triple"`
	TlfName       string                         `codec:"tlfName" json:"tlfName"`
	TopicName     string                         `codec:"topicName" json:"topicName"`
	Headline      string                         `codec:"headline" json:"headline"`
	SnippetMsg    *MessageUnboxed                `codec:"snippetMsg,omitempty" json:"snippetMsg,omitempty"`
	PinnedMsg     *ConversationPinnedMessage     `codec:"pinnedMsg,omitempty" json:"pinnedMsg,omitempty"`
	Draft         *string                        `codec:"draft,omitempty" json:"draft,omitempty"`
	Visibility    keybase1.TLFVisibility         `codec:"visibility" json:"visibility"`
	IsDefaultConv bool                           `codec:"isDefaultConv" json:"isDefaultConv"`
	Status        ConversationStatus             `codec:"status" json:"status"`
	MembersType   ConversationMembersType        `codec:"membersType" json:"membersType"`
	MemberStatus  ConversationMemberStatus       `codec:"memberStatus" json:"memberStatus"`
	TeamType      TeamType                       `codec:"teamType" json:"teamType"`
	Existence     ConversationExistence          `codec:"existence" json:"existence"`
	Version       ConversationVers               `codec:"version" json:"version"`
	LocalVersion  LocalConversationVers          `codec:"localVersion" json:"localVersion"`
	Participants  []ConversationLocalParticipant `codec:"participants" json:"participants"`
	FinalizeInfo  *ConversationFinalizeInfo      `codec:"finalizeInfo,omitempty" json:"finalizeInfo,omitempty"`
	ResetNames    []string                       `codec:"resetNames" json:"resetNames"`
}

func (o ConversationInfoLocal) DeepCopy() ConversationInfoLocal {
	return ConversationInfoLocal{
		Id:        o.Id.DeepCopy(),
		Triple:    o.Triple.DeepCopy(),
		TlfName:   o.TlfName,
		TopicName: o.TopicName,
		Headline:  o.Headline,
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

type AddBotConvSearchHit struct {
	Name   string         `codec:"name" json:"name"`
	ConvID ConversationID `codec:"convID" json:"convID"`
	IsTeam bool           `codec:"isTeam" json:"isTeam"`
	Parts  []string       `codec:"parts" json:"parts"`
}

func (o AddBotConvSearchHit) DeepCopy() AddBotConvSearchHit {
	return AddBotConvSearchHit{
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
