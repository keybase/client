// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"encoding/json"
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdPipeOwner(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "pipeowner",
		Usage: "ensure the named pipe is owned by the logged in user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPipeOwner{libkb.NewContextified(g), ""}, "pipeowner", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
			cl.SetSkipOutOfDateCheck()
		},
	}
}

type CmdPipeOwner struct {
	libkb.Contextified
	arg string
}

func (s *CmdPipeOwner) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return errors.New("pipeowner needs a pipe name")
	}
	s.arg = ctx.Args()[0]
	return nil
}

func (s *CmdPipeOwner) Run() error {
	owner, err := libkb.IsPipeowner(s.G().Log, s.arg)
	if err != nil {
		return err
	}
	dui := s.G().UI.GetDumbOutputUI()
	output, err := json.Marshal(owner)
	dui.Printf("%v\n", string(output[:]))
	if err == nil && !owner.IsOwner {
		err = errors.New("failed to establish pipe ownership")
	}

	return err
}

func (s *CmdPipeOwner) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
