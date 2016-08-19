// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/chat1"
	"github.com/keybase/gregor/protocol/gregor1"
)

type uidUsernameMapper map[keybase1.UID]string

func (m uidUsernameMapper) getUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (string, error) {
	if m == nil {
		m = make(uidUsernameMapper)
	}

	if username, ok := m[uid]; ok {
		return username, nil
	}

	userClient, err := GetUserClient(g)
	if err != nil {
		return "", err
	}
	var ret keybase1.User
	if ret, err = userClient.LoadUser(ctx, keybase1.LoadUserArg{
		Uid: uid,
	}); err != nil {
		return "", err
	}

	m[uid] = ret.Username
	return ret.Username, err
}

type cmdChatInbox struct {
	libkb.Contextified
	chatLocalClient keybase1.ChatLocalInterface // for testing only
}

func newCmdChatInbox(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "inbox",
		Usage:        "Show new messages in inbox",
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatInbox{Contextified: libkb.NewContextified(g)}, "inbox", c)
		},
	}
}

func (c *cmdChatInbox) getMessagesFlattened(ctx context.Context) (messages cliChatMessages, err error) {
	chatClient := c.chatLocalClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(c.G())
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	var mapper uidUsernameMapper
	msgs, err := chatClient.GetMessagesLocal(ctx, keybase1.MessageSelector{
		// TODO: shoudl populate After/Before be dynamic when we have flag like --since
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT},
	})
	if err != nil {
		return nil, fmt.Errorf("GetMessagesLocal error: %s", err)
	}

	for _, m := range msgs {
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
			isNew:         true, // TODO: pupulate this properly after we implement message new/read
			with:          strings.Split(m.MessagePlaintext.ClientHeader.TlfName, ","),
			topic:         hex.EncodeToString([]byte(m.MessagePlaintext.ClientHeader.Conv.TopicID)[:4]), // TODO: populate this properly after we implement topic names
			author:        string(username),
			timestamp:     gregor1.FromTime(m.ServerHeader.Ctime),
			formattedBody: body,
		})
	}

	return messages, nil
}

func (c *cmdChatInbox) Run() error {
	messages, err := c.getMessagesFlattened(context.TODO())
	if err != nil {
		return err
	}
	messages.printByUnreadThenLatest(c.G().UI.GetTerminalUI())

	return nil
}

func (c *cmdChatInbox) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *cmdChatInbox) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
