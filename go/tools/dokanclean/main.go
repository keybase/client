// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package main

import (
	"flag"
	"log"
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

func doUninstallAction(uninst string, list bool, log *log.Logger) int {
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
		log.Printf("%s %v\n", command, args)
	} else {
		uninstCmd := exec.Command(command, args...)
		err := uninstCmd.Run()
		if err != nil {
			log.Printf("Error uninstalling %s:  %s\n", uninst, err.Error())
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
	// APPDATA is legacy - remove this after a few releases
	os.Remove(os.ExpandEnv("$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\GUIStartup.lnk"))
	os.Remove(os.ExpandEnv("$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\KeybaseStartup.lnk"))
	os.Remove(os.ExpandEnv("$LOCALAPPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\GUIStartup.lnk"))
	os.Remove(os.ExpandEnv("$LOCALAPPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\KeybaseStartup.lnk"))
}

// Read all the uninstall subkeys and find the ones with DisplayName starting with "Dokan Library".
// If not just listing, execute each uninstaller we find and merge return codes.
// only delete the one matching the product key the keybase installer writes to the registry
func findDokanUninstall(list bool, wow64 bool, log *log.Logger) (result int) {
	var access uint32 = registry.ENUMERATE_SUB_KEYS | registry.QUERY_VALUE | registry.READ
	// Assume this is build 32 bit, so we need this flag to see 64 but registry
	//   https://msdn.microsoft.com/en-us/library/windows/desktop/aa384129(v=vs.110).aspx
	if wow64 {
		access = access | registry.WOW64_64KEY
	}

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", access)
	if err != nil {
		log.Printf("Error opening SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall : %s\n", err.Error())
		return
	}

	kb, err := registry.OpenKey(registry.CURRENT_USER, "SOFTWARE\\Keybase\\Keybase", access)
	if err != nil {
		log.Printf("Error opening SOFTWARE\\Keybase\\Keybase:  %s\n", err.Error())
		return
	}
	defer k.Close()
	defer kb.Close()

	var codes []string
	dokanProductCode86, _, err := kb.GetStringValue("DOKANPRODUCT86")
	if err == nil {
		codes = append(codes, dokanProductCode86)
	}

	dokanProductCode64, _, err := kb.GetStringValue("DOKANPRODUCT64")
	if err == nil {
		codes = append(codes, dokanProductCode64)
	}

	for _, code := range codes {
		subKey, err := registry.OpenKey(k, code, registry.QUERY_VALUE)
		if err != nil {
			// This is not an error; we usually will find only one
			// fmt.Printf("Error %s opening subkey %s\n", err.Error(), code)
			continue
		}

		displayName, _, err := subKey.GetStringValue("DisplayName")
		if list {
			log.Printf("  %s -- %s\n", code, displayName)
		}

		uninstall, _, err := subKey.GetStringValue("QuietUninstallString")
		if err != nil {
			uninstall, _, err = subKey.GetStringValue("UninstallString")
		}
		if err != nil {
			log.Printf("Error opening subkey UninstallString: %s", err.Error())
		} else {
			result = mergeResults(result, doUninstallAction(uninstall, list, log))
		}
	}

	return
}

func main() {
	logger := log.New(os.Stdout, "dokanclean: ", log.Lshortfile)
	listPtr := flag.Bool("l", false, "list only, don't perform uninstall")

	flag.Parse()
	code := findDokanUninstall(*listPtr, false, logger)
	if *listPtr {
		logger.Print(" -- wow64 -- \n")
	}
	code = mergeResults(code, findDokanUninstall(*listPtr, true, logger))
	if !*listPtr {
		removeKeybaseStartupShortcuts()
	}
	os.Exit(code)
}
