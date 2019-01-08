package client

import (
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type chatNotificationDisplay struct {
	*baseNotificationDisplay
	svc           *chatServiceHandler
	showLocal     bool
	showExploding bool
}

func newChatNotificationDisplay(g *libkb.GlobalContext, showLocal, showExploding bool) *chatNotificationDisplay {
	return &chatNotificationDisplay{
		baseNotificationDisplay: newBaseNotificationDisplay(g),
		showLocal:               showLocal,
		showExploding:           showExploding,
		svc:                     newChatServiceHandler(g),
	}
}

type msgNotification struct {
	Source     string              `json:"source,omitempty"`
	Msg        *MsgSummary         `json:"msg,omitempty"`
	Error      *string             `json:"error,omitempty"`
	Pagination *chat1.UIPagination `json:"pagination,omitempty"`
}

func (d *chatNotificationDisplay) formatMessage(inMsg chat1.IncomingMessage) *Message {
	state, err := inMsg.Message.State()
	if err != nil {
		errStr := err.Error()
		return &Message{Error: &errStr}
	}

	switch state {
	case chat1.MessageUnboxedState_ERROR:
		errStr := inMsg.Message.Error().ErrMsg
		return &Message{Error: &errStr}
	case chat1.MessageUnboxedState_VALID:
		mv := inMsg.Message.Valid()
		summary := &MsgSummary{
			ID: mv.MessageID,
			Channel: ChatChannel{
				Name:        inMsg.Conv.Name,
				MembersType: strings.ToLower(inMsg.Conv.MembersType.String()),
				TopicType:   strings.ToLower(inMsg.Conv.TopicType.String()),
				TopicName:   inMsg.Conv.Channel,
				Public:      inMsg.Conv.Visibility == keybase1.TLFVisibility_PUBLIC,
			},
			Sender: MsgSender{
				UID:        mv.SenderUID.String(),
				DeviceID:   mv.SenderDeviceID.String(),
				Username:   mv.SenderUsername,
				DeviceName: mv.SenderDeviceName,
			},
			SentAt:              mv.Ctime.UnixSeconds(),
			SentAtMs:            mv.Ctime.UnixMilliseconds(),
			RevokedDevice:       mv.SenderDeviceRevokedAt != nil,
			IsEphemeral:         mv.IsEphemeral,
			IsEphemeralExpired:  mv.IsEphemeralExpired,
			ETime:               mv.Etime,
			HasPairwiseMacs:     mv.HasPairwiseMacs,
			Content:             d.svc.convertMsgBody(mv.MessageBody),
			AtMentionUsernames:  mv.AtMentions,
			ChannelMention:      strings.ToLower(mv.ChannelMention.String()),
			ChannelNameMentions: mv.ChannelNameMentions,
		}
		if mv.Reactions.Reactions != nil {
			summary.Reactions = &mv.Reactions
		}
		return &Message{Msg: summary}
	default:
		return nil
	}
}

func (d *chatNotificationDisplay) NewChatActivity(ctx context.Context, arg chat1.NewChatActivityArg) error {
	if !d.showLocal && arg.Source == chat1.ChatActivitySource_LOCAL {
		// Skip local message
		return nil
	}

	activity := arg.Activity
	typ, err := activity.ActivityType()
	if err != nil {
		return err
	}
	switch typ {
	case chat1.ChatActivityType_INCOMING_MESSAGE:
		inMsg := activity.IncomingMessage()
		if !d.showExploding && inMsg.Message.IsEphemeral() {
			// Skip exploding message
			return nil
		}
		msg := d.formatMessage(inMsg)
		if msg == nil {
			return nil
		}
		notif := msgNotification{
			Source:     strings.ToLower(arg.Source.String()),
			Msg:        msg.Msg,
			Error:      msg.Error,
			Pagination: inMsg.Pagination,
		}
		d.printJSON(notif)
	}
	return nil
}

func (d *chatNotificationDisplay) ChatIdentifyUpdate(context.Context, keybase1.CanonicalTLFNameAndIDWithBreaks) error {
	return nil
}
func (d *chatNotificationDisplay) ChatTLFFinalize(context.Context, chat1.ChatTLFFinalizeArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatTLFResolve(context.Context, chat1.ChatTLFResolveArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatInboxStale(context.Context, keybase1.UID) error { return nil }
func (d *chatNotificationDisplay) ChatThreadsStale(context.Context, chat1.ChatThreadsStaleArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatTypingUpdate(context.Context, []chat1.ConvTypingUpdate) error {
	return nil
}
func (d *chatNotificationDisplay) ChatJoinedConversation(context.Context, chat1.ChatJoinedConversationArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatLeftConversation(context.Context, chat1.ChatLeftConversationArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatResetConversation(context.Context, chat1.ChatResetConversationArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatInboxSyncStarted(context.Context, keybase1.UID) error {
	return nil
}
func (d *chatNotificationDisplay) ChatInboxSynced(context.Context, chat1.ChatInboxSyncedArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSetConvRetention(context.Context, chat1.ChatSetConvRetentionArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSetTeamRetention(context.Context, chat1.ChatSetTeamRetentionArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSetConvSettings(context.Context, chat1.ChatSetConvSettingsArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSubteamRename(context.Context, chat1.ChatSubteamRenameArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatKBFSToImpteamUpgrade(context.Context, chat1.ChatKBFSToImpteamUpgradeArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatAttachmentUploadStart(context.Context, chat1.ChatAttachmentUploadStartArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatAttachmentUploadProgress(context.Context, chat1.ChatAttachmentUploadProgressArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatPaymentInfo(context.Context, chat1.ChatPaymentInfoArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatRequestInfo(context.Context, chat1.ChatRequestInfoArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatPromptUnfurl(context.Context, chat1.ChatPromptUnfurlArg) error {
	return nil
}
