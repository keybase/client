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

var perPathClearCmd = cli.Command{
	Name:      "clear",
	Usage:     "clear the PerPathConfig for the given path(s)",
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
			editor.clearPerPathConfig(p)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var perPathUnsetUserPermissionsCmd = cli.Command{
	Name: "unset-user",
	Usage: "remove a user from the PerPathConfig(s) additional " +
		"permissions of the given path(s). This essentially reverts the " +
		"user's effective permission back to anonymous.",
	UsageText: "unset-user <username> <path> [path ...]",
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
			editor.removeUserPermissionsFromPerPathConfig(c.Args()[0], p)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var perPathGetPermissionCmd = cli.Command{
	Name:      "get-permission",
	Usage:     "get permissions for a user on the given path(s)",
	UsageText: "get-permission <username> <path> [path ...]",
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
			read, list, err := editor.getUserPermissionsOnPath(c.Args()[0], p)
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

var perPathSetPermissionDefaultCmd = cli.Command{
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

var perPathSetPermissionAdditionalCmd = cli.Command{
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

var perPathSetPermissionCmd = cli.Command{
	Name:      "set-permission",
	Usage:     "set default or additional permissions on path(s)",
	UsageText: "set-permission <default|additional> [args]",
	Subcommands: []cli.Command{
		perPathSetPermissionDefaultCmd,
		perPathSetPermissionAdditionalCmd,
	},
}

// This isn't supported by kbpagesd at this time.
const customPagesEnabled = false

func getPerPathSetCmdUsageText() string {
	customPage := ""
	if customPagesEnabled {
		customPage = "\n   set <403|404> <path_relative_to_site_root> <path> [path ...]"
	}
	return "set Access-Control-Allow-Origin <''|'*'> <path> [path ...]" + customPage
}

var perPathSetCmd = cli.Command{
	Name:      "set",
	Usage:     "configure a parameter on path(s)",
	UsageText: getPerPathSetCmdUsageText(),
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
		switch {
		case c.Args()[0] == "Access-Control-Allow-Origin":
			for _, p := range c.Args()[2:] {
				err := editor.setAccessControlAllowOrigin(p, c.Args()[1])
				if err != nil {
					fmt.Fprintf(os.Stderr,
						"setting Access-Control-Allow-Origin %q on %q error: %v\n",
						c.Args()[1], p, err)
					os.Exit(1)
				}
			}
		case customPagesEnabled && c.Args()[0] == "403":
			for _, p := range c.Args()[2:] {
				err := editor.set403(p, c.Args()[1])
				if err != nil {
					fmt.Fprintf(os.Stderr,
						"setting custom 403 page %q on %q error: %v\n",
						c.Args()[1], p, err)
					os.Exit(1)
				}
			}
		case customPagesEnabled && c.Args()[0] == "404":
			for _, p := range c.Args()[2:] {
				err := editor.set404(p, c.Args()[1])
				if err != nil {
					fmt.Fprintf(os.Stderr,
						"setting custom 404 page %q on %q error: %v\n",
						c.Args()[1], p, err)
					os.Exit(1)
				}
			}
		default:
			fmt.Fprintf(os.Stderr, "unknown parameter: %s\n", c.Args()[0])
			os.Exit(1)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var perPathCmd = cli.Command{
	Name:      "per-path",
	Usage:     "make changes to the 'per_path_configs' section of the config",
	UsageText: "per-path <set|clear|remove|get> [args]",
	Subcommands: []cli.Command{
		perPathSetPermissionCmd,
		perPathClearCmd,
		perPathUnsetUserPermissionsCmd,
		perPathGetPermissionCmd,
		perPathSetCmd,
	},
}
