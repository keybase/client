// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"path"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdSimpleFSSyncEnable is the 'fs sync enable' command.
type CmdSimpleFSSyncEnable struct {
	libkb.Contextified
	path keybase1.Path
}

// NewCmdSimpleFSSyncEnable creates a new cli.Command.
func NewCmdSimpleFSSyncEnable(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "enable",
		ArgumentHelp: "[path-to-sync]",
		Usage:        "syncs the given folder to local storage, for offline access",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSyncEnable{
				Contextified: libkb.NewContextified(g)}, "enable", c)
			cl.SetNoStandalone()
		},
	}
}

const minNumKeybasePathElems = 4

func splitKeybasePath(p keybase1.Path) []string {
	toSplit := p.String()
	// Just in case the path isn't absolute.
	if !strings.HasPrefix(toSplit, "/") {
		toSplit = "/" + toSplit
	}
	return strings.SplitN(toSplit, "/", minNumKeybasePathElems)
}

func toTlfPath(p keybase1.Path) (keybase1.Path, error) {
	split := splitKeybasePath(p)
	if len(split) < minNumKeybasePathElems {
		return p, nil
	}
	return makeSimpleFSPath(
		path.Join(append([]string{mountDir}, split[0:3]...)...))
}

func pathMinusTlf(p keybase1.Path) string {
	split := splitKeybasePath(p)
	if len(split) < minNumKeybasePathElems {
		return ""
	}
	return split[3]
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSyncEnable) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()
	arg := keybase1.SimpleFSSetFolderSyncConfigArg{
		Config: keybase1.FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		},
		Path: c.path,
	}

	subpath := pathMinusTlf(c.path)
	if subpath != "" {
		arg.Path, err = toTlfPath(c.path)
		if err != nil {
			return err
		}
		res, err := cli.SimpleFSFolderSyncConfigAndStatus(ctx, arg.Path)
		if err != nil {
			return err
		}

		if res.Config.Mode == keybase1.FolderSyncMode_ENABLED {
			return fmt.Errorf("Must disable full syncing on %s first", arg.Path)
		}

		for _, p := range res.Config.Paths {
			if p == subpath {
				// Already enabled.
				return nil
			}
		}

		arg.Config.Mode = keybase1.FolderSyncMode_PARTIAL
		arg.Config.Paths = append(res.Config.Paths, subpath)
	}

	return cli.SimpleFSSetFolderSyncConfig(ctx, arg)
}

// ParseArgv gets the required path.
func (c *CmdSimpleFSSyncEnable) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	p, err := makeSimpleFSPath(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.path = p
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSyncEnable) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
