// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build !ios && !android

package status

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"time"

	ps "github.com/keybase/go-ps"
)

func keybaseProcessList() string {
	var ret strings.Builder
	osinfo, err := getOSInfo()
	if err == nil {
		ret.WriteString(osinfo + "\n\n")
	} else {
		ret.WriteString(fmt.Sprintf("could not get OS info for platform %s: %s\n\n", runtime.GOOS, err))
	}

	processes, err := pgrep(keybaseProcessRegexp)
	if err != nil {
		return fmt.Sprintf("error getting processes: %s", err)
	}
	for _, process := range processes {
		path, err := process.Path()
		if err != nil {
			path = "unable to get process path"
		}
		ret.WriteString(fmt.Sprintf("%s (%+v)\n", path, process))
	}
	return ret.String()
}

func getOSInfo() (string, error) {
	switch runtime.GOOS {
	case "linux":
		osinfo, err := os.ReadFile("/etc/os-release")
		return string(osinfo), err
	case "darwin": // no ios
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		osinfo, err := exec.CommandContext(ctx, "/usr/bin/sw_vers").CombinedOutput()
		return string(osinfo), err
	case "windows":
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		osinfo, err := exec.CommandContext(ctx, "cmd", "/c", "ver").CombinedOutput()
		return string(osinfo), err
	default:
		return "", fmt.Errorf("no OS info for platform %s", runtime.GOOS)
	}
}

var keybaseProcessRegexp = regexp.MustCompile(`(?i:kbfs|keybase|upd.exe)`)

func pgrep(matcher *regexp.Regexp) ([]ps.Process, error) {
	processes, err := ps.Processes()
	if err != nil {
		return nil, err
	}
	var filteredProcesses []ps.Process
	for _, process := range processes {
		if matcher.MatchString(process.Executable()) {
			filteredProcesses = append(filteredProcesses, process)
		}
	}
	return filteredProcesses, nil
}
