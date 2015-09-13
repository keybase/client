package client

import (
	"fmt"
	"path/filepath"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	keybase1 "github.com/keybase/client/protocol/go"
)

func NewCmdFavorite(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:         "favorite",
		ArgumentHelp: "[arguments...]",
		Usage:        "Manage favorites",
		Subcommands: []cli.Command{
			NewCmdFavoriteAdd(cl),
			NewCmdFavoriteRemove(cl),
			NewCmdFavoriteList(cl),
		},
	}
}

// ParseTLF takes keybase paths like
//
//     /keybase/public/patrick,chris
//     /keybase/private/patrick,maxtaco@twitter
//     public/patrick,jack
//     /public/patrick,chris,sam
//
// and creates suitable folders with the name portion and the
// private flag set correctly.
func ParseTLF(path string) (keybase1.Folder, error) {
	dir, name := filepath.Split(path)

	var f keybase1.Folder

	// get the last element of the directory, which should be public or private
	acc := filepath.Base(dir)
	switch acc {
	case "public":
		f.Private = false
	case "private":
		f.Private = true
	default:
		return f, fmt.Errorf("folder path needs to contain public or private subdirectory")
	}

	f.Name = name
	return f, nil
}
