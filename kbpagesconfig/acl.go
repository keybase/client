package main

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/keybase/cli"
)

var aclSetAnonymousCmd = cli.Command{
	Name:         "set-anonymous",
	Usage:        "set anonymous permission(s) for the given path(s)",
	ArgumentHelp: "set-anonymous <read|list|read,list> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.String("path"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
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

var aclClearCmd = cli.Command{
	Name:         "clear",
	Usage:        "clear the ACL for the given path(s)",
	ArgumentHelp: "clear <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintln(os.Stderr, "need at least 1 arg")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.String("path"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
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

var aclSetAdditionalCmd = cli.Command{
	Name: "set-additional",
	Usage: "set permission(s) <username> is granted on the " +
		"given path(s) in addition to anonymous ones",
	ArgumentHelp: "set-additional <username> <read|list|read,list> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 3 {
			fmt.Fprintln(os.Stderr, "need at least 3 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.String("path"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
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

var aclRemoveCmd = cli.Command{
	Name:         "remove",
	Usage:        "remove a user from the ACL(s) of the given path(s)",
	ArgumentHelp: "remove <username> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.String("path"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
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

var aclCheckCmd = cli.Command{
	Name:         "check",
	Usage:        "get permissions for a user on the given path(s)",
	ArgumentHelp: "check <username> <path> [path ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.String("path"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
			os.Exit(1)
		}
		writer := tabwriter.NewWriter(os.Stdout, 4, 2, 0, ' ', 0)
		fmt.Fprintln(writer, "read\tlist\tpath")
		for _, p := range c.Args()[1:] {
			read, list, err := editor.checkUserOnPath(c.Args()[0], p)
			if err != nil {
				fmt.Fprintf(os.Stderr, "getting permissions for "+
					"%q on %q error: %v\n", c.Args()[0], p, err)
				os.Exit(1)
			}
			fmt.Fprintf(writer, "%t\t%t\t%q\n", read, list, p)
		}
		if err := writer.Flush(); err != nil {
			fmt.Fprintf(os.Stderr, "flushing tabwriter error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclCmd = cli.Command{
	Name:         "acl",
	Usage:        "make changes to the 'acls' section of the config",
	ArgumentHelp: "acl <set-anonymous|clear|grant|remove|check>",
	Subcommands: []cli.Command{
		aclSetAnonymousCmd,
		aclClearCmd,
		aclSetAdditionalCmd,
		aclRemoveCmd,
		aclCheckCmd,
	},
}
