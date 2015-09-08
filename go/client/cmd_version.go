package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdVersion(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "version",
		Usage:       "keybase version",
		Description: "Print out version and build information.",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "Show extra info.",
			},
			cli.BoolFlag{
				Name:  "d, devel",
				Usage: "Show build info (for development releases).",
			},
		},
		Action: func(c *cli.Context) {
			devel := c.Bool("devel")
			verbose := c.Bool("verbose")
			if verbose {
				libkb.VersionMessage(devel, func(s string) { GlobUI.Println(s) })
			} else {
				GlobUI.Println(libkb.VersionString(devel))
			}
			os.Exit(0)
		},
	}
}
