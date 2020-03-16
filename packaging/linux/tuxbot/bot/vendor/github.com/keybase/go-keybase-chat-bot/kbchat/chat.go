package kbchat

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/keybase/go-keybase-chat-bot/kbchat/types/chat1"
	"github.com/keybase/go-keybase-chat-bot/kbchat/types/keybase1"
)

type Thread struct {
	Result chat1.Thread `json:"result"`
	Error  *Error       `json:"error,omitempty"`
}

type Inbox struct {
	Result Result `json:"result"`
	Error  *Error `json:"error,omitempty"`
}

type sendMessageBody struct {
	Body string
}

type sendMessageOptions struct {
	Channel          chat1.ChatChannel `json:"channel,omitempty"`
	ConversationID   chat1.ConvIDStr   `json:"conversation_id,omitempty"`
	Message          sendMessageBody   `json:",omitempty"`
	Filename         string            `json:"filename,omitempty"`
	Title            string            `json:"title,omitempty"`
	MsgID            chat1.MessageID   `json:"message_id,omitempty"`
	ConfirmLumenSend bool              `json:"confirm_lumen_send"`
	ReplyTo          *chat1.MessageID  `json:"reply_to,omitempty"`
}

type sendMessageParams struct {
	Options sendMessageOptions
}

type sendMessageArg struct {
	Method string
	Params sendMessageParams
}

func newSendArg(options sendMessageOptions) sendMessageArg {
	return sendMessageArg{
		Method: "send",
		Params: sendMessageParams{
			Options: options,
		},
	}
}

// GetConversations reads all conversations from the current user's inbox.
func (a *API) GetConversations(unreadOnly bool) ([]chat1.ConvSummary, error) {
	apiInput := fmt.Sprintf(`{"method":"list", "params": { "options": { "unread_only": %v}}}`, unreadOnly)
	output, err := a.doFetch(apiInput)
	if err != nil {
		return nil, err
	}

	var inbox Inbox
	if err := json.Unmarshal(output, &inbox); err != nil {
		return nil, err
	} else if inbox.Error != nil {
		return nil, errors.New(inbox.Error.Message)
	}
	return inbox.Result.Convs, nil
}

func (a *API) GetConversation(convID chat1.ConvIDStr) (res chat1.ConvSummary, err error) {
	apiInput := fmt.Sprintf(`{"method":"list", "params": { "options": { "conversation_id": "%s"}}}`, convID)
	output, err := a.doFetch(apiInput)
	if err != nil {
		return res, err
	}

	var inbox Inbox
	if err := json.Unmarshal(output, &inbox); err != nil {
		return res, err
	} else if inbox.Error != nil {
		return res, errors.New(inbox.Error.Message)
	} else if len(inbox.Result.Convs) == 0 {
		return res, errors.New("conversation not found")
	}
	return inbox.Result.Convs[0], nil
}

// GetTextMessages fetches all text messages from a given channel. Optionally can filter
// ont unread status.
func (a *API) GetTextMessages(channel chat1.ChatChannel, unreadOnly bool) ([]chat1.MsgSummary, error) {
	channelBytes, err := json.Marshal(channel)
	if err != nil {
		return nil, err
	}
	apiInput := fmt.Sprintf(`{"method": "read", "params": {"options": {"channel": %s}}}`, string(channelBytes))
	output, err := a.doFetch(apiInput)
	if err != nil {
		return nil, err
	}

	var thread Thread

	if err := json.Unmarshal(output, &thread); err != nil {
		return nil, fmt.Errorf("unable to decode thread: %v", err)
	} else if thread.Error != nil {
		return nil, errors.New(thread.Error.Message)
	}

	var res []chat1.MsgSummary
	for _, msg := range thread.Result.Messages {
		if msg.Msg.Content.TypeName == "text" {
			res = append(res, *msg.Msg)
		}
	}

	return res, nil
}

func (a *API) SendMessage(channel chat1.ChatChannel, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		Channel: channel,
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
	})
	return a.doSend(arg)
}

func (a *API) Broadcast(body string, args ...interface{}) (SendResponse, error) {
	return a.SendMessage(chat1.ChatChannel{
		Name:   a.GetUsername(),
		Public: true,
	}, fmt.Sprintf(body, args...))
}

func (a *API) SendMessageByConvID(convID chat1.ConvIDStr, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		ConversationID: convID,
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
	})
	return a.doSend(arg)
}

// SendMessageByTlfName sends a message on the given TLF name
func (a *API) SendMessageByTlfName(tlfName string, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		Channel: chat1.ChatChannel{
			Name: tlfName,
		},
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
	})
	return a.doSend(arg)
}

