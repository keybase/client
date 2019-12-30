package client

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/araddon/dateparse"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// ChatServiceHandler can call the service.
type ChatServiceHandler interface {
	ListV1(context.Context, listOptionsV1) Reply
	ReadV1(context.Context, readOptionsV1) Reply
	GetV1(context.Context, getOptionsV1) Reply
	SendV1(context.Context, sendOptionsV1, chat1.ChatUiInterface) Reply
	EditV1(context.Context, editOptionsV1) Reply
	ReactionV1(context.Context, reactionOptionsV1) Reply
	DeleteV1(context.Context, deleteOptionsV1) Reply
	AttachV1(context.Context, attachOptionsV1, chat1.ChatUiInterface, chat1.NotifyChatInterface) Reply
	DownloadV1(context.Context, downloadOptionsV1, chat1.ChatUiInterface) Reply
	SetStatusV1(context.Context, setStatusOptionsV1) Reply
	MarkV1(context.Context, markOptionsV1) Reply
	SearchInboxV1(context.Context, searchInboxOptionsV1) Reply
	SearchRegexpV1(context.Context, searchRegexpOptionsV1) Reply
	NewConvV1(context.Context, newConvOptionsV1) Reply
	ListConvsOnNameV1(context.Context, listConvsOnNameOptionsV1) Reply
	JoinV1(context.Context, joinOptionsV1) Reply
	LeaveV1(context.Context, leaveOptionsV1) Reply
	AddToChannelV1(context.Context, addToChannelOptionsV1) Reply
	LoadFlipV1(context.Context, loadFlipOptionsV1) Reply
	GetUnfurlSettingsV1(context.Context) Reply
	SetUnfurlSettingsV1(context.Context, setUnfurlSettingsOptionsV1) Reply
	AdvertiseCommandsV1(context.Context, advertiseCommandsOptionsV1) Reply
	ClearCommandsV1(context.Context) Reply
	ListCommandsV1(context.Context, listCommandsOptionsV1) Reply
	PinV1(context.Context, pinOptionsV1) Reply
	UnpinV1(context.Context, unpinOptionsV1) Reply
	GetResetConvMembersV1(context.Context) Reply
	AddResetConvMemberV1(context.Context, addResetConvMemberOptionsV1) Reply
	GetDeviceInfoV1(context.Context, getDeviceInfoOptionsV1) Reply
	ListMembersV1(context.Context, listMembersOptionsV1) Reply
}

// chatServiceHandler implements ChatServiceHandler.
type chatServiceHandler struct {
	libkb.Contextified
	chatUI *DelegateChatUI
}

func newChatServiceHandler(g *libkb.GlobalContext) *chatServiceHandler {
	return &chatServiceHandler{
		Contextified: libkb.NewContextified(g),
		chatUI:       newDelegateChatUI(),
	}
}

// ListV1 implements ChatServiceHandler.ListV1.
func (c *chatServiceHandler) ListV1(ctx context.Context, opts listOptionsV1) Reply {
	var cl chat1.ChatList
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	topicType, err := TopicTypeFromStrDefault(opts.TopicType)
	if err != nil {
		return c.errReply(err)
	}
	var convIDs []chat1.ConversationID
	if opts.ConversationID != "" {
		convID, err := chat1.MakeConvID(opts.ConversationID)
		if err != nil {
			return c.errReply(err)
		}
		convIDs = append(convIDs, convID)
	}
	res, err := client.GetInboxAndUnboxUILocal(ctx, chat1.GetInboxAndUnboxUILocalArg{
		Query: &chat1.GetInboxLocalQuery{
			ConvIDs:           convIDs,
			Status:            utils.VisibleChatConversationStatuses(),
			TopicType:         &topicType,
			UnreadOnly:        opts.UnreadOnly,
			OneChatTypePerTLF: new(bool),
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return c.errReply(err)
	}
	rlimits = utils.AggRateLimits(res.RateLimits)
	if opts.FailOffline && res.Offline {
		return c.errReply(chat.OfflineError{})
	}
	cl = chat1.ChatList{
		Offline:          res.Offline,
		IdentifyFailures: res.IdentifyFailures,
	}
	for _, conv := range res.Conversations {
		cl.Conversations = append(cl.Conversations, conv.ExportToSummary())
	}
	cl.RateLimits = c.aggRateLimits(rlimits)
	return Reply{Result: cl}
}

func (c *chatServiceHandler) ListConvsOnNameV1(ctx context.Context, opts listConvsOnNameOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	topicType, err := TopicTypeFromStrDefault(opts.TopicType)
	if err != nil {
		return c.errReply(err)
	}
	mt := MembersTypeFromStrDefault(opts.MembersType, c.G().GetEnv())

	listRes, err := client.GetTLFConversationsLocal(ctx, chat1.GetTLFConversationsLocalArg{
		TlfName:     opts.Name,
		TopicType:   topicType,
		MembersType: mt,
	})
	if err != nil {
		return c.errReply(err)
	}
	var cl chat1.ChatList
	cl.RateLimits = c.aggRateLimits(listRes.RateLimits)
	for _, conv := range listRes.Convs {
		cl.Conversations = append(cl.Conversations, conv.ExportToSummary())
	}
	return Reply{Result: cl}
}

func (c *chatServiceHandler) JoinV1(ctx context.Context, opts joinOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, rl, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	res, err := client.JoinConversationByIDLocal(ctx, convID)
	if err != nil {
		return c.errReply(err)
	}
	allLimits := append(rl, res.RateLimits...)
	cres := chat1.EmptyRes{
		RateLimits: c.aggRateLimits(allLimits),
	}
	return Reply{Result: cres}
}

func (c *chatServiceHandler) LeaveV1(ctx context.Context, opts leaveOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, rl, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	res, err := client.LeaveConversationLocal(ctx, convID)
	if err != nil {
		return c.errReply(err)
	}
	allLimits := append(rl, res.RateLimits...)
	cres := chat1.EmptyRes{
		RateLimits: c.aggRateLimits(allLimits),
	}
	return Reply{Result: cres}
}

func (c *chatServiceHandler) AddToChannelV1(ctx context.Context, opts addToChannelOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, _, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	err = client.BulkAddToConv(ctx, chat1.BulkAddToConvArg{
		Usernames: opts.Usernames,
		ConvID:    convID,
	})
	if err != nil {
		return c.errReply(err)
	}
	return Reply{Result: true}
}

func (c *chatServiceHandler) LoadFlipV1(ctx context.Context, opts loadFlipOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	hostConvID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(err)
	}
	flipConvID, err := chat1.MakeConvID(opts.FlipConversationID)
	if err != nil {
		return c.errReply(err)
	}
	gameID, err := chat1.MakeFlipGameID(opts.GameID)
	if err != nil {
		return c.errReply(err)
	}
	res, err := client.LoadFlip(ctx, chat1.LoadFlipArg{
		HostConvID: hostConvID,
		HostMsgID:  opts.MsgID,
		FlipConvID: flipConvID,
		GameID:     gameID,
	})
	if err != nil {
		return c.errReply(err)
	}
	return Reply{Result: res}
}

func (c *chatServiceHandler) GetUnfurlSettingsV1(ctx context.Context) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	res, err := client.GetUnfurlSettings(ctx)
	if err != nil {
		return c.errReply(err)
	}
	return Reply{
		Result: map[string]interface{}{
			"mode":      strings.ToLower(chat1.UnfurlModeRevMap[res.Mode]),
			"whitelist": res.Whitelist,
		},
	}
}

