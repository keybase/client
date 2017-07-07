// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
)

type CmdChatSend struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	// Only one of these should be set
	message       string
	setTopicName  string
	setHeadline   string
	clearHeadline bool
	hasTTY        bool
	nonBlock      bool
	team          bool
}

func NewCmdChatSendRunner(g *libkb.GlobalContext) *CmdChatSend {
	return &CmdChatSend{Contextified: libkb.NewContextified(g)}
}

func (c *CmdChatSend) SetTeamChatForTest(n string) {
	c.team = true
	c.resolvingRequest = chatConversationResolvingRequest{
		TlfName:     n,
		TopicName:   chat.DefaultTeamTopic,
		MembersType: chat1.ConversationMembersType_TEAM,
		TopicType:   chat1.TopicType_CHAT,
		Visibility:  chat1.TLFVisibility_PRIVATE,
	}
}

func (c *CmdChatSend) SetMessage(m string) {
	c.message = m
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSendRunner(g), "send", c)
		},
		Flags: append(getConversationResolverFlags(),
			mustGetChatFlags("set-topic-name", "set-headline", "clear-headline", "nonblock")...,
		),
	}
}

func (c *CmdChatSend) Run() (err error) {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	resolver := &chatConversationResolver{G: c.G(), ChatClient: chatClient}
	resolver.TlfClient, err = GetTlfClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	conversation, userChosen, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: true,
		Interactive:       c.hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}
	conversationInfo := conversation.Info

	var args chat1.PostLocalArg
	args.ConversationID = conversationInfo.Id
	args.IdentifyBehavior = keybase1.TLFIdentifyBehavior_CHAT_CLI

	var msg chat1.MessagePlaintext
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msg.ClientHeader.Conv = conversationInfo.Triple
	msg.ClientHeader.TlfName = conversationInfo.TlfName
	msg.ClientHeader.TlfPublic = (conversationInfo.Visibility == chat1.TLFVisibility_PUBLIC)

	// Whether the user is really sure they want to send to the selected conversation.
	// We require an additional confirmation if the choose menu was used.
	confirmed := !userChosen

	// Do one of set topic name, set headline, or send message
	switch {
	case c.setTopicName != "":
		if conversationInfo.Triple.TopicType == chat1.TopicType_CHAT {
			c.G().UI.GetTerminalUI().Printf("We are not supporting setting topic name for chat conversations yet. Ignoring --set-topic-name >.<\n")
			return nil
		}
		msg.ClientHeader.MessageType = chat1.MessageType_METADATA
		msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
	case c.setHeadline != "":
		msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: c.setHeadline})
	case c.clearHeadline:
		msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: ""})
	default:
		// Ask for message contents
		if len(c.message) == 0 {
			promptText := "Please enter message content: "
			if !confirmed {
				promptText = fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter message content to send: ", conversationInfo.TlfName)
			}
			c.message, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
			if err != nil {
				return err
			}
			confirmed = true
		}

		msg.ClientHeader.MessageType = chat1.MessageType_TEXT
		msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})
	}

	if !confirmed {
		promptText := fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter to send.", conversationInfo.TlfName)
		_, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
		if err != nil {
			return err
		}
		confirmed = true
	}

	args.Msg = msg

	if c.nonBlock {
		var nbarg chat1.PostLocalNonblockArg
		nbarg.ConversationID = args.ConversationID
		nbarg.Msg = args.Msg
		nbarg.IdentifyBehavior = args.IdentifyBehavior
		if _, err = chatClient.PostLocalNonblock(ctx, nbarg); err != nil {
			return err
		}
	} else {
		if _, err = chatClient.PostLocal(ctx, args); err != nil {
			return err
		}
	}

	return nil
}

func (c *CmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	c.setTopicName = ctx.String("set-topic-name")
	c.setHeadline = ctx.String("set-headline")
	c.clearHeadline = ctx.Bool("clear-headline")
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	c.nonBlock = ctx.Bool("nonblock")
	c.team = ctx.Bool("team")

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}
	// TLFVisibility_ANY doesn't make any sense for send, so switch that to PRIVATE:
	if c.resolvingRequest.Visibility == chat1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = chat1.TLFVisibility_PRIVATE
	}

	nActions := 0

	if c.setTopicName != "" {
		nActions++
		if !c.hasTTY {
			return fmt.Errorf("stdin not supported when setting topic name")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set topic name simultaneously")
		}
	}

	if c.setHeadline != "" {
		nActions++
		if !c.hasTTY {
			return fmt.Errorf("stdin not supported with --set-headline")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set headline name simultaneously")
		}
	}

	if c.clearHeadline {
		nActions++
		if !c.hasTTY {
			return fmt.Errorf("stdin not supported with --clear-headline")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and clear headline name simultaneously")
		}
	}

	// Send a normal message.
	if nActions == 0 {
		nActions++
		switch len(ctx.Args()) {
		case 2:
			// message is supplied, so stdin is ignored even if piped
			c.message = ctx.Args().Get(1)
		case 1:
			if !c.hasTTY {
				bytes, err := ioutil.ReadAll(io.LimitReader(os.Stdin, msgchecker.TextMessageMaxLength))
				if err != nil {
					return err
				}
				c.message = string(bytes)
			} else {
				c.message = "" // get message through prompt later
			}
		case 0:
			if !c.hasTTY {
				return fmt.Errorf("need exactly 1 argument to send from stdin")
			}
			c.message = "" // get message through prompt later
		default:
			cli.ShowCommandHelp(ctx, "send")
			return fmt.Errorf("chat send takes 0, 1 or 2 args")
		}
	}

	if nActions < 1 {
		cli.ShowCommandHelp(ctx, "send")
		return fmt.Errorf("Incorrect Usage.")
	}
	if nActions > 1 {
		cli.ShowCommandHelp(ctx, "send")
		return fmt.Errorf("only one of message, --set-headline, --clear-headline, or --set-topic-name allowed")
	}

	return nil
}

func (c *CmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
