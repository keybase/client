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
	"syscall"

	"golang.org/x/sys/windows/registry"
)

// Make sure reboot status takes precedence; otherwise favor errors over OK
func mergeResults(current int, next int) int {
	// ERROR_SUCCESS_REBOOT_INITIATED	1641	The installer has initiated a restart. This message is indicative of a success.
	// ERROR_SUCCESS_REBOOT_REQUIRED	3010	A restart is required to complete the install. This message is indicative of a success. This does not include installs where the ForceReboot action is run.
	if current == 1641 || current == 3010 || current > next {
		return current
	}
	return next
}

func doUninstallAction(uninst string, list bool) int {
	retval := 1

	// Parse out the command, which may be inside quotes, and arguments
	// e.g.:
	//    "C:\ProgramData\Package Cache\{d36c41f1-e204-487e-9c4a-29834dddcabe}\DokanSetup.exe" /uninstall /quiet
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

	// If this is an msi package, it probably has no QuietUninstallString
	if strings.HasPrefix(strings.ToLower(command), "msiexec") {
		args = append(args, "/quiet")
	}

	args = append(args, "/norestart")

	if list {
		fmt.Printf("%s %v\n", command, args)
	} else {
		uninstCmd := exec.Command(command, args...)
		err := uninstCmd.Run()
		if err != nil {
			fmt.Printf("Error %s uninstalling %s\n", err.Error(), uninst)
			if e2, ok := err.(*exec.ExitError); ok {
				if s, ok := e2.Sys().(syscall.WaitStatus); ok {
					retval = int(s.ExitCode)
				}
			}
		} else {
			retval = 0
		}
	}
	return retval
}

func removeKeybaseStartupShortcuts() {
	os.Remove(os.ExpandEnv("$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\GUIStartup.lnk"))
	os.Remove(os.ExpandEnv("$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\KeybaseStartup.lnk"))
}

// Read all the uninstall subkeys and find the ones with DisplayName starting with "Dokan Library".
// If not just listing, execute each uninstaller we find and merge return codes.
func findDokanUninstall(list bool, wow64 bool) (result int) {
	var access uint32 = registry.ENUMERATE_SUB_KEYS | registry.QUERY_VALUE
	if wow64 {
		access = access | registry.WOW64_32KEY
	}

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
				result = mergeResults(result, doUninstallAction(uninstall, list))
			}
		}
	}
	return
}

func main() {

	listPtr := flag.Bool("l", false, "list only, don't perform uninstall")

	flag.Parse()

	code := findDokanUninstall(*listPtr, false)
	code = mergeResults(code, findDokanUninstall(*listPtr, true))
	if !*listPtr {
		removeKeybaseStartupShortcuts()
	}
	os.Exit(code)
}