func (c *chatServiceHandler) SetUnfurlSettingsV1(ctx context.Context, opts setUnfurlSettingsOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	if err := client.SaveUnfurlSettings(ctx, chat1.SaveUnfurlSettingsArg{
		Mode:      opts.intMode,
		Whitelist: opts.Whitelist,
	}); err != nil {
		return c.errReply(err)
	}
	return Reply{Result: true}
}

func (c *chatServiceHandler) GetDeviceInfoV1(ctx context.Context, opts getDeviceInfoOptionsV1) Reply {
	client, err := GetUserClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	user, err := client.LoadUserByName(ctx, keybase1.LoadUserByNameArg{Username: opts.Username})
	if err != nil {
		return c.errReply(err)
	}
	arg := keybase1.LoadUserPlusKeysV2Arg{
		Uid: user.Uid,
	}
	them, err := client.LoadUserPlusKeysV2(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	var res chat1.GetDeviceInfoRes
	for _, m := range them.Current.DeviceKeys {
		dev := chat1.DeviceInfo{
			DeviceID:          string(m.DeviceID),
			DeviceDescription: m.DeviceDescription,
			DeviceType:        m.DeviceType,
			DeviceCtime:       m.Base.CTime.UnixSeconds(),
		}
		if string(m.DeviceID) != "" && m.Base.Revocation == nil {
			res.Devices = append(res.Devices, dev)
		}
	}

	return Reply{Result: res}
}

func (c *chatServiceHandler) getAdvertTyp(typ string) (chat1.BotCommandsAdvertisementTyp, error) {
	switch typ {
	case "public":
		return chat1.BotCommandsAdvertisementTyp_PUBLIC, nil
	case "teamconvs":
		return chat1.BotCommandsAdvertisementTyp_TLFID_CONVS, nil
	case "teammembers":
		return chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS, nil
	default:
		return chat1.BotCommandsAdvertisementTyp_PUBLIC, fmt.Errorf("unknown advertisement type %q", typ)
	}
}

func (c *chatServiceHandler) AdvertiseCommandsV1(ctx context.Context, opts advertiseCommandsOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	var alias *string
	if opts.Alias != "" {
		alias = new(string)
		*alias = opts.Alias
	}
	var ads []chat1.AdvertiseCommandsParam
	for _, ad := range opts.Advertisements {
		typ, err := c.getAdvertTyp(ad.Typ)
		if err != nil {
			return c.errReply(err)
		}
		var teamName *string
		if ad.TeamName != "" {
			adTeamName := ad.TeamName
			teamName = &adTeamName
		}
		ads = append(ads, chat1.AdvertiseCommandsParam{
			Typ:      typ,
			Commands: ad.Commands,
			TeamName: teamName,
		})
	}
	res, err := client.AdvertiseBotCommandsLocal(ctx, chat1.AdvertiseBotCommandsLocalArg{
		Alias:          alias,
		Advertisements: ads,
	})
	if err != nil {
		return c.errReply(err)
	}
	return Reply{Result: res}
}

func (c *chatServiceHandler) ClearCommandsV1(ctx context.Context) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	res, err := client.ClearBotCommandsLocal(ctx)
	if err != nil {
		return c.errReply(err)
	}
	return Reply{Result: res}
}

func (c *chatServiceHandler) ListCommandsV1(ctx context.Context, opts listCommandsOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, rl, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	lres, err := client.ListBotCommandsLocal(ctx, convID)
	if err != nil {
		return c.errReply(err)
	}
	res := chat1.ListCommandsRes{
		Commands: lres.Commands,
	}
	res.RateLimits = c.aggRateLimits(append(rl, lres.RateLimits...))
	return Reply{Result: res}
}

