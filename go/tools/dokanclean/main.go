// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"golang.org/x/sys/windows/registry"
)

func doUninstallAction(uninst string, list bool) bool {
	retval := false

	// Parse out the command, which may be inside quotes, and arguments
	var command string
	if strings.HasPrefix(uninst, "\"") {
		if commandEnd := strings.Index(uninst[1:], "\""); commandEnd != -1 {
			command = uninst[1 : commandEnd+1]
			uninst = strings.TrimSpace(uninst[commandEnd+2:])
		}
	}
	args := strings.Split(uninst, " ")
	if command == "" {
		command = args[0]
		args = args[1:]
	}

	if list {
		fmt.Printf("%s %v\n", command, args)
	} else {
		uninstCmd := exec.Command(command, args...)
		err := uninstCmd.Run()
		if err != nil {
			fmt.Printf("Error %s uninstalling %s\n", err.Error(), uninst)
		} else {
			retval = true
		}
	}
	return retval
}

func findDokanUninstall(list bool, wow64 bool) (result bool) {
	var access uint32 = registry.ENUMERATE_SUB_KEYS | registry.QUERY_VALUE
	if wow64 {
		access = access | registry.WOW64_32KEY
	}
	//    HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{65A3A964-3DC3-0100-0000-160803110110}
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", access)
	if err != nil {
		fmt.Printf("Error %s opening uninstall subkeys\n", err.Error())
		return
	}
	defer k.Close()

	names, err := k.ReadSubKeyNames(-1)
	if err != nil {
		fmt.Printf("Error %s reading subkeys\n", err.Error())
		return
	}
	for _, name := range names {
		subKey, err := registry.OpenKey(k, name, registry.QUERY_VALUE)
		if err != nil {
			fmt.Printf("Error %s opening subkey %s\n", err.Error(), name)
		}

		displayName, _, err := subKey.GetStringValue("DisplayName")
		if err == nil && strings.HasPrefix(displayName, "Dokan Library") {
			fmt.Printf("Found %s  %s\n", displayName, name)
			uninstall, _, err := subKey.GetStringValue("QuietUninstallString")
			if err != nil {
				uninstall, _, err = subKey.GetStringValue("UninstallString")
			}
			if err != nil {
				fmt.Printf("Error %s opening subkey UninstallString", err.Error())
			} else {
				result = result || doUninstallAction(uninstall, list)
			}
		}
	}
	return
}

func main() {

	listPtr := flag.Bool("l", false, "list only, don't perform uninstall")

	flag.Parse()

	code := 0
	if findDokanUninstall(*listPtr, false) || findDokanUninstall(*listPtr, true) {
		code = 1
	}

	os.Exit(code)
}
