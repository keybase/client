// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build windows
// +build windows

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/kardianos/osext"
	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/go-logging"
)

// Copied here since it is not exported from go-updater/keybase
type updaterPromptInput struct {
	Title       string `json:"title"`
	Message     string `json:"message"`
	Description string `json:"description"`
	AutoUpdate  bool   `json:"autoUpdate"`
	OutPath     string `json:"outPath"` // Used for windows instead of stdout
}

func main() {
	var testLog = &logging.Logger{Module: "test"}

	exePathName, _ := osext.Executable()
	pathName, _ := filepath.Split(exePathName)
	outPathName := filepath.Join(pathName, "out.txt")

	promptJSONInput, err := json.Marshal(updaterPromptInput{
		Title:       "Keybase Update: Version Foobar",
		Message:     "The version you are currently running (0.0) is outdated.",
		Description: "Recent changes:\n\n---------------\n\n- Introducing the main GUI screen - this is where you'll look people up, manage your folders, and perform other actions. A lot of the features are stubbed out, but you can start playing with it.\n\n- Sharing before signup - go ahead and put data in /keybase/private/you,friend@twitter/ . If you have any invite codes, this will pop up a window with a link to DM them. It also works for end-to-end encryption with Reddit, Coinbase, Github, and Hacker News users.\n\nWhat we are currently working on:\n\n---------------------------------\n\n- KBFS performance, including delayed writes\n\n",
		AutoUpdate:  true,
		OutPath:     outPathName,
	})
	if err != nil {
		testLog.Errorf("Error generating input: %s", err)
		return
	}

	path := filepath.Join(pathName, "WpfApplication1\\bin\\Release\\prompter.exe")

	testLog.Debugf("Executing: %s %s", path, string(string(promptJSONInput)))

	_, err = command.Exec(path, []string{string(promptJSONInput)}, 100*time.Second, testLog)
	if err != nil {
		testLog.Errorf("Error: %v", err)
		return
	}

	result, err := os.ReadFile(outPathName)
	if err != nil {
		testLog.Errorf("Error opening result file: %v", err)
		return
	}

	testLog.Debugf("Result: %s", string(result))
}