func (c *chatServiceHandler) PinV1(ctx context.Context, opts pinOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, rl, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	lres, err := client.PinMessage(ctx, chat1.PinMessageArg{
		ConvID: convID,
		MsgID:  opts.MessageID,
	})
	if err != nil {
		return c.errReply(err)
	}
	allLimits := append(rl, lres.RateLimits...)
	res := chat1.EmptyRes{
		RateLimits: c.aggRateLimits(allLimits),
	}
	return Reply{Result: res}
}

func (c *chatServiceHandler) UnpinV1(ctx context.Context, opts unpinOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, rl, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	lres, err := client.UnpinMessage(ctx, convID)
	if err != nil {
		return c.errReply(err)
	}
	allLimits := append(rl, lres.RateLimits...)
	res := chat1.EmptyRes{
		RateLimits: c.aggRateLimits(allLimits),
	}
	return Reply{Result: res}
}

func (c *chatServiceHandler) GetResetConvMembersV1(ctx context.Context) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	lres, err := client.GetAllResetConvMembers(ctx)
	if err != nil {
		return c.errReply(err)
	}
	var res chat1.GetResetConvMembersRes
	for _, m := range lres.Members {
		res.Members = append(res.Members, chat1.ResetConvMemberAPI{
			ConversationID: m.Conv.String(),
			Username:       m.Username,
		})
	}
	res.RateLimits = c.aggRateLimits(lres.RateLimits)
	return Reply{Result: res}
}

func (c *chatServiceHandler) AddResetConvMemberV1(ctx context.Context, opts addResetConvMemberOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(err)
	}
	if err := client.AddTeamMemberAfterReset(ctx, chat1.AddTeamMemberAfterResetArg{
		Username: opts.Username,
		ConvID:   convID,
	}); err != nil {
		return c.errReply(err)
	}
	return Reply{Result: chat1.EmptyRes{}}
}

func (c *chatServiceHandler) formatMessages(ctx context.Context, messages []chat1.MessageUnboxed,
	conv chat1.ConversationLocal, selfUID keybase1.UID, readMsgID chat1.MessageID, unreadOnly bool) (ret []chat1.Message, err error) {
	for _, m := range messages {
		st, err := m.State()
		if err != nil {
			return nil, errors.New("invalid message: unknown state")
		}

		if st == chat1.MessageUnboxedState_ERROR {
			em := m.Error().ErrMsg
			ret = append(ret, chat1.Message{
				Error: &em,
			})
			continue
		}

		// skip any PLACEHOLDER or OUTBOX messages
		if st != chat1.MessageUnboxedState_VALID {
			continue
		}

		mv := m.Valid()

		if mv.ClientHeader.MessageType == chat1.MessageType_TLFNAME {
			// skip TLFNAME messages
			continue
		}

		unread := mv.ServerHeader.MessageID > readMsgID
		if unreadOnly && !unread {
			continue
		}
		if !selfUID.IsNil() {
			fromSelf := (mv.ClientHeader.Sender.String() == selfUID.String())
			unread = unread && (!fromSelf)
			if unreadOnly && fromSelf {
				continue
			}
		}

		prev := mv.ClientHeader.Prev
		// Avoid having null show up in the output JSON.
		if prev == nil {
			prev = []chat1.MessagePreviousPointer{}
		}

		msg := chat1.MsgSummary{
			Id:     mv.ServerHeader.MessageID,
			ConvID: conv.GetConvID().String(),
			Channel: chat1.ChatChannel{
				Name:        conv.Info.TlfName,
				Public:      mv.ClientHeader.TlfPublic,
				TopicType:   strings.ToLower(mv.ClientHeader.Conv.TopicType.String()),
				MembersType: strings.ToLower(conv.GetMembersType().String()),
				TopicName:   conv.Info.TopicName,
			},
			Sender: chat1.MsgSender{
				Uid:        mv.ClientHeader.Sender.String(),
				DeviceID:   mv.ClientHeader.SenderDevice.String(),
				Username:   mv.SenderUsername,
				DeviceName: mv.SenderDeviceName,
			},
			SentAt:              mv.ServerHeader.Ctime.UnixSeconds(),
			SentAtMs:            mv.ServerHeader.Ctime.UnixMilliseconds(),
			Prev:                prev,
			Unread:              unread,
			RevokedDevice:       mv.SenderDeviceRevokedAt != nil,
			KbfsEncrypted:       mv.ClientHeader.KbfsCryptKeysUsed == nil || *mv.ClientHeader.KbfsCryptKeysUsed,
			IsEphemeral:         mv.IsEphemeral(),
			IsEphemeralExpired:  mv.IsEphemeralExpired(time.Now()),
			ETime:               mv.Etime(),
			Content:             c.convertMsgBody(mv.MessageBody),
			HasPairwiseMacs:     mv.HasPairwiseMacs(),
			AtMentionUsernames:  mv.AtMentionUsernames,
			ChannelMention:      strings.ToLower(mv.ChannelMention.String()),
			ChannelNameMentions: utils.PresentChannelNameMentions(ctx, mv.ChannelNameMentions),
		}
		if mv.ClientHeader.BotUID != nil {
			botUID := mv.ClientHeader.BotUID.String()
			msg.BotInfo = &chat1.MsgBotInfo{
				BotUID:      botUID,
				BotUsername: mv.BotUsername,
			}
		}
		if mv.Reactions.Reactions != nil {
			msg.Reactions = &mv.Reactions
		}

		ret = append(ret, chat1.Message{
			Msg: &msg,
		})
	}

	if ret == nil {
		// Avoid having null show up in the output JSON.
		ret = []chat1.Message{}
	}
	return ret, nil
}

