// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

// aclCmd represents the acl command
var aclCmd = &cobra.Command{
	Use:   "acl <set-anonymous|clear|grant|remove|check>",
	Short: "make changes to the 'acls' section of the config",
}

var aclSetAnonymousCmd = &cobra.Command{
	Use:   "set-anonymous <read|list|read,list> <path> [path ...]",
	Short: "set anonymous permission(s) for the given path(s)",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		for _, p := range args[1:] {
			err := editor.setAnonymousPermission(args[0], p)
			if err != nil {
				fmt.Fprintf(os.Stderr,
					"setting anonymous permission %q on %q error: %v\n",
					args[0], p, err)
				os.Exit(1)
			}
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclClearCmd = &cobra.Command{
	Use:   "clear <path> [path ...]",
	Short: "clear the ACL for the given path(s)",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 1 {
			fmt.Fprintln(os.Stderr, "need at least 1 arg")
			os.Exit(1)
		}
		for _, p := range args {
			editor.clearACL(p)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclSetAdditionalCmd = &cobra.Command{
	Use: "set-additional <username> <read|list|read,list> <path> [path ...]",
	Short: "set permission(s) <username> is granted on the " +
		"given path(s) in addition to anonymous ones",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 3 {
			fmt.Fprintln(os.Stderr, "need at least 3 args")
			os.Exit(1)
		}
		for _, p := range args[2:] {
			err := editor.setAdditionalPermission(args[0], args[1], p)
			if err != nil {
				fmt.Fprintf(os.Stderr,
					"setting additional permission(s) %q for username "+
						"%q on %q error: %v\n",
					args[1], args[0], p, err)
				os.Exit(1)
			}
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclRemoveCmd = &cobra.Command{
	Use:   "remove <username> <path> [path ...]",
	Short: "remove a user from the ACL(s) of the given path(s)",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		for _, p := range args[1:] {
			editor.removeUserFromACL(args[0], p)
		}
		if err := editor.confirmAndWrite(); err != nil {
			fmt.Fprintf(os.Stderr, "writing new config error: %v\n", err)
			os.Exit(1)
		}
	},
}

var aclCheckCmd = &cobra.Command{
	Use:   "check <username> <path> [path ...]",
	Short: "get permissions for a user on the given path(s)",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "need at least 2 args")
			os.Exit(1)
		}
		writer := tabwriter.NewWriter(os.Stdout, 4, 2, 0, ' ', 0)
		fmt.Fprintln(writer, "read\tlist\tpath")
		for _, p := range args[1:] {
			read, list, err := editor.checkUserOnPath(args[0], p)
			if err != nil {
				fmt.Fprintf(os.Stderr, "getting permissions for "+
					"%q on %q error: %v\n", args[0], p, err)
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

func init() {
	aclCmd.AddCommand(aclSetAnonymousCmd)
	aclCmd.AddCommand(aclClearCmd)
	aclCmd.AddCommand(aclSetAdditionalCmd)
	aclCmd.AddCommand(aclRemoveCmd)
	aclCmd.AddCommand(aclCheckCmd)

	rootCmd.AddCommand(aclCmd)
}
