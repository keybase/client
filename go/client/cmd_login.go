// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdLogin(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:         "login",
		ArgumentHelp: "[username]",
		Usage:        "Establish a session with the keybase server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdLoginRunner(g), "login", c)
		},
	}
	// Note we'll only be able to set this via mode via Environment variable
	// since it's too early to check command-line setting of it.
	if g.Env.GetRunMode() == libkb.DevelRunMode {
		cmd.Flags = append(cmd.Flags, cli.BoolFlag{
			Name:  "emulate-gui",
			Usage: "emulate GUI signing and fork GPG from the service",
		})
	}
	return cmd
}

type CmdLogin struct {
	libkb.Contextified
	username   string
	clientType keybase1.ClientType
	cancel     func()
}

func NewCmdLoginRunner(g *libkb.GlobalContext) *CmdLogin {
	return &CmdLogin{
		Contextified: libkb.NewContextified(g),
		clientType:   keybase1.ClientType_CLI,
	}
}

func (c *CmdLogin) Run() error {
	protocols := []rpc.Protocol{
		NewProvisionUIProtocol(c.G(), libkb.KexRoleProvisionee),
		NewLoginUIProtocol(c.G()),
		NewSecretUIProtocol(c.G()),
		NewGPGUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	client, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}

	// TODO: it would be nice to move this up a level and have keybase/main.go create
	// a context and pass it to Command.Run(), then it can handle cancel itself
	// instead of using Command.Cancel().
	ctx, cancel := context.WithCancel(context.Background())
	c.cancel = cancel
	defer c.cancel()

	return client.Login(ctx,
		keybase1.LoginArg{
			Username:   c.username,
			DeviceType: libkb.DeviceTypeDesktop,
			ClientType: c.clientType,
		})
}

func (c *CmdLogin) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return errors.New("Invalid arguments.")
	}

	if nargs == 1 {
		c.username = ctx.Args()[0]
		if libkb.CheckEmail.F(c.username) {
			return errors.New("Please login again via `keybase login [username]`")
		}
		if !libkb.CheckUsername.F(c.username) {
			return errors.New("Invalid username format. Please login again via `keybase login [username]`")
		}
	}
	if ctx.Bool("emulate-gui") {
		c.clientType = keybase1.ClientType_GUI
	}
	return nil
}

func (c *CmdLogin) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

func (c *CmdLogin) Cancel() error {
	c.G().Log.Debug("received request to cancel running login command")
	if c.cancel != nil {
		c.G().Log.Debug("command cancel function exists, calling it")
		c.cancel()

		// hack:
		// In go-framed-msgpack-rpc, dispatch.handleCall() starts a goroutine to check the context being
		// canceled.  Without this sleep, there's (often) no time for the goroutine to receive the
		// context.Done() before keybase/main.go shuts down everything.
		// In practice, the sleep never lasts 5 seconds, just long enough for everything to get canceled.
		time.Sleep(5 * time.Second)
	}
	return nil
}
