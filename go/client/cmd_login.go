// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdLogin(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.BoolFlag{
			Name:  "s, switch",
			Usage: "switch out the current user for another",
		},
		cli.StringFlag{
			Name:  "paperkey",
			Usage: "DANGEROUS: automatically provision using this paper key",
		},
		cli.StringFlag{
			Name:  "devicename",
			Usage: "Device name used in automated provisioning",
		},
	}
	cmd := cli.Command{
		Name:         "login",
		ArgumentHelp: "[username]",
		Usage:        "Establish a session with the keybase server",
		Description: `"keybase login" allows you to authenticate your local service against
the keybase server. By default this runs an interactive flow, but
you can automate this if your service has never been logged into
a particular account before and the account has a paper key - in order
to do so, pass the username as an argument, your desired unique device
name as the "-devicename" flag and pass the paper key as the standard
input. Alternatively, these parameters can be passed as "KEYBASE_PAPERKEY"
and "KEYBASE_DEVICENAME" environment variables.`,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdLoginRunner(g), "login", c)
		},
		Flags: flags,
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
	Username     string
	doUserSwitch bool

	PaperKey   string
	DeviceName string

	clientType keybase1.ClientType
	cancel     func()
	done       chan struct{}
	SessionID  int
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

	var paperKey string
	if c.DeviceName != "" {
		paperKey, err = c.getPaperKey()
		if err != nil {
			return err
		}
	}

	err = client.Login(ctx,
		keybase1.LoginArg{
			Username:     c.Username,
			DeviceType:   libkb.DeviceTypeDesktop,
			ClientType:   c.clientType,
			SessionID:    c.SessionID,
			DoUserSwitch: c.doUserSwitch,

			PaperKey:   paperKey,
			DeviceName: c.DeviceName,
		})
	c.done <- struct{}{}

	// Provide explicit error messages for these cases.
	switch x := err.(type) {
	case libkb.NoSyncedPGPKeyError:
		err = c.errNoSyncedKey()
	case libkb.PassphraseError:
		err = c.errPassphrase()
	case libkb.NoMatchingGPGKeysError:
		err = c.errNoMatchingGPGKeys(x.Fingerprints)
	case libkb.DeviceAlreadyProvisionedError:
		err = c.errDeviceAlreadyProvisioned()
	case libkb.ProvisionUnavailableError:
		err = c.errProvisionUnavailable()
	case libkb.GPGUnavailableError:
		err = c.errGPGUnavailable()
	case libkb.NotFoundError:
		err = c.errNotFound()
	}

	return err
}

func (c *CmdLogin) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	if nargs > 1 {
		return errors.New("Invalid arguments.")
	}

	if nargs == 1 {
		c.Username = ctx.Args()[0]
		checker := libkb.CheckUsername
		if !checker.F(c.Username) {
			return fmt.Errorf("Invalid username. Valid usernames are: %s", checker.Hint)
		}
	}
	c.doUserSwitch = ctx.Bool("switch")

	c.PaperKey = c.getOption(ctx, "paperkey")
	c.DeviceName = c.getOption(ctx, "devicename")

	return nil
}

func (c *CmdLogin) getOption(ctx *cli.Context, s string) string {
	v := ctx.String(s)
	if len(v) > 0 {
		return v
	}
	envVarName := fmt.Sprintf("KEYBASE_%s", strings.ToUpper(strings.Replace(s, "-", "_", -1)))
	v = os.Getenv(envVarName)
	if len(v) > 0 {
		return v
	}
	return ""
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

func (c *CmdLogin) getPaperKey() (ret string, err error) {
	if len(c.PaperKey) > 0 {
		return c.PaperKey, nil
	}
	ret, err = c.G().UI.GetTerminalUI().PromptPasswordMaybeScripted(PromptDescriptorPaperKey, "paper key: ")
	return ret, err
}

func (c *CmdLogin) errNoSyncedKey() error {
	return errors.New(`in Login

Sorry, your account is already established with a PGP public key, but this
utility cannot access the corresponding private key. You need to prove
you're you. We suggest one of the following:

   - install GPG and put your PGP private key on this machine and try again
   - reset your account and start fresh: https://keybase.io/#account-reset
   - go back and provision with another device or paper key
`)
}

func (c *CmdLogin) errPassphrase() error {
	return errors.New(`in Login

The server rejected your login attempt.

If you'd like to reset your passphrase, go to https://keybase.io/#password-reset
`)
}

func (c *CmdLogin) errNoMatchingGPGKeys(fingerprints []string) error {
	plural := len(fingerprints) > 1

	first := "Sorry, your account is already established with a PGP public key, but this\nutility cannot find the corresponding private key on this machine."
	pre := "This is the fingerprint of the PGP key in your account:"
	if plural {
		first = "Sorry, your account is already established with PGP public keys, but this\nutility cannot find a corresponding private key on this machine."
		pre = "These are the fingerprints of the PGP keys in your account:"
	}

	fpsIndent := make([]string, len(fingerprints))
	for i, fp := range fingerprints {
		fpsIndent[i] = "   " + fp
	}

	after := `You need to prove you're you. We suggest one of the following:

   - put one of the PGP private keys listed above on this machine and try again
   - reset your account and start fresh: https://keybase.io/#account-reset
`

	out := first + "\n" + pre + "\n\n" + strings.Join(fpsIndent, "\n") + "\n\n" + after
	return errors.New(out)
}

func (c *CmdLogin) errDeviceAlreadyProvisioned() error {
	return errors.New(`in Login

You have already provisioned this device. Please use 'keybase login [username]'
to log in.
`)
}

func (c *CmdLogin) errProvisionUnavailable() error {
	return errors.New(`in Login

The only way to provision this device is with access to one of your existing
devices. You can try again later, or if you have lost access to all your
existing devices you can reset your account and start fresh.

If you'd like to reset your account:  https://keybase.io/#account-reset
`)
}

func (c *CmdLogin) errGPGUnavailable() error {
	return errors.New(`in Login

Sorry, your account is already established with a PGP public key, but this
utility cannot access the corresponding private key. You need to prove
you're you. We suggest one of the following:

   - install GPG and put your PGP private key on this machine and try again
   - reset your account and start fresh: https://keybase.io/#account-reset
`)
}

func (c *CmdLogin) errNotFound() error {
	return errors.New(`in Login

This username doesn't exist.`)
}
