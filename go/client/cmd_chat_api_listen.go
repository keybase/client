// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdChatAPIListen struct {
	libkb.Contextified

	showLocal       bool
	hideExploding   bool
	subscribeDev    bool
	subscribeWallet bool
	channelFilters  []ChatChannel
}

func newCmdChatAPIListen(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "api-listen",
		Usage: "Listen and print incoming chat actions in JSON format",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdChatAPIListen{
				Contextified: libkb.NewContextified(g),
			}, "api-listen", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "local",
				Usage: "Show local messages (skipped by default)",
			},
			cli.BoolFlag{
				Name:  "hide-exploding",
				Usage: "Hide exploding messages",
			},
			cli.BoolFlag{
				Name:  "dev",
				Usage: "Subscribe to notifications for chat dev channels",
			},
			cli.BoolFlag{
				Name:  "wallet",
				Usage: "Subscribe to notifications for wallet events",
			},
			cli.StringFlag{
				Name:  "filter-channel",
				Usage: "Only show notifications for specified (one) channel.",
			},
			cli.StringFlag{
				Name:  "filter-channels",
				Usage: "Only show notifications for specified list of channels.",
			},
		},
		Description: `"keybase chat api-listen" is a command that will print incoming chat messages or
   wallet notifications until it's exited. Messages are printed to standard output in
   a JSON format similar to the format used in "keybase chat api" command.

   For chat messages, all messages will be relayed by default. Filtering can be enabled using
   --filter-channel or --filter-channels flags that take JSON arguments.

   Examples:

   Only show messages from user conversation "alice,bob,charlie", and from
   "all_things_crypto" team channel #core:

      keybase chat api-listen --filter-channels '[{"name":"alice,bob,charlie"}, {"name":"all_things_crypto", "topic_name": "core", "members_type": "team"}]'

   Only show messages from "alice,bob" user conversation:

      keybase chat api-listen --filter-channel '{"name":"alice,bob"}'
`,
	}
}

func (c *CmdChatAPIListen) ParseArgv(ctx *cli.Context) error {
	if err := c.parseFilterChannelArgs(ctx); err != nil {
		return err
	}

	c.hideExploding = ctx.Bool("hide-exploding")
	c.showLocal = ctx.Bool("local")
	c.subscribeDev = ctx.Bool("dev")
	c.subscribeWallet = ctx.Bool("wallet")

	return nil
}

func (c *CmdChatAPIListen) parseFilterChannelArgs(ctx *cli.Context) error {
	if chs := ctx.String("filter-channels"); chs != "" {
		if err := json.Unmarshal([]byte(chs), &c.channelFilters); err != nil {
			return err
		}
	}

	if ch := ctx.String("filter-channel"); ch != "" {
		var channel ChatChannel
		if err := json.Unmarshal([]byte(ch), &channel); err != nil {
			return err
		}
		c.channelFilters = append(c.channelFilters, channel)
	}

	for _, v := range c.channelFilters {
		if !v.Valid() {
			str, _ := json.Marshal(v)
			return fmt.Errorf("Channel filter not valid: %s", str)
		}
	}

	return nil
}

func NewCmdChatAPIListenRunner(g *libkb.GlobalContext) *CmdChatAPIListen {
	return &CmdChatAPIListen{
		Contextified: libkb.NewContextified(g),
	}
}

func sendPing(cli keybase1.SessionClient) error {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	return cli.SessionPing(ctx)
}

func (c *CmdChatAPIListen) ErrWriteLn(format string, obj ...interface{}) {
	c.G().UI.GetTerminalUI().ErrorWriter().Write([]byte(fmt.Sprintf(format, obj...) + "\n"))
}

func (c *CmdChatAPIListen) Run() error {
	sessionClient, err := GetSessionClient(c.G())
	if err != nil {
		return err
	}

	chatDisplay := newChatNotificationDisplay(c.G(), c.showLocal, c.hideExploding)

	if err := chatDisplay.setupFilters(context.TODO(), c.channelFilters); err != nil {
		return err
	}

	if filterLen := len(chatDisplay.filtersNormalized); filterLen > 0 {
		c.ErrWriteLn("Message filtering is active with %d filters", filterLen)
		for i, v := range chatDisplay.filtersNormalized {
			c.ErrWriteLn("filter %d: %+v", i, v)
		}
	}

	protocols := []rpc.Protocol{
		chat1.NotifyChatProtocol(chatDisplay),
	}
	if c.subscribeWallet {
		stellarDisplay := newWalletNotificationDisplay(c.G())
		protocols = append(protocols, stellar1.NotifyProtocol(stellarDisplay))
	}

	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetNotifyCtlClient(c.G())
	if err != nil {
		return err
	}
	channels := keybase1.NotificationChannels{
		Chat:    true,
		Chatdev: c.subscribeDev,
		Wallet:  c.subscribeWallet,
	}
	if err := cli.SetNotifications(context.TODO(), channels); err != nil {
		return err
	}
	errWriter := c.G().UI.GetTerminalUI().ErrorWriter()
	errWriter.Write([]byte(fmt.Sprintf("Listening for chat notifications. Config: hideExploding: %v, showLocal: %v, subscribeDevChannels: %v\n",
		c.hideExploding, c.showLocal, c.subscribeDev)))
	if c.subscribeWallet {
		errWriter.Write([]byte("Listening for wallet notifications\n"))
	}

	for {
		if err := sendPing(sessionClient); err != nil {
			return fmt.Errorf("connection to service lost: error during ping: %v", err)
		}
		time.Sleep(time.Second)
	}
}

func (c *CmdChatAPIListen) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

type baseNotificationDisplay struct {
	libkb.Contextified
}

func newBaseNotificationDisplay(g *libkb.GlobalContext) *baseNotificationDisplay {
	return &baseNotificationDisplay{
		Contextified: libkb.NewContextified(g),
	}
}

func (d *baseNotificationDisplay) printf(fmt string, args ...interface{}) error {
	_, err := d.G().UI.GetTerminalUI().Printf(fmt, args...)
	return err
}

func (d *baseNotificationDisplay) errorf(format string, args ...interface{}) error {
	_, err := d.G().UI.GetTerminalUI().ErrorWriter().Write([]byte(fmt.Sprintf(format, args...)))
	return err
}

func (d *baseNotificationDisplay) printJSON(data interface{}) {
	if jsonStr, err := json.Marshal(data); err != nil {
		d.errorf("Error while marshaling JSON: %s\n", err)
	} else {
		d.printf("%s\n", string(jsonStr))
	}
}
