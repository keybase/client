// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// userCmd represents the user command
var userCmd = &cobra.Command{
	Use:   "user <add|remove> <args>",
	Short: "make changes to 'users' section of the config",
}

var userAddCmd = &cobra.Command{
	Use:   "add <username> [username ...]",
	Short: "add new user(s) to config",

	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 1 {
			fmt.Fprintf(os.Stderr, "empty username\n")
			os.Exit(1)
		}
		for _, username := range args {
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

var userRemoveCmd = &cobra.Command{
	Use:   "remove <username> [username ...]",
	Short: "remove user(s) from config",

	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 1 {
			fmt.Fprintf(os.Stderr, "empty username\n")
			os.Exit(1)
		}
		for _, username := range args {
			editor.removeUser(username)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	userCmd.AddCommand(userAddCmd)
	userCmd.AddCommand(userRemoveCmd)

	rootCmd.AddCommand(userCmd)
}