func (a *API) SendMessageByTeamName(teamName string, inChannel *string, body string, args ...interface{}) (SendResponse, error) {
	channel := "general"
	if inChannel != nil {
		channel = *inChannel
	}
	arg := newSendArg(sendMessageOptions{
		Channel: chat1.ChatChannel{
			MembersType: "team",
			Name:        teamName,
			TopicName:   channel,
		},
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
	})
	return a.doSend(arg)
}

func (a *API) SendReply(channel chat1.ChatChannel, replyTo *chat1.MessageID, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		Channel: channel,
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
		ReplyTo: replyTo,
	})
	return a.doSend(arg)
}

func (a *API) SendReplyByConvID(convID chat1.ConvIDStr, replyTo *chat1.MessageID, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		ConversationID: convID,
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
		ReplyTo: replyTo,
	})
	return a.doSend(arg)
}

func (a *API) SendReplyByTlfName(tlfName string, replyTo *chat1.MessageID, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		Channel: chat1.ChatChannel{
			Name: tlfName,
		},
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
		ReplyTo: replyTo,
	})
	return a.doSend(arg)
}

func (a *API) SendAttachmentByTeam(teamName string, inChannel *string, filename string, title string) (SendResponse, error) {
	channel := "general"
	if inChannel != nil {
		channel = *inChannel
	}
	arg := sendMessageArg{
		Method: "attach",
		Params: sendMessageParams{
			Options: sendMessageOptions{
				Channel: chat1.ChatChannel{
					MembersType: "team",
					Name:        teamName,
					TopicName:   channel,
				},
				Filename: filename,
				Title:    title,
			},
		},
	}
	return a.doSend(arg)
}

func (a *API) SendAttachmentByConvID(convID chat1.ConvIDStr, filename string, title string) (SendResponse, error) {
	arg := sendMessageArg{
		Method: "attach",
		Params: sendMessageParams{
			Options: sendMessageOptions{
				ConversationID: convID,
				Filename:       filename,
				Title:          title,
			},
		},
	}
	return a.doSend(arg)
}

////////////////////////////////////////////////////////
// React to chat ///////////////////////////////////////
////////////////////////////////////////////////////////

type reactionOptions struct {
	ConversationID chat1.ConvIDStr `json:"conversation_id"`
	Message        sendMessageBody
	MsgID          chat1.MessageID   `json:"message_id"`
	Channel        chat1.ChatChannel `json:"channel"`
}

type reactionParams struct {
	Options reactionOptions
}

type reactionArg struct {
	Method string
	Params reactionParams
}

func newReactionArg(options reactionOptions) reactionArg {
	return reactionArg{
		Method: "reaction",
		Params: reactionParams{Options: options},
	}
}

func (a *API) ReactByChannel(channel chat1.ChatChannel, msgID chat1.MessageID, reaction string) (SendResponse, error) {
	arg := newReactionArg(reactionOptions{
		Message: sendMessageBody{Body: reaction},
		MsgID:   msgID,
		Channel: channel,
	})
	return a.doSend(arg)
}

func (a *API) ReactByConvID(convID chat1.ConvIDStr, msgID chat1.MessageID, reaction string) (SendResponse, error) {
	arg := newReactionArg(reactionOptions{
		Message:        sendMessageBody{Body: reaction},
		MsgID:          msgID,
		ConversationID: convID,
	})
	return a.doSend(arg)
}

func (a *API) EditByConvID(convID chat1.ConvIDStr, msgID chat1.MessageID, text string) (SendResponse, error) {
	arg := reactionArg{
		Method: "edit",
		Params: reactionParams{Options: reactionOptions{
			Message:        sendMessageBody{Body: text},
			MsgID:          msgID,
			ConversationID: convID,
		}},
	}
	return a.doSend(arg)
}

////////////////////////////////////////////////////////
// Manage channels /////////////////////////////////////
////////////////////////////////////////////////////////

type ChannelsList struct {
	Result Result `json:"result"`
	Error  *Error `json:"error,omitempty"`
}

type JoinChannel struct {
	Error  *Error         `json:"error,omitempty"`
	Result chat1.EmptyRes `json:"result"`
}

type LeaveChannel struct {
	Error  *Error         `json:"error,omitempty"`
	Result chat1.EmptyRes `json:"result"`
}

