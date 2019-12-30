// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/chat1/api.avdl

package chat1

import (
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type RateLimitRes struct {
	Tank     string `codec:"tank" json:"tank"`
	Capacity int    `codec:"capacity" json:"capacity"`
	Reset    int    `codec:"reset" json:"reset"`
	Gas      int    `codec:"gas" json:"gas"`
}

func (o RateLimitRes) DeepCopy() RateLimitRes {
	return RateLimitRes{
		Tank:     o.Tank,
		Capacity: o.Capacity,
		Reset:    o.Reset,
		Gas:      o.Gas,
	}
}

// A Keybase chat channel. This can be a channel in a team, or just an informal channel between two users.
// name: the name of the team or comma-separated list of participants
type ChatChannel struct {
	Name        string `codec:"name" json:"name"`
	Public      bool   `codec:"public,omitempty" json:"public,omitempty"`
	MembersType string `codec:"membersType,omitempty" json:"members_type,omitempty"`
	TopicType   string `codec:"topicType,omitempty" json:"topic_type,omitempty"`
	TopicName   string `codec:"topicName,omitempty" json:"topic_name,omitempty"`
}

func (o ChatChannel) DeepCopy() ChatChannel {
	return ChatChannel{
		Name:        o.Name,
		Public:      o.Public,
		MembersType: o.MembersType,
		TopicType:   o.TopicType,
		TopicName:   o.TopicName,
	}
}

// A chat message. The content goes in the `body` property!
type ChatMessage struct {
	Body string `codec:"body" json:"body"`
}

func (o ChatMessage) DeepCopy() ChatMessage {
	return ChatMessage{
		Body: o.Body,
	}
}

type MsgSender struct {
	Uid        string `codec:"uid" json:"uid"`
	Username   string `codec:"username,omitempty" json:"username,omitempty"`
	DeviceID   string `codec:"deviceID" json:"device_id"`
	DeviceName string `codec:"deviceName,omitempty" json:"device_name,omitempty"`
}

func (o MsgSender) DeepCopy() MsgSender {
	return MsgSender{
		Uid:        o.Uid,
		Username:   o.Username,
		DeviceID:   o.DeviceID,
		DeviceName: o.DeviceName,
	}
}

type MsgBotInfo struct {
	BotUID      string `codec:"botUID" json:"bot_uid"`
	BotUsername string `codec:"botUsername,omitempty" json:"bot_username,omitempty"`
}

func (o MsgBotInfo) DeepCopy() MsgBotInfo {
	return MsgBotInfo{
		BotUID:      o.BotUID,
		BotUsername: o.BotUsername,
	}
}

type MsgFlipContent struct {
	Text         string             `codec:"text" json:"text"`
	GameID       string             `codec:"gameID" json:"game_id"`
	FlipConvID   string             `codec:"flipConvID" json:"flip_conv_id"`
	UserMentions []KnownUserMention `codec:"userMentions" json:"user_mentions"`
	TeamMentions []KnownTeamMention `codec:"teamMentions" json:"team_mentions"`
}

func (o MsgFlipContent) DeepCopy() MsgFlipContent {
	return MsgFlipContent{
		Text:       o.Text,
		GameID:     o.GameID,
		FlipConvID: o.FlipConvID,
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

type MsgContent struct {
	TypeName           string                       `codec:"typeName" json:"type"`
	Text               *MessageText                 `codec:"text,omitempty" json:"text,omitempty"`
	Attachment         *MessageAttachment           `codec:"attachment,omitempty" json:"attachment,omitempty"`
	Edit               *MessageEdit                 `codec:"edit,omitempty" json:"edit,omitempty"`
	Reaction           *MessageReaction             `codec:"reaction,omitempty" json:"reaction,omitempty"`
	Delete             *MessageDelete               `codec:"delete,omitempty" json:"delete,omitempty"`
	Metadata           *MessageConversationMetadata `codec:"metadata,omitempty" json:"metadata,omitempty"`
	Headline           *MessageHeadline             `codec:"headline,omitempty" json:"headline,omitempty"`
	AttachmentUploaded *MessageAttachmentUploaded   `codec:"attachmentUploaded,omitempty" json:"attachment_uploaded,omitempty"`
	System             *MessageSystem               `codec:"system,omitempty" json:"system,omitempty"`
	SendPayment        *MessageSendPayment          `codec:"sendPayment,omitempty" json:"send_payment,omitempty"`
	RequestPayment     *MessageRequestPayment       `codec:"requestPayment,omitempty" json:"request_payment,omitempty"`
	Unfurl             *MessageUnfurl               `codec:"unfurl,omitempty" json:"unfurl,omitempty"`
	Flip               *MsgFlipContent              `codec:"flip,omitempty" json:"flip,omitempty"`
}

func (o MsgContent) DeepCopy() MsgContent {
	return MsgContent{
		TypeName: o.TypeName,
		Text: (func(x *MessageText) *MessageText {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Text),
		Attachment: (func(x *MessageAttachment) *MessageAttachment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Attachment),
		Edit: (func(x *MessageEdit) *MessageEdit {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Edit),
		Reaction: (func(x *MessageReaction) *MessageReaction {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Reaction),
		Delete: (func(x *MessageDelete) *MessageDelete {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Delete),
		Metadata: (func(x *MessageConversationMetadata) *MessageConversationMetadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Metadata),
		Headline: (func(x *MessageHeadline) *MessageHeadline {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Headline),
		AttachmentUploaded: (func(x *MessageAttachmentUploaded) *MessageAttachmentUploaded {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.AttachmentUploaded),
		System: (func(x *MessageSystem) *MessageSystem {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.System),
		SendPayment: (func(x *MessageSendPayment) *MessageSendPayment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SendPayment),
		RequestPayment: (func(x *MessageRequestPayment) *MessageRequestPayment {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RequestPayment),
		Unfurl: (func(x *MessageUnfurl) *MessageUnfurl {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Unfurl),
		Flip: (func(x *MsgFlipContent) *MsgFlipContent {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Flip),
	}
}

type MsgSummary struct {
	Id                  MessageID                `codec:"id" json:"id"`
	ConvID              string                   `codec:"convID" json:"conversation_id"`
	Channel             ChatChannel              `codec:"channel" json:"channel"`
	Sender              MsgSender                `codec:"sender" json:"sender"`
	SentAt              int64                    `codec:"sentAt" json:"sent_at"`
	SentAtMs            int64                    `codec:"sentAtMs" json:"sent_at_ms"`
	Content             MsgContent               `codec:"content" json:"content"`
	Prev                []MessagePreviousPointer `codec:"prev" json:"prev"`
	Unread              bool                     `codec:"unread" json:"unread"`
	RevokedDevice       bool                     `codec:"revokedDevice,omitempty" json:"revoked_device,omitempty"`
	Offline             bool                     `codec:"offline,omitempty" json:"offline,omitempty"`
	KbfsEncrypted       bool                     `codec:"kbfsEncrypted,omitempty" json:"kbfs_encrypted,omitempty"`
	IsEphemeral         bool                     `codec:"isEphemeral,omitempty" json:"is_ephemeral,omitempty"`
	IsEphemeralExpired  bool                     `codec:"isEphemeralExpired,omitempty" json:"is_ephemeral_expired,omitempty"`
	ETime               gregor1.Time             `codec:"eTime,omitempty" json:"e_time,omitempty"`
	Reactions           *ReactionMap             `codec:"reactions,omitempty" json:"reactions,omitempty"`
	HasPairwiseMacs     bool                     `codec:"hasPairwiseMacs,omitempty" json:"has_pairwise_macs,omitempty"`
	AtMentionUsernames  []string                 `codec:"atMentionUsernames,omitempty" json:"at_mention_usernames,omitempty"`
	ChannelMention      string                   `codec:"channelMention,omitempty" json:"channel_mention,omitempty"`
	ChannelNameMentions []UIChannelNameMention   `codec:"channelNameMentions,omitempty" json:"channel_name_mentions,omitempty"`
	BotInfo             *MsgBotInfo              `codec:"botInfo,omitempty" json:"bot_info,omitempty"`
}

func (o MsgSummary) DeepCopy() MsgSummary {
	return MsgSummary{
		Id:       o.Id.DeepCopy(),
		ConvID:   o.ConvID,
		Channel:  o.Channel.DeepCopy(),
		Sender:   o.Sender.DeepCopy(),
		SentAt:   o.SentAt,
		SentAtMs: o.SentAtMs,
		Content:  o.Content.DeepCopy(),
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
		Unread:             o.Unread,
		RevokedDevice:      o.RevokedDevice,
		Offline:            o.Offline,
		KbfsEncrypted:      o.KbfsEncrypted,
		IsEphemeral:        o.IsEphemeral,
		IsEphemeralExpired: o.IsEphemeralExpired,
		ETime:              o.ETime.DeepCopy(),
		Reactions: (func(x *ReactionMap) *ReactionMap {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Reactions),
		HasPairwiseMacs: o.HasPairwiseMacs,
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
		ChannelMention: o.ChannelMention,
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
		BotInfo: (func(x *MsgBotInfo) *MsgBotInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.BotInfo),
	}
}

type Message struct {
	Msg   *MsgSummary `codec:"msg,omitempty" json:"msg,omitempty"`
	Error *string     `codec:"error,omitempty" json:"error,omitempty"`
}

func (o Message) DeepCopy() Message {
	return Message{
		Msg: (func(x *MsgSummary) *MsgSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Msg),
		Error: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Error),
	}
}

type Thread struct {
	Messages         []Message                     `codec:"messages" json:"messages"`
	Pagination       *Pagination                   `codec:"pagination,omitempty" json:"pagination,omitempty"`
	Offline          bool                          `codec:"offline,omitempty" json:"offline,omitempty"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures,omitempty" json:"identify_failures,omitempty"`
	RateLimits       []RateLimitRes                `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o Thread) DeepCopy() Thread {
	return Thread{
		Messages: (func(x []Message) []Message {
			if x == nil {
				return nil
			}
			ret := make([]Message, len(x))
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
		Offline: o.Offline,
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

// A chat conversation. This is essentially a chat channel plus some additional metadata.
type ConvSummary struct {
	Id           string                    `codec:"id" json:"id"`
	Channel      ChatChannel               `codec:"channel" json:"channel"`
	Unread       bool                      `codec:"unread" json:"unread"`
	ActiveAt     int64                     `codec:"activeAt" json:"active_at"`
	ActiveAtMs   int64                     `codec:"activeAtMs" json:"active_at_ms"`
	MemberStatus string                    `codec:"memberStatus" json:"member_status"`
	ResetUsers   []string                  `codec:"resetUsers,omitempty" json:"reset_users,omitempty"`
	FinalizeInfo *ConversationFinalizeInfo `codec:"finalizeInfo,omitempty" json:"finalize_info,omitempty"`
	Supersedes   []string                  `codec:"supersedes,omitempty" json:"supersedes,omitempty"`
	SupersededBy []string                  `codec:"supersededBy,omitempty" json:"superseded_by,omitempty"`
	Error        string                    `codec:"error,omitempty" json:"error,omitempty"`
}

func (o ConvSummary) DeepCopy() ConvSummary {
	return ConvSummary{
		Id:           o.Id,
		Channel:      o.Channel.DeepCopy(),
		Unread:       o.Unread,
		ActiveAt:     o.ActiveAt,
		ActiveAtMs:   o.ActiveAtMs,
		MemberStatus: o.MemberStatus,
		ResetUsers: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ResetUsers),
		FinalizeInfo: (func(x *ConversationFinalizeInfo) *ConversationFinalizeInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FinalizeInfo),
		Supersedes: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Supersedes),
		SupersededBy: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.SupersededBy),
		Error: o.Error,
	}
}

type ChatList struct {
	Conversations    []ConvSummary                 `codec:"conversations" json:"conversations"`
	Offline          bool                          `codec:"offline" json:"offline"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures,omitempty" json:"identify_failures,omitempty"`
	RateLimits       []RateLimitRes                `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o ChatList) DeepCopy() ChatList {
	return ChatList{
		Conversations: (func(x []ConvSummary) []ConvSummary {
			if x == nil {
				return nil
			}
			ret := make([]ConvSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Conversations),
		Offline: o.Offline,
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type SendRes struct {
	Message          string                        `codec:"message" json:"message"`
	MessageID        *MessageID                    `codec:"messageID,omitempty" json:"id,omitempty"`
	OutboxID         *OutboxID                     `codec:"outboxID,omitempty" json:"outbox_id,omitempty"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures,omitempty" json:"identify_failures,omitempty"`
	RateLimits       []RateLimitRes                `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o SendRes) DeepCopy() SendRes {
	return SendRes{
		Message: o.Message,
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type SearchInboxResOutput struct {
	Results          *ChatSearchInboxResults       `codec:"results,omitempty" json:"results,omitempty"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures,omitempty" json:"identify_failures,omitempty"`
	RateLimits       []RateLimitRes                `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o SearchInboxResOutput) DeepCopy() SearchInboxResOutput {
	return SearchInboxResOutput{
		Results: (func(x *ChatSearchInboxResults) *ChatSearchInboxResults {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Results),
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type RegexpRes struct {
	Hits             []ChatSearchHit               `codec:"hits" json:"hits"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures,omitempty" json:"identify_failures,omitempty"`
	RateLimits       []RateLimitRes                `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o RegexpRes) DeepCopy() RegexpRes {
	return RegexpRes{
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type NewConvRes struct {
	Id               string                        `codec:"id" json:"id"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `codec:"identifyFailures,omitempty" json:"identify_failures,omitempty"`
	RateLimits       []RateLimitRes                `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o NewConvRes) DeepCopy() NewConvRes {
	return NewConvRes{
		Id: o.Id,
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type ListCommandsRes struct {
	Commands   []UserBotCommandOutput `codec:"commands" json:"commands"`
	RateLimits []RateLimitRes         `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o ListCommandsRes) DeepCopy() ListCommandsRes {
	return ListCommandsRes{
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
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type EmptyRes struct {
	RateLimits []RateLimitRes `codec:"rateLimits,omitempty" json:"ratelimits,omitempty"`
}

func (o EmptyRes) DeepCopy() EmptyRes {
	return EmptyRes{
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type MsgNotification struct {
	Type       string        `codec:"type" json:"type"`
	Source     string        `codec:"source" json:"source"`
	Msg        *MsgSummary   `codec:"msg,omitempty" json:"msg,omitempty"`
	Error      *string       `codec:"error,omitempty" json:"error,omitempty"`
	Pagination *UIPagination `codec:"pagination,omitempty" json:"pagination,omitempty"`
}

func (o MsgNotification) DeepCopy() MsgNotification {
	return MsgNotification{
		Type:   o.Type,
		Source: o.Source,
		Msg: (func(x *MsgSummary) *MsgSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Msg),
		Error: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Error),
		Pagination: (func(x *UIPagination) *UIPagination {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pagination),
	}
}

type ConvNotification struct {
	Type  string       `codec:"type" json:"type"`
	Conv  *ConvSummary `codec:"conv,omitempty" json:"conv,omitempty"`
	Error *string      `codec:"error,omitempty" json:"error,omitempty"`
}

func (o ConvNotification) DeepCopy() ConvNotification {
	return ConvNotification{
		Type: o.Type,
		Conv: (func(x *ConvSummary) *ConvSummary {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Conv),
		Error: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Error),
	}
}

type AdvertiseCommandAPIParam struct {
	Typ      string                `codec:"typ" json:"type"`
	Commands []UserBotCommandInput `codec:"commands" json:"commands"`
	TeamName string                `codec:"teamName,omitempty" json:"team_name,omitempty"`
}

func (o AdvertiseCommandAPIParam) DeepCopy() AdvertiseCommandAPIParam {
	return AdvertiseCommandAPIParam{
		Typ: o.Typ,
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
		TeamName: o.TeamName,
	}
}

type ResetConvMemberAPI struct {
	ConversationID string `codec:"conversationID" json:"conversationID"`
	Username       string `codec:"username" json:"username"`
}

func (o ResetConvMemberAPI) DeepCopy() ResetConvMemberAPI {
	return ResetConvMemberAPI{
		ConversationID: o.ConversationID,
		Username:       o.Username,
	}
}

type GetResetConvMembersRes struct {
	Members    []ResetConvMemberAPI `codec:"members" json:"members"`
	RateLimits []RateLimitRes       `codec:"rateLimits" json:"rateLimits"`
}

func (o GetResetConvMembersRes) DeepCopy() GetResetConvMembersRes {
	return GetResetConvMembersRes{
		Members: (func(x []ResetConvMemberAPI) []ResetConvMemberAPI {
			if x == nil {
				return nil
			}
			ret := make([]ResetConvMemberAPI, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Members),
		RateLimits: (func(x []RateLimitRes) []RateLimitRes {
			if x == nil {
				return nil
			}
			ret := make([]RateLimitRes, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RateLimits),
	}
}

type DeviceInfo struct {
	DeviceID          string `codec:"deviceID" json:"id"`
	DeviceDescription string `codec:"deviceDescription" json:"description"`
	DeviceType        string `codec:"deviceType" json:"type"`
	DeviceCtime       int64  `codec:"deviceCtime" json:"ctime"`
}

func (o DeviceInfo) DeepCopy() DeviceInfo {
	return DeviceInfo{
		DeviceID:          o.DeviceID,
		DeviceDescription: o.DeviceDescription,
		DeviceType:        o.DeviceType,
		DeviceCtime:       o.DeviceCtime,
	}
}

type GetDeviceInfoRes struct {
	Devices []DeviceInfo `codec:"devices" json:"devices"`
}

func (o GetDeviceInfoRes) DeepCopy() GetDeviceInfoRes {
	return GetDeviceInfoRes{
		Devices: (func(x []DeviceInfo) []DeviceInfo {
			if x == nil {
				return nil
			}
			ret := make([]DeviceInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Devices),
	}
}

type ApiInterface interface {
}

func ApiProtocol(i ApiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "chat.1.api",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type ApiClient struct {
	Cli rpc.GenericClient
}
