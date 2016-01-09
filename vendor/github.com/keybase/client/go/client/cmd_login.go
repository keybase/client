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
	done       chan struct{}
}

func NewCmdLoginRunner(g *libkb.GlobalContext) *CmdLogin {
	return &CmdLogin{
		Contextified: libkb.NewContextified(g),
		clientType:   keybase1.ClientType_CLI,
		done:         make(chan struct{}, 1),
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
	defer func() {
		c.cancel()
		c.cancel = nil
	}()

	err = client.Login(ctx,
		keybase1.LoginArg{
			Username:   c.username,
			DeviceType: libkb.DeviceTypeDesktop,
			ClientType: c.clientType,
		})
	c.done <- struct{}{}

	// Provide explicit error messages in these two cases.
	switch err.(type) {
	case libkb.NoSyncedPGPKeyError:
		err = c.errNoSyncedKey()
	case libkb.PassphraseError:
		err = c.errPassphrase()
	}

	return err
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

		// In go-framed-msgpack-rpc, dispatch.handleCall() starts a goroutine to check the context being
		// canceled.
		// So, need to wait here for call to actually finish in order for the cancel message to make it
		// to the daemon.
		select {
		case <-c.done:
			c.G().Log.Debug("command finished, cancel complete")
		case <-time.After(5 * time.Second):
			c.G().Log.Debug("timed out waiting for command to finish")
		}
	}
	return nil
}

func (c *CmdLogin) errNoSyncedKey() error {
	return errors.New(`in Login

Sorry, you have a PGP private key that Keybase doesn't have a copy of.
You need to prove you're you. Any of these will unlock this computer:

   - reset your account and start fresh: https://keybase.io/#account-reset
   - install GPG and put your PGP private key on this machine and try again
   - go back and provision with another device or paper key
`)
}

func (c *CmdLogin) errPassphrase() error {
	return errors.New(`in Login

The server rejected your login attempt.

If you'd like to reset your passphrase, go to https://keybase.io/#password-reset
`)
}