// ReadV1 implements ChatServiceHandler.ReadV1.
func (c *chatServiceHandler) ReadV1(ctx context.Context, opts readOptionsV1) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	conv, rlimits, err := c.findConversation(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.GetThreadLocalArg{
		ConversationID: conv.Info.Id,
		Pagination:     opts.Pagination,
		Query: &chat1.GetThreadQuery{
			MarkAsRead: !opts.Peek,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	threadView, err := client.GetThreadLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, threadView.RateLimits...)

	// Check to see if this was fetched offline and we should fail
	if opts.FailOffline && threadView.Offline {
		return c.errReply(chat.OfflineError{})
	}

	// This could be lower than the truth if any messages were
	// posted between the last two gregor rpcs.
	readMsgID := conv.ReaderInfo.ReadMsgid

	selfUID := c.G().Env.GetUID()
	if selfUID.IsNil() {
		c.G().Log.Warning("Could not get self UID for api")
	}

	messages, err := c.formatMessages(ctx, threadView.Thread.Messages, conv, selfUID, readMsgID, opts.UnreadOnly)
	if err != nil {
		return c.errReply(err)
	}

	thread := chat1.Thread{
		Offline:          threadView.Offline,
		IdentifyFailures: threadView.IdentifyFailures,
		Pagination:       threadView.Thread.Pagination,
		Messages:         messages,
	}

	thread.RateLimits = c.aggRateLimits(rlimits)
	return Reply{Result: thread}
}

// GetV1 implements ChatServiceHandler.GetV1.
func (c *chatServiceHandler) GetV1(ctx context.Context, opts getOptionsV1) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	conv, rlimits, err := c.findConversation(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.GetMessagesLocalArg{
		ConversationID:   conv.Info.Id,
		MessageIDs:       opts.MessageIDs,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	res, err := client.GetMessagesLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	// Check to see if this was fetched offline and we should fail
	if opts.FailOffline && res.Offline {
		return c.errReply(chat.OfflineError{})
	}

	selfUID := c.G().Env.GetUID()
	if selfUID.IsNil() {
		c.G().Log.Warning("Could not get self UID for api")
	}

	messages, err := c.formatMessages(ctx, res.Messages, conv, selfUID, 0 /* readMsgID */, false /* unreadOnly */)
	if err != nil {
		return c.errReply(err)
	}

	thread := chat1.Thread{
		Offline:          res.Offline,
		IdentifyFailures: res.IdentifyFailures,
		Messages:         messages,
	}
	thread.RateLimits = c.aggRateLimits(rlimits)
	return Reply{Result: thread}
}

// SendV1 implements ChatServiceHandler.SendV1.
func (c *chatServiceHandler) SendV1(ctx context.Context, opts sendOptionsV1, chatUI chat1.ChatUiInterface) Reply {
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	arg := sendArgV1{
		conversationID:    convID,
		channel:           opts.Channel,
		body:              chat1.NewMessageBodyWithText(chat1.MessageText{Body: opts.Message.Body}),
		mtype:             chat1.MessageType_TEXT,
		response:          "message sent",
		nonblock:          opts.Nonblock,
		ephemeralLifetime: opts.EphemeralLifetime,
		replyTo:           opts.ReplyTo,
	}
	return c.sendV1(ctx, arg, chatUI)
}

// DeleteV1 implements ChatServiceHandler.DeleteV1.
func (c *chatServiceHandler) DeleteV1(ctx context.Context, opts deleteOptionsV1) Reply {
	convID, _, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	messages := []chat1.MessageID{opts.MessageID}
	arg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		mtype:          chat1.MessageType_DELETE,
		supersedes:     opts.MessageID,
		deletes:        messages,
		response:       "message deleted",

		// NOTE: The service will fill in the IDs of edit messages that also need to be deleted.
		body: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: messages}),
	}
	return c.sendV1(ctx, arg, utils.DummyChatUI{})
}

// EditV1 implements ChatServiceHandler.EditV1.
func (c *chatServiceHandler) EditV1(ctx context.Context, opts editOptionsV1) Reply {
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	arg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		body:           chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: opts.MessageID, Body: opts.Message.Body}),
		mtype:          chat1.MessageType_EDIT,
		supersedes:     opts.MessageID,
		response:       "message edited",
	}
	return c.sendV1(ctx, arg, utils.DummyChatUI{})
}

// ReactionV1 implements ChatServiceHandler.ReactionV1.
func (c *chatServiceHandler) ReactionV1(ctx context.Context, opts reactionOptionsV1) Reply {
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	arg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		body:           chat1.NewMessageBodyWithReaction(chat1.MessageReaction{MessageID: opts.MessageID, Body: opts.Message.Body}),
		mtype:          chat1.MessageType_REACTION,
		supersedes:     opts.MessageID,
		response:       "message reacted to",
	}
	return c.sendV1(ctx, arg, utils.DummyChatUI{})
}

