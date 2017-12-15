// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

// Asset describes a downloadable file
type Asset struct {
	Name      string `json:"name"`
	URL       string `json:"url"`
	Digest    string `json:"digest"`
	Signature string `json:"signature"`
	LocalPath string `json:"localPath"`
}

// UpdateType is the update type.
// This is an int type for compatibility.
type UpdateType int

const (
	// UpdateTypeNormal is a normal update
	UpdateTypeNormal UpdateType = 0
	// UpdateTypeBugFix is a bugfix update
	UpdateTypeBugFix UpdateType = 1
	// UpdateTypeCritical is a critical update
	UpdateTypeCritical UpdateType = 2
)

// Property is a generic key value pair for custom properties
type Property struct {
	Name  string `codec:"name" json:"name"`
	Value string `codec:"value" json:"value"`
}

// Update defines an update to apply
type Update struct {
	Version     string     `json:"version"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	InstallID   string     `json:"installId"`
	RequestID   string     `json:"requestId"`
	Type        UpdateType `json:"type"`
	PublishedAt int64      `json:"publishedAt"`
	Props       []Property `codec:"props" json:"props,omitempty"`
	Asset       *Asset     `json:"asset,omitempty"`
	NeedUpdate  bool       `json:"needUpdate"`
}

// UpdateOptions are options used to find an update
type UpdateOptions struct {
	// Version is the current version of the app
	Version string `json:"version"`
	// Platform is the os type (darwin, windows, linux)
	Platform string `json:"platform"`
	// DestinationPath is where to apply the update to
	DestinationPath string `json:"destinationPath"`
	// URL can override where the updater looks
	URL string `json:"URL"`
	// Channel is an alternative channel to get updates from (test, prerelease)
	Channel string `json:"channel"`
	// Env is an environment or run mode (prod, staging, devel)
	Env string `json:"env"`
	// Arch is an architecure description (x64, i386, arm)
	Arch string `json:"arch"`
	// Force is whether to apply the update, even if older or same version
	Force bool `json:"force"`
	// OSVersion is the version of the OS
	OSVersion string `json:"osVersion"`
	// UpdaterVersion is the version of the updater service
	UpdaterVersion string `json:"updaterVersion"`
}

// UpdateAction is the update action requested by the user
type UpdateAction string

const (
	// UpdateActionApply means the user accepted and to perform update
	UpdateActionApply UpdateAction = "apply"
	// UpdateActionAuto means that auto update is set and to perform update
	UpdateActionAuto UpdateAction = "auto"
	// UpdateActionSnooze snoozes an update
	UpdateActionSnooze UpdateAction = "snooze"
	// UpdateActionCancel cancels an update
	UpdateActionCancel UpdateAction = "cancel"
	// UpdateActionError means an error occurred
	UpdateActionError UpdateAction = "error"
	// UpdateActionContinue means no update action was available and the update should continue
	UpdateActionContinue UpdateAction = "continue"
)

// String is a unique string label for the action
func (u UpdateAction) String() string {
	return string(u)
}

// UpdatePromptOptions are the options for UpdatePrompt
type UpdatePromptOptions struct {
	AutoUpdate bool   `json:"autoUpdate"`
	OutPath    string `json:"outPath"` // Used for windows instead of stdout
}

// UpdatePromptResponse is the result for UpdatePrompt
type UpdatePromptResponse struct {
	Action     UpdateAction `json:"action"`
	AutoUpdate bool         `json:"autoUpdate"`
}

// UpdateUI is a UI interface
type UpdateUI interface {
	// UpdatePrompt prompts for an update
	UpdatePrompt(Update, UpdateOptions, UpdatePromptOptions) (*UpdatePromptResponse, error)
}
