// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/urfave/cli"
)

var aclClearCmd = cli.Command{
	Name:      "clear",
	Usage:     "clear the ACL for the given path(s)",
	UsageText: "clear <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintln(os.Stderr, "need at least 1 arg")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, p := range c.Args() {
			editor.clearACL(p)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclRemoveCmd = cli.Command{
	Name:      "remove",
	Usage:     "remove a user from the ACL(s) of the given path(s)",
	UsageText: "remove <username> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, p := range c.Args()[1:] {
			editor.removeUserFromACL(c.Args()[0], p)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclGetCmd = cli.Command{
	Name:      "get",
	Usage:     "get permissions for a user on the given path(s)",
	UsageText: "get <username> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		writer := tabwriter.NewWriter(os.Stdout, 0, 4, 1, '\t', 0)
		fmt.Fprintln(writer, "read\tlist\tpath")
		for _, p := range c.Args()[1:] {
			read, list, err := editor.getUserOnPath(c.Args()[0], p)
			if err != nil {
				fmt.Fprintf(os.Stderr, "getting permissions for "+
					"%q on %q error: %v\n", c.Args()[0], p, err)
				os.Exit(1)
			}
			fmt.Fprintf(writer, "%t\t%t\t%s\n", read, list, p)
		}
		if err := writer.Flush(); err != nil {
			fmt.Fprintf(os.Stderr, "flushing tabwriter error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclSetDefaultCmd = cli.Command{
	Name: "default",
	Usage: "set default permission(s) that all users are granted, " +
		"for the given path(s)",
	UsageText: "default <read|list|read,list> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, p := range c.Args()[1:] {
			err := editor.setAnonymousPermission(c.Args()[0], p)
			if err != nil {
				fmt.Fprintf(os.Stderr,
					"setting anonymous permission %q on %q error: %v\n",
					c.Args()[0], p, err)
				os.Exit(1)
			}
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclSetAdditionalCmd = cli.Command{
	Name: "additional",
	Usage: "set additional permission(s) that <username> are granted on " +
		"top of default ones on the given path(s) ",
	UsageText: "additional <username> <read|list|read,list> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 3 {
			fmt.Fprintln(os.Stderr, "need at least 3 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v\n", err)
			os.Exit(1)
		}
		for _, p := range c.Args()[2:] {
			err := editor.setAdditionalPermission(c.Args()[0], c.Args()[1], p)
			if err != nil {
				fmt.Fprintf(os.Stderr,
					"setting additional permission(s) %q for username "+
						"%q on %q error: %v\n",
					c.Args()[1], c.Args()[0], p, err)
				os.Exit(1)
			}
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclSetCmd = cli.Command{
	Name:      "set",
	Usage:     "set default or additional permissions on path(s)",
	UsageText: "set <default|additional> [args]",
	Subcommands: []cli.Command{
		aclSetDefaultCmd,
		aclSetAdditionalCmd,
	},
}

var aclCmd = cli.Command{
	Name:      "acl",
	Usage:     "make changes to the 'acls' section of the config",
	UsageText: "acl <set|clear|remove|get> [args]",
	Subcommands: []cli.Command{
		aclSetCmd,
		aclClearCmd,
		aclRemoveCmd,
		aclGetCmd,
	},
}