// AttachV1 implements ChatServiceHandler.AttachV1.
func (c *chatServiceHandler) AttachV1(ctx context.Context, opts attachOptionsV1,
	chatUI chat1.ChatUiInterface, notifyUI chat1.NotifyChatInterface) Reply {
	var rl []chat1.RateLimit
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	sarg := sendArgV1{
		conversationID:    convID,
		channel:           opts.Channel,
		mtype:             chat1.MessageType_ATTACHMENT,
		ephemeralLifetime: opts.EphemeralLifetime,
	}
	existing, existingRl, err := c.getExistingConvs(ctx, sarg.conversationID, sarg.channel)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, existingRl...)

	header, err := c.makePostHeader(ctx, sarg, existing)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, header.rateLimits...)

	vis := keybase1.TLFVisibility_PRIVATE
	if header.clientHeader.TlfPublic {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	var ephemeralLifetime *gregor1.DurationSec
	if header.clientHeader.EphemeralMetadata != nil {
		ephemeralLifetime = &header.clientHeader.EphemeralMetadata.Lifetime
	}
	arg := chat1.PostFileAttachmentArg{
		ConversationID:    header.conversationID,
		TlfName:           header.clientHeader.TlfName,
		Visibility:        vis,
		Filename:          opts.Filename,
		Title:             opts.Title,
		EphemeralLifetime: ephemeralLifetime,
	}
	// check for preview
	if len(opts.Preview) > 0 {
		loc := chat1.NewPreviewLocationWithFile(opts.Preview)
		arg.CallerPreview = &chat1.MakePreviewRes{
			Location: &loc,
		}
	}

	c.chatUI.RegisterChatUI(chatUI)
	defer c.chatUI.DeregisterChatUI(chatUI)
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(c.chatUI),
		chat1.NotifyChatProtocol(notifyUI),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}
	cli, err := GetNotifyCtlClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	channels := keybase1.NotificationChannels{
		Chatattachments: true,
	}
	if err := cli.SetNotifications(context.TODO(), channels); err != nil {
		return c.errReply(err)
	}

	var pres chat1.PostLocalRes
	pres, err = client.PostFileAttachmentLocal(ctx, chat1.PostFileAttachmentLocalArg{
		SessionID: getSessionID(chatUI),
		Arg:       arg,
	})
	rl = append(rl, pres.RateLimits...)
	if err != nil {
		return c.errReply(err)
	}

	res := chat1.SendRes{
		Message:    "attachment sent",
		MessageID:  &pres.MessageID,
		RateLimits: c.aggRateLimits(rl),
	}

	return Reply{Result: res}
}

// DownloadV1 implements ChatServiceHandler.DownloadV1.
func (c *chatServiceHandler) DownloadV1(ctx context.Context, opts downloadOptionsV1,
	chatUI chat1.ChatUiInterface) Reply {
	if opts.NoStream && opts.Output != "-" {
		return c.downloadV1NoStream(ctx, opts, chatUI)
	}
	var fsink Sink
	if opts.Output == "-" {
		fsink = &StdoutSink{}
	} else {
		fsink = NewFileSink(c.G(), opts.Output)
	}
	defer fsink.Close()
	sink := c.G().XStreams.ExportWriter(fsink)

	c.chatUI.RegisterChatUI(chatUI)
	defer c.chatUI.DeregisterChatUI(chatUI)
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(c.chatUI),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}

	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.DownloadAttachmentLocalArg{
		SessionID:        getSessionID(chatUI),
		ConversationID:   convID,
		MessageID:        opts.MessageID,
		Sink:             sink,
		Preview:          opts.Preview,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	dres, err := client.DownloadAttachmentLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, dres.RateLimits...)
	if opts.Output != "-" {
		if err := attachments.Quarantine(ctx, opts.Output); err != nil {
			c.G().Log.Warning("failed to quarantine attachment download: %s", err)
		}
	}

	res := chat1.SendRes{
		Message:          fmt.Sprintf("attachment downloaded to %s", opts.Output),
		RateLimits:       c.aggRateLimits(rlimits),
		IdentifyFailures: dres.IdentifyFailures,
	}

	return Reply{Result: res}
}

// downloadV1NoStream uses DownloadFileAttachmentLocal instead of DownloadAttachmentLocal.
func (c *chatServiceHandler) downloadV1NoStream(ctx context.Context, opts downloadOptionsV1,
	chatUI chat1.ChatUiInterface) Reply {
	c.chatUI.RegisterChatUI(chatUI)
	defer c.chatUI.DeregisterChatUI(chatUI)
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(c.chatUI),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}

	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.DownloadFileAttachmentLocalArg{
		SessionID:       getSessionID(chatUI),
		ConversationID:  convID,
		MessageID:       opts.MessageID,
		Preview:         opts.Preview,
		DownloadToCache: false,
	}

	dres, err := client.DownloadFileAttachmentLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, dres.RateLimits...)

	res := chat1.SendRes{
		Message:    fmt.Sprintf("attachment downloaded to %s", opts.Output),
		RateLimits: c.aggRateLimits(rlimits),
	}

	return Reply{Result: res}
}

