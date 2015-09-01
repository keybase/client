package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdVersion(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "version",
		Usage: "print out version information",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "show extra info",
			},
			cli.BoolFlag{
				Name:  "d, devel",
				Usage: "show build info (for development releases)",
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
