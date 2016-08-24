// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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

	selector keybase1.MessageSelector
}

func newCmdChatInbox(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "inbox",
		Usage:        "Show new messages in inbox.",
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatInbox{Contextified: libkb.NewContextified(g)}, "inbox", c)
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
				Usage: `Limit the number of messages shown. Only effective when > 0.`,
			},
		},
		Description: `"keybase chat inbox" display an inbox view of chat messages. --since/--after and --before can be used to specify a time range of messages displayed. Duration (e.g. "2d" meaning 2 days ago) and RFC3339 Time (e.g. "2006-01-02T15:04:05Z07:00") are both supported. Using --before requires a --since/--after to pair with.  Using --since/--after alone implies "--before 0s". If none of time range flags are specified, this command only shows new messages.`,
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
	msgs, err := chatClient.GetMessagesLocal(ctx, c.selector)
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

// parseDurationExtended is like time.ParseDuration, but adds "d" unit. "1d" is
// one day, defined as 24*time.Hour. Only whole days are supported for "d"
// unit, but it can be followed by smaller units, e.g., "1d1h".
func parseDurationExtended(s string) (d time.Duration, err error) {
	p := strings.Index(s, "d")
	if p == -1 {
		// no "d" suffix
		return time.ParseDuration(s)
	}

	var days int
	if days, err = strconv.Atoi(s[:p]); err != nil {
		return time.Duration(0), err
	}
	d = time.Duration(days) * 24 * time.Hour

	if p < len(s) {
		var dur time.Duration
		if dur, err = time.ParseDuration(s[p+1:]); err != nil {
			return time.Duration(0), err
		}
		d += dur
	}

	return d, nil
}

func parseTimeFromRFC3339OrDurationFromPast(s string) (t time.Time, err error) {
	var errt, errd error
	var d time.Duration

	if s == "" {
		return
	}

	if t, errt = time.Parse(time.RFC3339, s); errt == nil {
		return t, nil
	}
	if d, errd = parseDurationExtended(s); errd == nil {
		return time.Now().Add(-d), nil
	}

	return time.Time{}, fmt.Errorf("given string is neither a valid time (%s) nor a valid duration (%v)", errt, errd)

}

func (c *cmdChatInbox) ParseArgv(ctx *cli.Context) (err error) {
	var before, after time.Time
	if before, err = parseTimeFromRFC3339OrDurationFromPast(ctx.String("before")); err != nil {
		err = fmt.Errorf("parsing --before flag error: %s", err)
		return err
	}
	if after, err = parseTimeFromRFC3339OrDurationFromPast(ctx.String("after")); err != nil {
		err = fmt.Errorf("parsing --after/--since flag error: %s", err)
		return err
	}

	c.selector = keybase1.MessageSelector{
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT},
		LimitNumber:  ctx.Int("limit"),
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

func (c *cmdChatInbox) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
