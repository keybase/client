// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// NewCmdDevice creates the device command, which is just a holder
// for subcommands.
func NewCmdSimpleFS(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "simplefs",
		Usage:        "Perform filesystem operations",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdSimpleFSList(cl, g),
			NewCmdSimpleFSCopy(cl, g),
			NewCmdSimpleFSMove(cl, g),
			NewCmdSimpleFSRead(cl, g),
			NewCmdSimpleFSRemove(cl, g),
			NewCmdSimpleFSMkdir(cl, g),
			NewCmdSimpleFSStat(cl, g),
			NewCmdSimpleFSCheck(cl, g),
			NewCmdSimpleFSClose(cl, g),
			NewCmdSimpleFSPs(cl, g),
			NewCmdSimpleFSWrite(cl, g),
		},
	}
}

func MakeSimpleFSPath(g *libkb.GlobalContext, path string) keybase1.Path {
	cli, err := GetKBFSMountClient(g)
	var mountDir string
	if err == nil {
		mountDir, _ = cli.GetCurrentMountDir(context.TODO())
	}

	path = filepath.Clean(path)

	if mountDir != "" && strings.HasPrefix(path, mountDir) {
		return keybase1.NewPathWithKbfs(path)
	}
	if matched, err := regexp.MatchString("[\\/]keybase[\\/](public)|(private).+", path); matched && err == nil {
		return keybase1.NewPathWithKbfs(path)
	}
	return keybase1.NewPathWithLocal(path)
}
