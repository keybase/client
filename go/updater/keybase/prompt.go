// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/command"
	"github.com/keybase/client/go/updater/util"
)

type updaterPromptInput struct {
	Title       string `json:"title"`
	Message     string `json:"message"`
	Description string `json:"description"`
	AutoUpdate  bool   `json:"autoUpdate"`
	OutPath     string `json:"outPath"` // Used for windows instead of stdout
}

type updaterPromptInputResult struct {
	Action         string `json:"action"`
	AutoUpdate     bool   `json:"autoUpdate"`
	SnoozeDuration int    `json:"snooze_duration"`
}

func (c context) promptInput(update updater.Update, options updater.UpdateOptions, promptOptions updater.UpdatePromptOptions) (string, error) {
	description := update.Description
	if description == "" {
		description = "Please visit https://keybase.io for more information."
	}
	promptJSONInput, err := json.Marshal(updaterPromptInput{
		// Note we use util.Semver to shorten to the Major.Minor.Patch format
		// because of spacing restrictions of 700 characters on macOS and
		// better readability.
		Title:       fmt.Sprintf("Keybase Update: Version %s", util.Semver(update.Version)),
		Message:     fmt.Sprintf("The version you are currently running (%s) is outdated.", util.Semver(options.Version)),
		Description: description,
		AutoUpdate:  promptOptions.AutoUpdate,
		OutPath:     promptOptions.OutPath,
	})
	return string(promptJSONInput), err
}

func (c context) updatePrompt(promptProgram command.Program, update updater.Update, options updater.UpdateOptions, promptOptions updater.UpdatePromptOptions, timeout time.Duration) (*updater.UpdatePromptResponse, error) {

	promptJSONInput, err := c.promptInput(update, options, promptOptions)
	if err != nil {
		return nil, fmt.Errorf("Error generating input: %s", err)
	}

	var result updaterPromptInputResult
	if err := command.ExecForJSON(promptProgram.Path, promptProgram.ArgsWith([]string{promptJSONInput}), &result, timeout, c.log); err != nil {
		return nil, fmt.Errorf("Error running command: %s", err)
	}
	return c.responseForResult(result)
}

func (c context) responseForResult(result updaterPromptInputResult) (*updater.UpdatePromptResponse, error) {
	autoUpdate := false

	var updateAction updater.UpdateAction
	switch result.Action {
	case "apply":
		updateAction = updater.UpdateActionApply
		autoUpdate = result.AutoUpdate
	case "snooze":
		updateAction = updater.UpdateActionSnooze
	default:
		updateAction = updater.UpdateActionCancel
	}

	return &updater.UpdatePromptResponse{
		Action:         updateAction,
		AutoUpdate:     autoUpdate,
		SnoozeDuration: result.SnoozeDuration,
	}, nil
}

type promptInput struct {
	Type    string   `json:"type"`
	Title   string   `json:"title"`
	Message string   `json:"message"`
	Buttons []string `json:"buttons"`
}

type promptInputResult struct {
	Button string `json:"button"`
}

// pausedPrompt returns whether to cancel update and/or error.
// If the user explicit wants to cancel the update, this may be different from
// an error occurring, in which case
func (c context) pausedPrompt(promptProgram command.Program, timeout time.Duration) (bool, error) {
	const btnForce = "Force update"
	const btnCancel = "Try again later"
	promptJSONInput, err := json.Marshal(promptInput{
		Type:    "generic",
		Title:   "Update Paused",
		Message: "You have files, folders or a terminal open in Keybase.\n\nYou can force the update. That would be like yanking a USB drive and plugging it right back in. It'll instantly give you the latest version of Keybase, but you'll need to reopen any files you're working with. If you're working in the terminal, you'll need to cd out of /keybase and back in.",
		Buttons: []string{btnForce, btnCancel},
	})
	if err != nil {
		return false, fmt.Errorf("Error generating input: %s", err)
	}

	var result promptInputResult
	if err := command.ExecForJSON(promptProgram.Path, promptProgram.ArgsWith([]string{string(promptJSONInput)}), &result, timeout, c.log); err != nil {
		return false, fmt.Errorf("Error running command: %s", err)
	}

	switch result.Button {
	case btnForce:
		return false, nil
	case btnCancel:
		// Cancel update
		return true, nil
	default:
		return false, fmt.Errorf("Unexpected button result: %s", result.Button)
	}
}
