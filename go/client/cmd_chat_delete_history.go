// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"
)

type CmdChatDeleteHistory struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	age              gregor1.Seconds
	hasTTY           bool
}

func NewCmdChatDeleteHistoryRunner(g *libkb.GlobalContext) *CmdChatDeleteHistory {
	return &CmdChatDeleteHistory{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatDeleteHistory(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete-history",
		Usage:        "Delete chat history in a conversation",
		ArgumentHelp: "[conversation] --age=<interval>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatDeleteHistoryRunner(g), "delete-history", c)
			cl.SetNoStandalone()
		},
		Flags: append(getConversationResolverFlags(), []cli.Flag{
			cli.StringFlag{
				Name:  "age",
				Usage: `Only delete messages older than e.g. 2h, 3d, 1w `,
			},
		}...),
	}
}

func (c *CmdChatDeleteHistory) Run() (err error) {
	if c.resolvingRequest.TlfName != "" {
		err = annotateResolvingRequest(c.G(), &c.resolvingRequest)
		if err != nil {
			return err
		}
	}
	// TLFVisibility_ANY doesn't make any sense for send, so switch that to PRIVATE:
	if c.resolvingRequest.Visibility == keybase1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	}

	if c.G().Standalone {
		switch c.resolvingRequest.MembersType {
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAM:
			c.G().StartStandaloneChat()
		default:
			err = CantRunInStandaloneError{}
			return err
		}
	}

	return c.chatSendDeleteHistory(context.TODO())
}

func (c *CmdChatDeleteHistory) ParseArgv(ctx *cli.Context) (err error) {
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	if timeStr := ctx.String("age"); len(timeStr) > 0 {
		c.age, err = c.parseAge(timeStr)
		if err != nil {
			return err
		}
	}

	return nil
}

func (c *CmdChatDeleteHistory) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdChatDeleteHistory) parseAge(s string) (gregor1.Seconds, error) {
	generalErr := fmt.Errorf("duration must be an integer and suffix [s,h,d,w,m] like: 10d")
	if len(s) < 2 {
		return 0, generalErr
	}
	factor := time.Second
	switch s[len(s)-1] {
	case 's':
		factor = time.Second
	case 'm':
		factor = time.Minute
	case 'h':
		factor = time.Hour
	case 'd':
		factor = 24 * time.Hour
	case 'w':
		factor = 7 * 24 * time.Hour
	default:
		return 0, generalErr
	}
	base, err := strconv.Atoi(s[:len(s)-1])
	if err != nil {
		return 0, generalErr
	}
	if base < 0 {
		return 0, fmt.Errorf("age cannot be negative")
	}
	d := time.Duration(base) * factor
	return gregor1.Seconds(d.Seconds()), nil
}

// Like chatSend but uses PostDeleteHistory.
func (c *CmdChatDeleteHistory) chatSendDeleteHistory(ctx context.Context) error {
	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}

	conversation, userChosen, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       c.hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}
	conversationInfo := conversation.Info

	arg := chat1.PostDeleteHistoryArg{
		ConversationID:   conversationInfo.Id,
		TlfName:          conversationInfo.TlfName,
		TlfPublic:        (conversationInfo.Visibility == keybase1.TLFVisibility_PUBLIC),
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		Age:              c.age,
	}

	// Whether the user is really sure they want to send to the selected conversation.
	// We require an additional confirmation if the choose menu was used.
	confirmed := !userChosen

	if !confirmed {
		promptText := fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter to send.", conversationInfo.TlfName)
		_, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, promptText)
		if err != nil {
			return err
		}
		confirmed = true
	}

	_, err = resolver.ChatClient.PostDeleteHistory(ctx, arg)
	return err
}