// SetStatusV1 implements ChatServiceHandler.SetStatusV1.
func (c *chatServiceHandler) SetStatusV1(ctx context.Context, opts setStatusOptionsV1) Reply {
	var rlimits []chat1.RateLimit

	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	status, ok := chat1.ConversationStatusMap[strings.ToUpper(opts.Status)]
	if !ok {
		return c.errReply(fmt.Errorf("unsupported status: '%v'", opts.Status))
	}

	setStatusArg := chat1.SetConversationStatusLocalArg{
		ConversationID:   convID,
		Status:           status,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	localRes, err := client.SetConversationStatusLocal(ctx, setStatusArg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, localRes.RateLimits...)

	res := chat1.EmptyRes{
		RateLimits: c.aggRateLimits(rlimits),
	}
	return Reply{Result: res}
}

// MarkV1 implements ChatServiceHandler.MarkV1.
func (c *chatServiceHandler) MarkV1(ctx context.Context, opts markOptionsV1) Reply {
	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.MarkAsReadLocalArg{
		ConversationID: convID,
		MsgID:          &opts.MessageID,
	}

	res, err := client.MarkAsReadLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	allLimits := append(rlimits, res.RateLimits...)
	cres := chat1.EmptyRes{
		RateLimits: c.aggRateLimits(allLimits),
	}
	return Reply{Result: cres}
}

// SearchInbox implements ChatServiceHandler.SearchInboxV1.
func (c *chatServiceHandler) SearchInboxV1(ctx context.Context, opts searchInboxOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.MaxHits <= 0 {
		opts.MaxHits = 10
	}

	reindexMode := chat1.ReIndexingMode_NONE
	if opts.ForceReindex {
		reindexMode = chat1.ReIndexingMode_PRESEARCH_SYNC
	}
	searchOpts := chat1.SearchOpts{
		ReindexMode:   reindexMode,
		SentBy:        opts.SentBy,
		MaxHits:       opts.MaxHits,
		BeforeContext: opts.BeforeContext,
		AfterContext:  opts.AfterContext,
	}

	if opts.SentBefore != "" && opts.SentAfter != "" {
		err := fmt.Errorf("Only one of `sent_before` and `sent_after` can be specified")
		return c.errReply(err)
	}
	if opts.SentBefore != "" {
		sentBefore, err := dateparse.ParseAny(opts.SentBefore)
		if err != nil {
			return c.errReply(err)
		}
		searchOpts.SentBefore = gregor1.ToTime(sentBefore)
	}
	if opts.SentAfter != "" {
		sentAfter, err := dateparse.ParseAny(opts.SentAfter)
		if err != nil {
			return c.errReply(err)
		}
		searchOpts.SentAfter = gregor1.ToTime(sentAfter)
	}

	arg := chat1.SearchInboxArg{
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		Query:            opts.Query,
		Opts:             searchOpts,
	}

	res, err := client.SearchInbox(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	searchRes := chat1.SearchInboxResOutput{
		Results:          res.Res,
		RateLimits:       c.aggRateLimits(res.RateLimits),
		IdentifyFailures: res.IdentifyFailures,
	}
	return Reply{Result: searchRes}
}

// SearchRegexpV1 implements ChatServiceHandler.SearchRegexpV1.
func (c *chatServiceHandler) SearchRegexpV1(ctx context.Context, opts searchRegexpOptionsV1) Reply {
	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.MaxHits <= 0 {
		opts.MaxHits = 10
	}

	if opts.MaxMessages <= 0 {
		opts.MaxMessages = 10000
	}

	searchOpts := chat1.SearchOpts{
		SentBy:        opts.SentBy,
		MaxHits:       opts.MaxHits,
		MaxMessages:   opts.MaxMessages,
		BeforeContext: opts.BeforeContext,
		AfterContext:  opts.AfterContext,
	}

	if opts.SentBefore != "" && opts.SentAfter != "" {
		err := fmt.Errorf("Only one of `sent_before` and `sent_after` can be specified")
		return c.errReply(err)
	}
	if opts.SentBefore != "" {
		sentBefore, err := dateparse.ParseAny(opts.SentBefore)
		if err != nil {
			return c.errReply(err)
		}
		searchOpts.SentBefore = gregor1.ToTime(sentBefore)
	}
	if opts.SentAfter != "" {
		sentAfter, err := dateparse.ParseAny(opts.SentAfter)
		if err != nil {
			return c.errReply(err)
		}
		searchOpts.SentAfter = gregor1.ToTime(sentAfter)
	}
	searchOpts.IsRegex = opts.IsRegex

	arg := chat1.SearchRegexpArg{
		ConvID:           convID,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		Query:            opts.Query,
		Opts:             searchOpts,
	}

	res, err := client.SearchRegexp(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	allLimits := append(rlimits, res.RateLimits...)
	searchRes := chat1.RegexpRes{
		Hits:             res.Hits,
		RateLimits:       c.aggRateLimits(allLimits),
		IdentifyFailures: res.IdentifyFailures,
	}
	return Reply{Result: searchRes}
}

func (c *chatServiceHandler) NewConvV1(ctx context.Context, opts newConvOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	vis := keybase1.TLFVisibility_PRIVATE
	if opts.Channel.Public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	topicType, err := TopicTypeFromStrDefault(opts.Channel.TopicType)
	if err != nil {
		return c.errReply(err)
	}
	var topicName *string
	if len(opts.Channel.TopicName) > 0 {
		topicName = new(string)
		*topicName = opts.Channel.TopicName
	}
	res, err := client.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
		TlfName:          opts.Channel.Name,
		TopicType:        topicType,
		TopicName:        topicName,
		TlfVisibility:    vis,
		MembersType:      opts.Channel.GetMembersType(c.G().GetEnv()),
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return c.errReply(err)
	}
	newConvRes := chat1.NewConvRes{
		Id:               res.Conv.GetConvID().String(),
		IdentifyFailures: res.IdentifyFailures,
		RateLimits:       c.aggRateLimits(res.RateLimits),
	}
	return Reply{Result: newConvRes}
}

type sendArgV1 struct {
	// convQuery  chat1.GetInboxLocalQuery
	conversationID    chat1.ConversationID
	channel           ChatChannel
	body              chat1.MessageBody
	mtype             chat1.MessageType
	supersedes        chat1.MessageID
	deletes           []chat1.MessageID
	response          string
	nonblock          bool
	ephemeralLifetime ephemeralLifetime
	replyTo           *chat1.MessageID
}

func (c *chatServiceHandler) sendV1(ctx context.Context, arg sendArgV1, chatUI chat1.ChatUiInterface) Reply {
	c.chatUI.RegisterChatUI(chatUI)
	defer c.chatUI.DeregisterChatUI(chatUI)
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(c.chatUI),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}

	var rl []chat1.RateLimit
	existing, existingRl, err := c.getExistingConvs(ctx, arg.conversationID, arg.channel)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, existingRl...)

	header, err := c.makePostHeader(ctx, arg, existing)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, header.rateLimits...)

	postArg := chat1.PostLocalArg{
		SessionID:      getSessionID(chatUI),
		ConversationID: header.conversationID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: header.clientHeader,
			MessageBody:  arg.body,
		},
		ReplyTo:          arg.replyTo,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	var idFails []keybase1.TLFIdentifyFailure
	var msgID *chat1.MessageID
	var obid *chat1.OutboxID
	if arg.nonblock {
		var nbarg chat1.PostLocalNonblockArg
		nbarg.ConversationID = postArg.ConversationID
		nbarg.Msg = postArg.Msg
		nbarg.IdentifyBehavior = postArg.IdentifyBehavior
		plres, err := client.PostLocalNonblock(ctx, nbarg)
		if err != nil {
			return c.errReply(err)
		}
		obid = &plres.OutboxID
		rl = append(rl, plres.RateLimits...)
		idFails = plres.IdentifyFailures
	} else {
		plres, err := client.PostLocal(ctx, postArg)
		if err != nil {
			return c.errReply(err)
		}
		msgID = &plres.MessageID
		rl = append(rl, plres.RateLimits...)
		idFails = plres.IdentifyFailures
	}

	res := chat1.SendRes{
		Message:          arg.response,
		MessageID:        msgID,
		OutboxID:         obid,
		RateLimits:       c.aggRateLimits(rl),
		IdentifyFailures: idFails,
	}

	return Reply{Result: res}
}

