// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func newCmdBotSignup(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := cli.Command{
		Name:  "signup",
		Usage: "Signup a bot that will have a paper key but no device",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdBotSignupRunner(g), "signup", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "c, invite-code",
				Usage: "Specify an invite code (optional)",
			},
			cli.StringFlag{
				Name:  "e, email",
				Usage: "Specify an account email (optional)",
			},
			cli.StringFlag{
				Name:  "u, username",
				Usage: "Specify a username.",
			},
			cli.StringFlag{
				Name:  "t, token",
				Usage: "Specify a bot token",
			},
		},
	}
	return cmd
}

type CmdBotSignup struct {
	libkb.Contextified
	scli     keybase1.SignupClient
	ccli     keybase1.ConfigClient
	code     string
	email    string
	username string
	token    keybase1.BotToken
}

func NewCmdBotSignupRunner(g *libkb.GlobalContext) *CmdBotSignup {
	return &CmdBotSignup{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *CmdBotSignup) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	if nargs != 0 {
		return BadArgsError{"Signup doesn't take arguments."}
	}

	s.username = ctx.String("username")
	if len(s.username) == 0 {
		return BadArgsError{"must supply a username"}
	}
	s.token, err = keybase1.NewBotToken(ctx.String("token"))
	if err != nil {
		return BadArgsError{"bad bot token"}
	}

	s.code = ctx.String("invite-code")
	s.email = ctx.String("email")

	return nil
}

func (s *CmdBotSignup) Run() (err error) {

	if err = s.initClient(); err != nil {
		return err
	}

	rarg := keybase1.SignupArg{
		Username:    s.username,
		InviteCode:  s.code,
		RandomPw:    true,
		StoreSecret: false,
		SkipMail:    false,
		BotToken:    s.token,
		GenPGPBatch: false,
		GenPaper:    false,
		SkipGPG:     true,
	}
	res, err := s.scli.Signup(context.TODO(), rarg)
	if err != nil {
		return err
	}
	_ = s.G().UI.GetTerminalUI().Output(res.PaperKey + "\n")
	return nil
}

func (s *CmdBotSignup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}

func (s *CmdBotSignup) initClient() error {
	var err error
	if s.scli, err = GetSignupClient(s.G()); err != nil {
		return err
	}

	if s.ccli, err = GetConfigClient(s.G()); err != nil {
		return err
	}
	var protocols []rpc.Protocol
	return RegisterProtocolsWithContext(protocols, s.G())
}
