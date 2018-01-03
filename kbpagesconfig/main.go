// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"os"

	"github.com/keybase/cli"
)

func main() {
	app := cli.NewApp()
	app.Name = "kbpagesconfig"
	app.Usage = "edit .kbp_config files for Keybase Pages"
	app.Flags = []cli.Flag{
		cli.StringFlag{
			Name:  "path, p",
			Value: ".kbp_config",
			Usage: "path to config file",
		},
	}
	app.Commands = []cli.Command{
		userCmd,
		aclCmd,
	}

	app.Run(os.Args)
}
