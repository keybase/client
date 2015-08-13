package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdFavorite(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "favorite",
		Usage:       "keybase favorite [add|delete|list]",
		Description: "Add or delete favorite kbfs folders",
		Subcommands: []cli.Command{
			NewCmdFavoriteAdd(&CmdFavoriteAdd{}, cl),
			NewCmdFavoriteDelete(cl),
			NewCmdFavoriteList(cl),
		},
	}
}
