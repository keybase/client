// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type cmdChatSend struct {
	libkb.Contextified
	resolver chatCLIConversationResolver
	// Only one of these should be set
	message       string
	setTopicName  string
	setHeadline   string
	clearHeadline bool
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
		Flags: mustGetChatFlags(
			"topic-type", "topic-name", "set-topic-name", "set-headline", "clear-headline", "stdin"),
	}
}

func (c *cmdChatSend) Run() (err error) {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	var conversationInfo chat1.ConversationInfoLocal
	resolved, userChosen, err := c.resolver.Resolve(context.TODO(), c.G(), chatClient, tlfClient)
	if err != nil {
		return err
	}

	if resolved == nil {
		if len(c.resolver.TlfName) == 0 {
			c.G().UI.GetTerminalUI().Printf("No conversation found. Type `keybase chat send <tlf> [message]` to create a new one.\n")
			return nil
		}

		// creating a new conversation!

		if len(c.resolver.TopicName) > 0 && c.resolver.TopicType == chat1.TopicType_CHAT {
			c.G().UI.GetTerminalUI().Printf("We are not supporting setting topic name for chat conversations yet.\n")
			return nil
		}

		var tnp *string
		if len(c.resolver.TopicName) > 0 {
			tnp = &c.resolver.TopicName
		}
		ncres, err := chatClient.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:       c.resolver.TlfName,
			TopicName:     tnp,
			TopicType:     c.resolver.TopicType,
			TlfVisibility: c.resolver.Visibility,
		})
		if err != nil {
			return fmt.Errorf("creating conversation error: %v\n", err)
		}
		conversationInfo = ncres.Conv.Info
	} else {
		conversationInfo = *resolved
	}

	var args chat1.PostLocalArg
	args.ConversationID = conversationInfo.Id

	var msgV1 chat1.MessagePlaintextV1
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msgV1.ClientHeader.Conv = conversationInfo.Triple
	msgV1.ClientHeader.TlfName = conversationInfo.TlfName

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
		msgV1.ClientHeader.MessageType = chat1.MessageType_METADATA
		msgV1.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
	case c.setHeadline != "":
		msgV1.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msgV1.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: c.setHeadline})
	case c.clearHeadline:
		msgV1.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msgV1.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: ""})
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

		msgV1.ClientHeader.MessageType = chat1.MessageType_TEXT
		msgV1.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})
	}

	if !confirmed {
		promptText := fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter to send.", conversationInfo.TlfName)
		c.message, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
		if err != nil {
			return err
		}
		confirmed = true
	}

	args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)

	if _, err = chatClient.PostLocal(ctx, args); err != nil {
		return err
	}

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	c.setTopicName = ctx.String("set-topic-name")
	c.setHeadline = ctx.String("set-headline")
	c.clearHeadline = ctx.Bool("clear-headline")
	useStdin := ctx.Bool("stdin")

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
		return err
	}

	nActions := 0

	if c.setTopicName != "" {
		nActions++
		if useStdin {
			return fmt.Errorf("stdin not supported when setting topic name")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set topic name simultaneously")
		}
	}

	if c.setHeadline != "" {
		nActions++
		if useStdin {
			return fmt.Errorf("stdin not supported with --set-headline")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set headline name simultaneously")
		}
	}

	if c.clearHeadline {
		nActions++
		if useStdin {
			return fmt.Errorf("stdin not supported with --clear-headline")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and clear headline name simultaneously")
		}
	}

	// Send a normal message.
	if nActions == 0 {
		nActions++
		if useStdin {
			if len(ctx.Args()) > 1 {
				return fmt.Errorf("too many args for sending from stdin")
			}
			bytes, err := ioutil.ReadAll(os.Stdin)
			if err != nil {
				return err
			}
			c.message = string(bytes)
		} else {
			switch len(ctx.Args()) {
			case 0, 1:
				c.message = ""
			case 2:
				c.message = ctx.Args().Get(1)
			default:
				cli.ShowCommandHelp(ctx, "send")
				return fmt.Errorf("chat send takes 1 or 2 args")
			}
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

func (c *cmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
