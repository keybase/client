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
		Usage: "Print out version and build information",
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "f, format",
				Usage: "Alternate format for version output. Specify 's' for simple (1.2.3) or 'v' for verbose. Default (blank) includes build number (1.2.3-400).",
			},
		},
		Action: func(c *cli.Context) {
			switch c.String("format") {
			case "":
				GlobUI.Println(libkb.VersionString())
			case "s":
				GlobUI.Println(libkb.Version)
			case "v":
				libkb.VersionMessage(func(s string) { GlobUI.Println(s) })
			}
			os.Exit(0)
		},
	}
}