// ListMembersV1 implements ChatServiceHandler.ListMembersV1.
func (c *chatServiceHandler) ListMembersV1(ctx context.Context, opts listMembersOptionsV1) Reply {
	conv, _, err := c.findConversation(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	teamID, err := chatClient.TeamIDFromTLFName(ctx, chat1.TeamIDFromTLFNameArg{
		TlfName:     conv.Info.TlfName,
		MembersType: conv.Info.MembersType,
		TlfPublic:   conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
	})
	if err != nil {
		return c.errReply(err)
	}

	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	details, err := cli.TeamGetByID(context.Background(), keybase1.TeamGetByIDArg{Id: teamID})
	if err != nil {
		return c.errReply(err)
	}

	// filter the member list down to the specific conversation members based on the server-trust list
	if conv.Info.TopicName != "" && opts.Channel.TopicName != "general" {
		details = keybase1.FilterTeamDetailsForMembers(conv.AllNames(), details)
	}

	return Reply{Result: details}
}

type postHeader struct {
	conversationID chat1.ConversationID
	clientHeader   chat1.MessageClientHeader
	rateLimits     []chat1.RateLimit
}

func (c *chatServiceHandler) makePostHeader(ctx context.Context, arg sendArgV1, existing []chat1.ConversationLocal) (*postHeader, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, err
	}

	membersType := arg.channel.GetMembersType(c.G().GetEnv())
	var header postHeader
	var convTriple chat1.ConversationIDTriple
	var tlfName string
	var visibility keybase1.TLFVisibility
	switch len(existing) {
	case 0:
		visibility = keybase1.TLFVisibility_PRIVATE
		if arg.channel.Public {
			visibility = keybase1.TLFVisibility_PUBLIC
		}
		tt, err := TopicTypeFromStrDefault(arg.channel.TopicType)
		if err != nil {
			return nil, err
		}

		var topicName *string
		if arg.channel.TopicName != "" {
			topicName = &arg.channel.TopicName
		}
		channelName := arg.channel.Name
		ncres, err := client.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:          channelName,
			TlfVisibility:    visibility,
			TopicName:        topicName,
			TopicType:        tt,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			MembersType:      membersType,
		})
		if err != nil {
			return nil, err
		}
		header.rateLimits = append(header.rateLimits, ncres.RateLimits...)
		convTriple = ncres.Conv.Info.Triple
		tlfName = ncres.Conv.Info.TlfName
		visibility = ncres.Conv.Info.Visibility
		header.conversationID = ncres.Conv.Info.Id
	case 1:
		convTriple = existing[0].Info.Triple
		tlfName = existing[0].Info.TlfName
		visibility = existing[0].Info.Visibility
		header.conversationID = existing[0].Info.Id
	default:
		return nil, fmt.Errorf("multiple conversations matched")
	}
	var ephemeralMetadata *chat1.MsgEphemeralMetadata
	if arg.ephemeralLifetime.Duration != 0 && membersType != chat1.ConversationMembersType_KBFS {
		ephemeralLifetime := gregor1.ToDurationSec(arg.ephemeralLifetime.Duration)
		ephemeralMetadata = &chat1.MsgEphemeralMetadata{Lifetime: ephemeralLifetime}
	}

	header.clientHeader = chat1.MessageClientHeader{
		Conv:              convTriple,
		TlfName:           tlfName,
		TlfPublic:         visibility == keybase1.TLFVisibility_PUBLIC,
		MessageType:       arg.mtype,
		Supersedes:        arg.supersedes,
		Deletes:           arg.deletes,
		EphemeralMetadata: ephemeralMetadata,
	}

	return &header, nil
}

func (c *chatServiceHandler) getAllTeamConvs(ctx context.Context, name string, topicType *chat1.TopicType) ([]chat1.ConversationLocal, []chat1.RateLimit, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, nil, err
	}
	res, err := client.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			Name: &chat1.NameQuery{
				Name:        name,
				MembersType: chat1.ConversationMembersType_TEAM,
			},
			TopicType: topicType,
		},
	})
	if err != nil {
		return nil, nil, err
	}
	return res.Conversations, res.RateLimits, nil
}

