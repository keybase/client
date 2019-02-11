// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"golang.org/x/net/context"
	"os"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func NewCmdOneshot(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "paperkey",
			Usage: "DANGEROUS: specify a paper key (or try the KEYBASE_PAPERKEY environment variable)",
		},
		cli.StringFlag{
			Name:  "u,username",
			Usage: "specify a username (or try the KEYBASE_USERNAME environment variable)",
		},
	}
	cmd := cli.Command{
		Name:  "oneshot",
		Usage: "Establish a oneshot device, as in logging into keybase from a disposable docker",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdOneshotRunner(g), "oneshot", c)
			cl.SetNoStandalone()
		},
		Flags: flags,
		Description: `"keybase oneshot" is used to establish a temporary device that will
  be thrown away after the corresponding "keybase service" process exits (or
  logout is called). For instance, you can use this, instead of login, for
  running keybase in a Docker container.

  It won't write any credential information out disk, and it won't make any
  changes to the user's sigchain. It will rather hold the given paperkey in
  memory for as long as the service is running (or until "keybase logout" is
  called) and then will disappear.

  It needs a username and a paperkey to work, either passed in via standard input,
  command-line flags, or the environment.

  The default way to pass a paperkey into oneshot is via standard input.
  On a terminal, you'll get a familiar passphrase prompt. In a script or
  programmatic environment, when standard input is not a terminal, you can pipe
  the paper key to standard input, with or without a trailing newline.

  Otherwise, and this is more dangerous, you can pass a paperkey via the environment
  or via command line flags. Other processes running on the machine can inspect these
  data, so be very careful with this input choice.

  Also note that by default keybase shouldn't be run as root, but in Docker (or
  other containers), root can be the best option, so you can use "keybase oneshot"
  in concert with the KEYBASE_ALLOW_ROOT=1 environment variable.

  Some features won't work in oneshot mode, like exploding messages.`,
	}
	return cmd
}

type CmdOneshot struct {
	libkb.Contextified
	Username string
	PaperKey string
}

func NewCmdOneshotRunner(g *libkb.GlobalContext) *CmdOneshot {
	return &CmdOneshot{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdOneshot) Run() error {
	protocols := []rpc.Protocol{}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	client, err := GetLoginClient(c.G())
	if err != nil {
		return err
	}

	paperkey, err := c.getPaperKey()
	if err != nil {
		return err
	}

	err = client.LoginOneshot(context.Background(), keybase1.LoginOneshotArg{SessionID: 0, Username: c.Username, PaperKey: paperkey})
	return err
}

func (c *CmdOneshot) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		return errors.New("didn't expect any arguments")
	}
	c.Username, err = c.getOption(ctx, "username", true /* required */)
	if err != nil {
		return err
	}
	c.PaperKey, err = c.getOption(ctx, "paperkey", false /* required */)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdOneshot) getPaperKey() (ret string, err error) {
	if len(c.PaperKey) > 0 {
		return c.PaperKey, nil
	}
	ret, err = c.G().UI.GetTerminalUI().PromptPasswordMaybeScripted(PromptDescriptorPaperKey, "paper key: ")
	return ret, err
}

func (c *CmdOneshot) getOption(ctx *cli.Context, s string, required bool) (string, error) {
	v := ctx.String(s)
	if len(v) > 0 {
		return v, nil
	}
	envVarName := fmt.Sprintf("KEYBASE_%s", strings.ToUpper(s))
	v = os.Getenv(envVarName)
	if len(v) > 0 {
		return v, nil
	}
	var err error
	if required {
		err = fmt.Errorf("Need a --%s option or a %s environment variable", s, envVarName)
	}
	return "", err
}

func (c *CmdOneshot) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    false,
		KbKeyring: false,
		API:       false,
	}
}
