
package libkbgo

import (
	"github.com/codegangsta/cli"
	"fmt"
)

type PosixCmdLine struct {

}

func (p *PosixCmdLine) Parse(args []string) error {
	ch := make(chan error)
	go p.parse(ch, args)
	err := <- ch
	return err
}

func (p *PosixCmdLine) parse(ch chan error, args []string) {
	app := cli.NewApp()
	app.Name = "keybase"
	app.Usage = "control keybase either with one-off commands, or enable a background daemon"
	app.Flags = []cli.Flag {
		cli.StringFlag {
			Name : "h, home",
			Usage : "specify an (alternate) home directory",
		},
	}
	app.Action = func(c *cli.Context) {
		fmt.Println()
		ch <- nil
	}
	app.Run(args)
}
