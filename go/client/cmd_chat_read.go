// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type cmdChatRead struct {
	libkb.Contextified
	chatLocalClient keybase1.ChatLocalInterface // for testing only

	selector keybase1.MessageSelector
	tlfName  string
}

func newCmdChatRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "read",
		Usage:        "Show new messages in a conversation and mark as read.",
		ArgumentHelp: "<conversation>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatRead{Contextified: libkb.NewContextified(g)}, "read", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "since,after",
				Usage: `Only show messages after certain time.`,
			},
			cli.StringFlag{
				Name:  "before",
				Usage: `Only show messages before certain time.`,
			},
			cli.IntFlag{
				Name:  "limit,n",
				Usage: `Limit the number of messages shown per conversation. Only effective when > 0.`,
				Value: 5,
			},
		},
		Description: `"keybase chat read" displays shows and read chat messages from a conversation. --since/--after and --before can be used to specify a time range of messages displayed. Duration (e.g. "2d" meaning 2 days ago) and RFC3339 Time (e.g. "2006-01-02T15:04:05Z07:00") are both supported. Using --before requires a --since/--after to pair with.  Using --since/--after alone implies "--before 0s". If none of time range flags are specified, this command only shows new messages.`,
	}
}

func (c *cmdChatRead) getMessagesFlattened(ctx context.Context) (messages cliChatMessages, err error) {
	chatClient := c.chatLocalClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(c.G())
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	conversationID, err := chatClient.GetOrCreateTextConversationLocal(ctx, keybase1.GetOrCreateTextConversationLocalArg{
		TlfName: c.tlfName,
	})
	if err != nil {
		return nil, err
	}
	c.selector.Conversations = []chat1.ConversationID{conversationID}

	var mapper uidUsernameMapper
	conversations, err := chatClient.GetMessagesLocal(ctx, c.selector)
	if err != nil {
		return nil, fmt.Errorf("GetMessagesLocal error: %s", err)
	}

	for _, conv := range conversations {
		if len(conv.Messages) == 0 {
			continue
		}
		m := conv.Messages[0]
		var body string
		switch t := m.MessagePlaintext.MessageBodies[0].Type; t {
		case chat1.MessageType_TEXT:
			body = formatChatText(m.MessagePlaintext.MessageBodies[0].Text)
		case chat1.MessageType_ATTACHMENT:
			body = formatChatAttachment(m.MessagePlaintext.MessageBodies[0].Attachment)
		default:
			c.G().Log.Debug("unsurported MessageType: %s", t)
			continue
		}

		username, err := mapper.getUsername(ctx, c.G(), keybase1.UID(m.MessagePlaintext.ClientHeader.Sender.String()))
		if err != nil {
			username = "<getting username error>" // TODO: return error here when/if we have integrated tests
		}

		messages = append(messages, cliChatMessage{
			isNew:         m.IsNew,
			with:          strings.Split(m.MessagePlaintext.ClientHeader.TlfName, ","),
			topic:         hex.EncodeToString([]byte(m.MessagePlaintext.ClientHeader.Conv.TopicID)[:4]), // TODO: populate this properly after we implement topic names
			author:        string(username),
			timestamp:     gregor1.FromTime(m.ServerHeader.Ctime),
			formattedBody: body,
		})
	}

	return messages, nil
}

func (c *cmdChatRead) Run() error {
	messages, err := c.getMessagesFlattened(context.TODO())
	if err != nil {
		return err
	}
	messages.printByUnreadThenLatest(c.G().UI.GetTerminalUI())

	return nil
}

func (c *cmdChatRead) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("keybase chat read current takes exactly 1 arg")
	}
	c.tlfName = ctx.Args().Get(0)

	c.selector = keybase1.MessageSelector{
		MessageTypes:         []chat1.MessageType{chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT},
		LimitPerConversation: ctx.Int("limit"),
		MarkAsRead:           true,
	}

	var before, after time.Time
	if before, err = parseTimeFromRFC3339OrDurationFromPast(ctx.String("before")); err != nil {
		err = fmt.Errorf("parsing --before flag error: %s", err)
		return err
	}
	if after, err = parseTimeFromRFC3339OrDurationFromPast(ctx.String("after")); err != nil {
		err = fmt.Errorf("parsing --after/--since flag error: %s", err)
		return err
	}

	switch {
	case before.IsZero() && after.IsZero():
		c.selector.OnlyNew = true
	case !before.IsZero() && !after.IsZero():
		kbefore := keybase1.ToTime(before)
		kafter := keybase1.ToTime(after)
		c.selector.Before = &kbefore
		c.selector.After = &kafter
	case before.IsZero() && !after.IsZero():
		kbefore := keybase1.ToTime(time.Now())
		kafter := keybase1.ToTime(after)
		c.selector.Before = &kbefore
		c.selector.After = &kafter
	case !before.IsZero() && after.IsZero():
		return errors.New(`--before is set but no pairing --after/--since is found. If you really want messages from the very begining, just use "--since 10000d"`)
	default:
		panic("incorrect switch/case!")
	}

	return nil
}

func (c *cmdChatRead) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