func (c *chatServiceHandler) getExistingConvs(ctx context.Context, convID chat1.ConversationID,
	channel ChatChannel) ([]chat1.ConversationLocal, []chat1.RateLimit, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, nil, err
	}
	if !convID.IsNil() {
		gilres, err := client.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{convID},
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			c.G().Log.Warning("GetInboxLocal error: %s", err)
			return nil, nil, err
		}
		return gilres.Conversations, gilres.RateLimits, nil
	}

	tlfName := channel.Name
	vis := keybase1.TLFVisibility_PRIVATE
	if channel.Public {
		vis = keybase1.TLFVisibility_PUBLIC
	}
	tt, err := TopicTypeFromStrDefault(channel.TopicType)
	if err != nil {
		return nil, nil, err
	}
	findRes, err := client.FindConversationsLocal(ctx, chat1.FindConversationsLocalArg{
		TlfName:          tlfName,
		MembersType:      channel.GetMembersType(c.G().GetEnv()),
		Visibility:       vis,
		TopicType:        tt,
		TopicName:        channel.TopicName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return nil, nil, err
	}

	return findRes.Conversations, findRes.RateLimits, nil
}

func (c *chatServiceHandler) displayFlipBody(flip *chat1.MessageFlip) (res *chat1.MsgFlipContent) {
	if flip == nil {
		return res
	}
	res = new(chat1.MsgFlipContent)
	res.GameID = flip.GameID.String()
	res.FlipConvID = flip.FlipConvID.String()
	res.TeamMentions = flip.TeamMentions
	res.UserMentions = flip.UserMentions
	res.Text = flip.Text
	return res
}

// need this to get message type name
func (c *chatServiceHandler) convertMsgBody(mb chat1.MessageBody) chat1.MsgContent {
	return chat1.MsgContent{
		TypeName:           strings.ToLower(chat1.MessageTypeRevMap[mb.MessageType__]),
		Text:               mb.Text__,
		Attachment:         mb.Attachment__,
		Edit:               mb.Edit__,
		Reaction:           mb.Reaction__,
		Delete:             mb.Delete__,
		Metadata:           mb.Metadata__,
		Headline:           mb.Headline__,
		AttachmentUploaded: mb.Attachmentuploaded__,
		System:             mb.System__,
		SendPayment:        mb.Sendpayment__,
		RequestPayment:     mb.Requestpayment__,
		Unfurl:             mb.Unfurl__,
		Flip:               c.displayFlipBody(mb.Flip__),
	}
}

func (c *chatServiceHandler) errReply(err error) Reply {
	if rlerr, ok := err.(libkb.ChatRateLimitError); ok {
		return Reply{Error: &CallError{Message: err.Error(), Data: rlerr.RateLimit}}
	}
	return Reply{Error: &CallError{Message: err.Error()}}
}

func (c *chatServiceHandler) aggRateLimits(rlimits []chat1.RateLimit) (res []chat1.RateLimitRes) {
	m := make(map[string]chat1.RateLimit)
	for _, rl := range rlimits {
		m[rl.Name] = rl
	}
	for _, v := range m {
		res = append(res, chat1.RateLimitRes{
			Tank:     v.Name,
			Capacity: v.MaxCalls,
			Reset:    v.WindowReset,
			Gas:      v.CallsRemaining,
		})
	}
	return res
}

// Resolve the ConvID of the specified conversation.
// Prefers using ChatChannel but if it is blank (default-valued) then uses ConvIDStr.
// Uses tlfclient and GetInboxAndUnboxLocal's ConversationsUnverified.
func (c *chatServiceHandler) resolveAPIConvID(ctx context.Context, convIDStr string,
	channel ChatChannel) (chat1.ConversationID, []chat1.RateLimit, error) {
	conv, limits, err := c.findConversation(ctx, convIDStr, channel)
	if err != nil {
		return chat1.ConversationID{}, nil, err
	}
	return conv.Info.Id, limits, nil
}

// findConversation finds a conversation.
// It prefers using ChatChannel but if it is blank (default-valued) then uses ConvIDStr.
// Uses tlfclient and GetInboxAndUnboxLocal's ConversationsUnverified.
func (c *chatServiceHandler) findConversation(ctx context.Context, convIDStr string,
	channel ChatChannel) (chat1.ConversationLocal, []chat1.RateLimit, error) {
	var conv chat1.ConversationLocal
	var rlimits []chat1.RateLimit

	if channel.IsNil() && len(convIDStr) == 0 {
		return conv, rlimits, errors.New("missing conversation specificer")
	}

	var convID chat1.ConversationID
	if channel.IsNil() {
		var err error
		convID, err = chat1.MakeConvID(convIDStr)
		if err != nil {
			return conv, rlimits, fmt.Errorf("invalid conversation ID: %s", convIDStr)
		}
	}

	existing, existingRl, err := c.getExistingConvs(ctx, convID, channel)
	if err != nil {
		return conv, rlimits, err
	}
	rlimits = append(rlimits, existingRl...)

	if len(existing) > 1 {
		return conv, rlimits, fmt.Errorf("multiple conversations matched %q", channel.Name)
	}
	if len(existing) == 0 {
		return conv, rlimits, fmt.Errorf("no conversations matched %q", channel.Name)
	}

	return existing[0], rlimits, nil
}

func TopicTypeFromStrDefault(str string) (chat1.TopicType, error) {
	if len(str) == 0 {
		return chat1.TopicType_CHAT, nil
	}
	tt, ok := chat1.TopicTypeMap[strings.ToUpper(str)]
	if !ok {
		return chat1.TopicType_NONE, fmt.Errorf("invalid topic type: '%v'", str)
	}
	return tt, nil
}

func MembersTypeFromStrDefault(str string, e *libkb.Env) chat1.ConversationMembersType {
	if typ, ok := chat1.ConversationMembersTypeMap[strings.ToUpper(str)]; ok {
		return typ
	}
	if e.GetChatMemberType() == "impteam" {
		return chat1.ConversationMembersType_IMPTEAMNATIVE
	}
	return chat1.ConversationMembersType_KBFS
}