func (a *API) ListChannels(teamName string) ([]string, error) {
	apiInput := fmt.Sprintf(`{"method": "listconvsonname", "params": {"options": {"topic_type": "CHAT", "members_type": "team", "name": "%s"}}}`, teamName)
	output, err := a.doFetch(apiInput)
	if err != nil {
		return nil, err
	}

	var channelsList ChannelsList
	if err := json.Unmarshal(output, &channelsList); err != nil {
		return nil, err
	} else if channelsList.Error != nil {
		return nil, errors.New(channelsList.Error.Message)
	}

	var channels []string
	for _, conv := range channelsList.Result.Convs {
		channels = append(channels, conv.Channel.TopicName)
	}
	return channels, nil
}

func (a *API) JoinChannel(teamName string, channelName string) (chat1.EmptyRes, error) {
	empty := chat1.EmptyRes{}

	apiInput := fmt.Sprintf(`{"method": "join", "params": {"options": {"channel": {"name": "%s", "members_type": "team", "topic_name": "%s"}}}}`, teamName, channelName)
	output, err := a.doFetch(apiInput)
	if err != nil {
		return empty, err
	}

	joinChannel := JoinChannel{}
	err = json.Unmarshal(output, &joinChannel)
	if err != nil {
		return empty, fmt.Errorf("failed to parse output from keybase team api: %v", err)
	} else if joinChannel.Error != nil {
		return empty, errors.New(joinChannel.Error.Message)
	}

	return joinChannel.Result, nil
}

func (a *API) LeaveChannel(teamName string, channelName string) (chat1.EmptyRes, error) {
	empty := chat1.EmptyRes{}

	apiInput := fmt.Sprintf(`{"method": "leave", "params": {"options": {"channel": {"name": "%s", "members_type": "team", "topic_name": "%s"}}}}`, teamName, channelName)
	output, err := a.doFetch(apiInput)
	if err != nil {
		return empty, err
	}

	leaveChannel := LeaveChannel{}
	err = json.Unmarshal(output, &leaveChannel)
	if err != nil {
		return empty, fmt.Errorf("failed to parse output from keybase team api: %v", err)
	} else if leaveChannel.Error != nil {
		return empty, errors.New(leaveChannel.Error.Message)
	}

	return leaveChannel.Result, nil
}

////////////////////////////////////////////////////////
// Send lumens in chat /////////////////////////////////
////////////////////////////////////////////////////////

func (a *API) InChatSend(channel chat1.ChatChannel, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		Channel: channel,
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
		ConfirmLumenSend: true,
	})
	return a.doSend(arg)
}

func (a *API) InChatSendByConvID(convID chat1.ConvIDStr, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		ConversationID: convID,
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
		ConfirmLumenSend: true,
	})
	return a.doSend(arg)
}

func (a *API) InChatSendByTlfName(tlfName string, body string, args ...interface{}) (SendResponse, error) {
	arg := newSendArg(sendMessageOptions{
		Channel: chat1.ChatChannel{
			Name: tlfName,
		},
		Message: sendMessageBody{
			Body: fmt.Sprintf(body, args...),
		},
		ConfirmLumenSend: true,
	})
	return a.doSend(arg)
}

////////////////////////////////////////////////////////
// Misc commands ///////////////////////////////////////
////////////////////////////////////////////////////////

type Advertisement struct {
	Alias          string `json:"alias,omitempty"`
	Advertisements []chat1.AdvertiseCommandAPIParam
}

type ListCommandsResponse struct {
	Result struct {
		Commands []chat1.UserBotCommandOutput `json:"commands"`
	} `json:"result"`
	Error *Error `json:"error,omitempty"`
}

type advertiseCmdsParams struct {
	Options Advertisement
}

type advertiseCmdsMsgArg struct {
	Method string
	Params advertiseCmdsParams
}

func newAdvertiseCmdsMsgArg(ad Advertisement) advertiseCmdsMsgArg {
	return advertiseCmdsMsgArg{
		Method: "advertisecommands",
		Params: advertiseCmdsParams{
			Options: ad,
		},
	}
}

func (a *API) AdvertiseCommands(ad Advertisement) (SendResponse, error) {
	return a.doSend(newAdvertiseCmdsMsgArg(ad))
}

func (a *API) ClearCommands() error {
	arg := struct {
		Method string
	}{
		Method: "clearcommands",
	}
	_, err := a.doSend(arg)
	return err
}

type listCmdsOptions struct {
	Channel        chat1.ChatChannel `json:"channel,omitempty"`
	ConversationID chat1.ConvIDStr   `json:"conversation_id,omitempty"`
}

type listCmdsParams struct {
	Options listCmdsOptions
}

type listCmdsArg struct {
	Method string
	Params listCmdsParams
}

func newListCmdsArg(options listCmdsOptions) listCmdsArg {
	return listCmdsArg{
		Method: "listcommands",
		Params: listCmdsParams{
			Options: options,
		},
	}
}

