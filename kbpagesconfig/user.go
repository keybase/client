package main

import (
	"fmt"
	"os"

	"github.com/keybase/cli"
)

var userAddCmd = cli.Command{
	Name:         "add",
	Usage:        "add new user(s) to config",
	ArgumentHelp: "add <username> [username ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintf(os.Stderr, "empty username\n")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
			os.Exit(1)
		}
		for _, username := range c.Args() {
			if err := editor.addUser(username); err != nil {
				fmt.Fprintf(os.Stderr, "adding user error: %v\n", err)
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
	Name:         "remove",
	Usage:        "remove user(s) from config",
	ArgumentHelp: "remove <username> [username ...]",
	Action: func(c *cli.Context) {
		if len(c.Args()) < 1 {
			fmt.Fprintf(os.Stderr, "empty username\n")
			os.Exit(1)
		}
		editor, err := newKBPConfigEditor(c.GlobalString("dir"))
		if err != nil {
			fmt.Fprintf(os.Stderr,
				"creating config editor error: %v", err)
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
	Name:         "user",
	Usage:        "make changes to 'users' section of the config",
	ArgumentHelp: "user <add|remove> <args>",
	Subcommands: []cli.Command{
		userAddCmd,
		userRemoveCmd,
	},
}
