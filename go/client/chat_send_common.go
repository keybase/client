// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ChatSendArg struct {
	resolvingRequest chatConversationResolvingRequest

	// Only one of these should be set
	message           string
	setTopicName      string
	setHeadline       string
	clearHeadline     bool
	deleteHistory     *chat1.MessageDeleteHistory
	ephemeralLifetime time.Duration

	hasTTY       bool
	nonBlock     bool
	team         bool // TODO is this field used?
	mustNotExist bool
}

func chatSend(ctx context.Context, g *libkb.GlobalContext, c ChatSendArg) error {
	resolver, err := newChatConversationResolver(g)
	if err != nil {
		return err
	}

	createIfNotExists := true
	if c.clearHeadline || c.deleteHistory != nil {
		createIfNotExists = false
	}
	conversation, userChosen, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: createIfNotExists,
		MustNotExist:      c.mustNotExist,
		Interactive:       c.hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	switch err.(type) {
	case nil:
		break
	case libkb.ResolutionError:
		return fmt.Errorf("could not resolve `%s` into Keybase user(s) or a team", c.resolvingRequest.TlfName)
	default:
		return err
	}
	conversationInfo := conversation.Info

	var arg chat1.PostLocalArg
	arg.ConversationID = conversationInfo.Id
	arg.IdentifyBehavior = keybase1.TLFIdentifyBehavior_CHAT_CLI

	var msg chat1.MessagePlaintext
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msg.ClientHeader.Conv = conversationInfo.Triple
	msg.ClientHeader.TlfName = conversationInfo.TlfName
	msg.ClientHeader.TlfPublic = (conversationInfo.Visibility == keybase1.TLFVisibility_PUBLIC)

	// Whether the user is really sure they want to send to the selected conversation.
	// We require an additional confirmation if the choose menu was used.
	confirmed := !userChosen

	// Do one of set topic name, set headline, or send message
	switch {
	case c.setTopicName != "":
		msg.ClientHeader.MessageType = chat1.MessageType_METADATA
		msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
	case c.setHeadline != "":
		msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: c.setHeadline})
	case c.clearHeadline:
		msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: ""})
	case c.deleteHistory != nil:
		msg.ClientHeader.MessageType = chat1.MessageType_DELETEHISTORY
		msg.ClientHeader.DeleteHistory = c.deleteHistory
		msg.MessageBody = chat1.NewMessageBodyWithDeletehistory(*c.deleteHistory)
	default:
		// Ask for message contents
		if len(c.message) == 0 {
			promptText := "Please enter message content: "
			if !confirmed {
				promptText = fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter message content to send: ", conversationInfo.TlfName)
			}
			c.message, err = g.UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
			if err != nil {
				return err
			}
			confirmed = true
		}
		if c.ephemeralLifetime != 0 {
			lifetime := gregor1.ToDurationSec(c.ephemeralLifetime)
			msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{Lifetime: lifetime}
		}

		msg.ClientHeader.MessageType = chat1.MessageType_TEXT
		msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})
	}

	if !confirmed {
		promptText := fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter to send.", conversationInfo.TlfName)
		_, err = g.UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
		if err != nil {
			return err
		}
		confirmed = true
	}

	arg.Msg = msg

	if c.nonBlock {
		var nbarg chat1.PostLocalNonblockArg
		nbarg.ConversationID = arg.ConversationID
		nbarg.Msg = arg.Msg
		nbarg.IdentifyBehavior = arg.IdentifyBehavior
		if _, err = resolver.ChatClient.PostLocalNonblock(ctx, nbarg); err != nil {
			return err
		}
	} else {
		if _, err = resolver.ChatClient.PostLocal(ctx, arg); err != nil {
			return err
		}
	}

	return nil
}
