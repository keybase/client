// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"encoding/hex"
	"errors"
	"path/filepath"
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
			NewCmdSimpleFSGetStatus(cl, g),
			NewCmdSimpleFSClose(cl, g),
			NewCmdSimpleFSPs(cl, g),
			NewCmdSimpleFSWrite(cl, g),
		},
	}
}

// SimpleFs will be expecting slashes, without the mount name
func makeSimpleFSPath(g *libkb.GlobalContext, path string) keybase1.Path {
	cli, err := GetKBFSMountClient(g)
	var mountDir string
	if err == nil {
		mountDir, _ = cli.GetCurrentMountDir(context.TODO())
	}
	if mountDir == "" {
		mountDir = "/keybase"
	}

	path = filepath.ToSlash(filepath.Clean(path))

	if strings.HasPrefix(path, mountDir) {
		return keybase1.NewPathWithKbfs(path[len(mountDir):])
	}
	return keybase1.NewPathWithLocal(path)
}

func stringToOpID(arg string) (keybase1.OpID, error) {
	var opid keybase1.OpID
	bytes, err := hex.DecodeString(arg)
	if err != nil {
		return keybase1.OpID{}, err
	}
	if copy(opid[:], bytes) != len(opid) {
		return keybase1.OpID{}, errors.New("bad or missing opid")
	}
	return opid, nil
}
