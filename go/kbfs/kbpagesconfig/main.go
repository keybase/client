// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"os"

	"github.com/urfave/cli"
)

func main() {
	app := cli.NewApp()
	app.Name = "kbpagesconfig"
	app.Usage = "edit or create .kbp_config files for Keybase Pages"
	app.Flags = []cli.Flag{
		cli.StringFlag{
			Name:  "dir, d",
			Value: ".",
			Usage: "path to a dir where .kbp_config is or will be created",
		},
	}
	app.Commands = []cli.Command{
		userCmd,
		aclCmd,
		upgradeCmd,
	}

	_ = app.Run(os.Args)
}
