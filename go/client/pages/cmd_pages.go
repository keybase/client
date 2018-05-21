// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package pages

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdPages makes the `keybase pages` sub command.
func NewCmdPages(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "pages",
		// TODO: Uncomment this when we have docs updated.
		// Usage:        "Keybase Pages related operations",
		ArgumentHelp: "pages config [args]",
		Subcommands: []cli.Command{
			cli.Command{
				Name:  "config",
				Usage: "edit or create .kbp_config files for Keybase Pages",
				Flags: []cli.Flag{
					cli.StringFlag{
						Name:  "dir, d",
						Value: ".",
						Usage: "path to a dir where .kbp_config is or will be created",
					},
				},

				ArgumentHelp: "config <acl|upgrade|user> [args]",
				Subcommands: []cli.Command{
					userCmd, aclCmd, upgradeCmd,
				},
			},
		},
	}
}