func (a *API) ListCommands(channel chat1.ChatChannel) ([]chat1.UserBotCommandOutput, error) {
	arg := newListCmdsArg(listCmdsOptions{
		Channel: channel,
	})
	return a.listCommands(arg)
}

func (a *API) ListCommandsByConvID(convID chat1.ConvIDStr) ([]chat1.UserBotCommandOutput, error) {
	arg := newListCmdsArg(listCmdsOptions{
		ConversationID: convID,
	})
	return a.listCommands(arg)
}

func (a *API) listCommands(arg listCmdsArg) ([]chat1.UserBotCommandOutput, error) {
	bArg, err := json.Marshal(arg)
	if err != nil {
		return nil, err
	}
	output, err := a.doFetch(string(bArg))
	if err != nil {
		return nil, err
	}
	var res ListCommandsResponse
	if err := json.Unmarshal(output, &res); err != nil {
		return nil, err
	} else if res.Error != nil {
		return nil, errors.New(res.Error.Message)
	}
	return res.Result.Commands, nil
}

type listMembersOptions struct {
	Channel        chat1.ChatChannel `json:"channel,omitempty"`
	ConversationID chat1.ConvIDStr   `json:"conversation_id,omitempty"`
}

type listMembersParams struct {
	Options listMembersOptions
}

type listMembersArg struct {
	Method string
	Params listMembersParams
}

func newListMembersArg(options listMembersOptions) listMembersArg {
	return listMembersArg{
		Method: "listmembers",
		Params: listMembersParams{
			Options: options,
		},
	}
}

func (a *API) ListMembers(channel chat1.ChatChannel) (keybase1.TeamMembersDetails, error) {
	arg := newListMembersArg(listMembersOptions{
		Channel: channel,
	})
	return a.listMembers(arg)
}

func (a *API) ListMembersByConvID(conversationID chat1.ConvIDStr) (keybase1.TeamMembersDetails, error) {
	arg := newListMembersArg(listMembersOptions{
		ConversationID: conversationID,
	})
	return a.listMembers(arg)
}

func (a *API) listMembers(arg listMembersArg) (res keybase1.TeamMembersDetails, err error) {
	bArg, err := json.Marshal(arg)
	if err != nil {
		return res, err
	}
	output, err := a.doFetch(string(bArg))
	if err != nil {
		return res, err
	}
	members := ListTeamMembers{}
	err = json.Unmarshal(output, &members)
	if err != nil {
		return res, UnmarshalError{err}
	}
	if members.Error.Message != "" {
		return res, members.Error
	}
	return members.Result.Members, nil
}

type GetMessagesResult struct {
	Result struct {
		Messages []chat1.Message `json:"messages"`
	} `json:"result"`
	Error *Error `json:"error,omitempty"`
}

type getMessagesOptions struct {
	Channel        chat1.ChatChannel `json:"channel,omitempty"`
	ConversationID chat1.ConvIDStr   `json:"conversation_id,omitempty"`
	MessageIDs     []chat1.MessageID `json:"message_ids,omitempty"`
}

type getMessagesParams struct {
	Options getMessagesOptions
}

type getMessagesArg struct {
	Method string
	Params getMessagesParams
}

func newGetMessagesArg(options getMessagesOptions) getMessagesArg {
	return getMessagesArg{
		Method: "get",
		Params: getMessagesParams{
			Options: options,
		},
	}
}

func (a *API) GetMessages(channel chat1.ChatChannel, msgIDs []chat1.MessageID) ([]chat1.Message, error) {
	arg := newGetMessagesArg(getMessagesOptions{
		Channel:    channel,
		MessageIDs: msgIDs,
	})
	return a.getMessages(arg)
}

func (a *API) GetMessagesByConvID(conversationID chat1.ConvIDStr, msgIDs []chat1.MessageID) ([]chat1.Message, error) {
	arg := newGetMessagesArg(getMessagesOptions{
		ConversationID: conversationID,
		MessageIDs:     msgIDs,
	})
	return a.getMessages(arg)
}

func (a *API) getMessages(arg getMessagesArg) ([]chat1.Message, error) {
	bArg, err := json.Marshal(arg)
	if err != nil {
		return nil, err
	}
	output, err := a.doFetch(string(bArg))
	if err != nil {
		return nil, err
	}
	var res GetMessagesResult
	err = json.Unmarshal(output, &res)
	if err != nil {
		return nil, UnmarshalError{err}
	}
	if res.Error != nil {
		return nil, res.Error
	}
	return res.Result.Messages, nil
}
