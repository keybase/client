// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/keybase/client/go/install"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func NewCmdKbfsMount(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "kbfsmount",
		Usage: "kbfsmount [get|set|getall|status|install]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdKbfsMount{libkb.NewContextified(g), "", ""}, "kbfsmount", c)
		},
	}
}

type CmdKbfsMount struct {
	libkb.Contextified
	cmd string
	arg string
}

func (s *CmdKbfsMount) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return fmt.Errorf("kbfsmount needs one of [get|set|getall|status|install]")
	}
	s.cmd = ctx.Args()[0]
	if s.cmd == "set" {
		if len(ctx.Args()) < 2 {
			return errors.New("set needs an argument")
		}
		s.arg = ctx.Args()[1]
	}
	return nil
}

func (s *CmdKbfsMount) Run() error {
	cli, err := GetKBFSMountClient(s.G())
	dui := s.G().UI.GetDumbOutputUI()
	if err != nil {
		return err
	}
	switch s.cmd {
	case "get":
		result, err2 := cli.GetCurrentMountDir(context.TODO())
		dui.Printf("%s", result)
		err = err2
	case "set":
		err = cli.SetCurrentMountDir(context.TODO(), s.arg)
	case "getall":
		results, err2 := cli.GetAllAvailableMountDirs(context.TODO())
		dui.Printf("%v", results)
		err = err2
	case "status":
		status := install.KeybaseFuseStatus("", s.G().Log)
		out, err := json.MarshalIndent(status, "", "  ")
		if err != nil {
			return err
		}
		dui.Printf("%s\n", out)
	case "install":
		result := install.Install(s.G(), "", "", []string{install.ComponentNameFuse.String()}, false, 0, s.G().Log)
		dui.Printf("%v\n", result.Status)
	}
	return err
}

func (s *CmdKbfsMount) GetUsage() libkb.Usage {
	return libkb.Usage{}
}
