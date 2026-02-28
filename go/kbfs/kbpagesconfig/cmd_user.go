// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"fmt"
	"os"

	"github.com/urfave/cli"
)

var userAddCmd = cli.Command{
	Name:      "add",
	Usage:     "add new user(s) to config",
	UsageText: "add <username> [username ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintln(os.Stderr, "empty username")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, username := range c.Args() {
			if err := editor.setUser(username, true); err != nil {
				fmt.Fprintf(os.Stderr,
					"adding user (%s) error: %v\n", username, err)
				os.Exit(1)
			}
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var userChangeCmd = cli.Command{
	Name:      "change",
	Usage:     "change password(s) for user(s) in the config",
	UsageText: "change <username> [username ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintln(os.Stderr, "empty username")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, username := range c.Args() {
			if err := editor.setUser(username, false); err != nil {
				fmt.Fprintf(os.Stderr,
					"change user (%s) password error: %v\n", username, err)
				os.Exit(1)
			}
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var userRemoveCmd = cli.Command{
	Name:      "remove",
	Usage:     "remove user(s) from config",
	UsageText: "remove <username> [username ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintln(os.Stderr, "empty username")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, username := range c.Args() {
			editor.removeUser(username)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var userCmd = cli.Command{
	Name:      "user",
	Usage:     "make changes to 'users' section of the config",
	UsageText: "user <add|remove> <args>",
	Subcommands: []cli.Command{
		userAddCmd,
		userChangeCmd,
		userRemoveCmd,
	},
}
