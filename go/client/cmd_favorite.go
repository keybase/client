// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"path/filepath"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func NewCmdFavorite(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "favorite",
		ArgumentHelp: "[arguments...]",
		Usage:        "Manage favorites",
		Subcommands: []cli.Command{
			NewCmdFavoriteAdd(cl, g),
			NewCmdFavoriteRemove(cl, g),
			NewCmdFavoriteList(cl, g),
		},
	}
}

// ParseTLF takes keybase paths like
//
//     /keybase/public/patrick,chris
//     /keybase/private/patrick,maxtaco@twitter
//     /keybase/team/bostonredsox
//     public/patrick,jack
//     /public/patrick,chris,sam
//
// and creates suitable folders with the name portion and the
// private flag set correctly.
func ParseTLF(path string) (keybase1.FolderHandle, error) {
	dir, name := filepath.Split(path)

	var f keybase1.FolderHandle

	// get the last element of the directory, which should be public or private
	acc := filepath.Base(dir)
	switch acc {
	case "public":
		f.FolderType = keybase1.FolderType_PUBLIC
	case "private":
		f.FolderType = keybase1.FolderType_PRIVATE
	case "team":
		f.FolderType = keybase1.FolderType_TEAM
	default:
		return f, fmt.Errorf("folder path needs to contain a public, private, or team subdirectory")
	}

	f.Name = name
	return f, nil
}
