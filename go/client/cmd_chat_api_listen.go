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
		},
	}
}

func (c *CmdChatAPIListen) ParseArgv(ctx *cli.Context) error {
	c.hideExploding = ctx.Bool("hide-exploding")
	c.showLocal = ctx.Bool("local")
	c.subscribeDev = ctx.Bool("dev")
	c.subscribeWallet = ctx.Bool("wallet")
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

func (c *CmdChatAPIListen) Run() error {
	sessionClient, err := GetSessionClient(c.G())
	if err != nil {
		return err
	}

	chatDisplay := newChatNotificationDisplay(c.G(), c.showLocal, c.hideExploding)
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
