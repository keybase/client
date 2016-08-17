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

type uidUsernameMapper map[keybase1.UID]libkb.NormalizedUsername

func (m uidUsernameMapper) getUsername(g *libkb.GlobalContext, uid keybase1.UID) (username libkb.NormalizedUsername, err error) {
	if m == nil {
		m = make(uidUsernameMapper)
	}

	if username, ok := m[uid]; ok {
		return username, nil
	}

	loadUserArg := libkb.NewLoadUserArg(g)
	loadUserArg.UID = uid

	var ret *libkb.User
	if ret, err = libkb.LoadUser(loadUserArg); err != nil {
		return username, err
	}

	m[uid] = ret.GetNormalizedName()
	return username, err
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

func (c *cmdChatInbox) getMessagesFlattened() (messages cliChatMessages, err error) {
	chatClient := c.chatLocalClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(c.G())
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	var mapper uidUsernameMapper

	ipagination := &chat1.Pagination{}
getinbox:
	for {
		ipagination.Num = 32
		iview, err := chatClient.GetInboxLocal(context.TODO(), ipagination)
		if err != nil {
			return messages, err
		}

		tpagination := &chat1.Pagination{}
	getthread:
		for _, conv := range iview.Conversations {
			tpagination.Num = 32
			tview, err := chatClient.GetThreadLocal(context.TODO(), keybase1.GetThreadLocalArg{
				ConversationID: conv.Metadata.ConversationID,
				Pagination:     tpagination,
			})
			if err != nil {
				return nil, err
			}

			for _, m := range tview.Messages {
				if len(m.MessagePlaintext.MessageBodies) == 0 {
					continue
				}

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

				username, err := mapper.getUsername(c.G(), keybase1.UID(m.MessagePlaintext.ClientHeader.Sender.String()))
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

			if tview.Pagination == nil || tview.Pagination.Last != 0 {
				break getthread
			} else {
				tpagination = tview.Pagination
			}
		}

		if iview.Pagination == nil || iview.Pagination.Last != 0 {
			break getinbox
		} else {
			ipagination = iview.Pagination
		}
	}

	return messages, nil
}

func (c *cmdChatInbox) Run() error {
	messages, err := c.getMessagesFlattened()
	if err != nil {
		return err
	}
	messages.printByUnreadThenLatest()

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
