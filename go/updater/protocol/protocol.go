// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package protocol

import (
	"time"

	"golang.org/x/net/context"
)

type Field struct {
	Key   string `codec:"key" json:"key"`
	Value string `codec:"value" json:"value"`
}

type Status struct {
	Code   int     `codec:"code" json:"code"`
	Name   string  `codec:"name" json:"name"`
	Desc   string  `codec:"desc" json:"desc"`
	Fields []Field `codec:"fields" json:"fields"`
}

type Asset struct {
	Name      string `codec:"name" json:"name"`
	Url       string `codec:"url" json:"url"`
	Digest    string `codec:"digest" json:"digest"`
	Signature string `codec:"signature" json:"signature"`
	LocalPath string `codec:"localPath" json:"localPath"`
}

type UpdateType int

const (
	UpdateType_NORMAL   UpdateType = 0
	UpdateType_BUGFIX   UpdateType = 1
	UpdateType_CRITICAL UpdateType = 2
)

type Update struct {
	Version      string     `codec:"version" json:"version"`
	Name         string     `codec:"name" json:"name"`
	Description  string     `codec:"description" json:"description"`
	Instructions *string    `codec:"instructions,omitempty" json:"instructions,omitempty"`
	Type         UpdateType `codec:"type" json:"type"`
	PublishedAt  *Time      `codec:"publishedAt,omitempty" json:"publishedAt,omitempty"`
	Asset        *Asset     `codec:"asset,omitempty" json:"asset,omitempty"`
}

type UpdateOptions struct {
	Version             string `codec:"version" json:"version"`
	Platform            string `codec:"platform" json:"platform"`
	DestinationPath     string `codec:"destinationPath" json:"destinationPath"`
	Source              string `codec:"source" json:"source"`
	URL                 string `codec:"URL" json:"URL"`
	Channel             string `codec:"channel" json:"channel"`
	Force               bool   `codec:"force" json:"force"`
	DefaultInstructions string `codec:"defaultInstructions" json:"defaultInstructions"`
	SignaturePath       string `codec:"signaturePath" json:"signaturePath"`
}

type UpdateResult struct {
	Update *Update `codec:"update,omitempty" json:"update,omitempty"`
}

type UpdateArg struct {
	Options UpdateOptions `codec:"options" json:"options"`
}

type UpdateCheckArg struct {
	Force bool `codec:"force" json:"force"`
}

type UpdateInterface interface {
	Update(context.Context, UpdateOptions) (UpdateResult, error)
	UpdateCheck(context.Context, bool) error
}

type UpdateAction int

const (
	UpdateAction_UPDATE UpdateAction = 0
	UpdateAction_SKIP   UpdateAction = 1
	UpdateAction_SNOOZE UpdateAction = 2
	UpdateAction_CANCEL UpdateAction = 3
)

type UpdatePromptRes struct {
	Action            UpdateAction `codec:"action" json:"action"`
	AlwaysAutoInstall bool         `codec:"alwaysAutoInstall" json:"alwaysAutoInstall"`
	SnoozeUntil       Time         `codec:"snoozeUntil" json:"snoozeUntil"`
}

type UpdatePromptOptions struct {
	AlwaysAutoInstall bool `codec:"alwaysAutoInstall" json:"alwaysAutoInstall"`
}

type UpdateAppInUseAction int

const (
	UpdateAppInUseAction_CANCEL         UpdateAppInUseAction = 0
	UpdateAppInUseAction_FORCE          UpdateAppInUseAction = 1
	UpdateAppInUseAction_SNOOZE         UpdateAppInUseAction = 2
	UpdateAppInUseAction_KILL_PROCESSES UpdateAppInUseAction = 3
)

type UpdateAppInUseRes struct {
	Action UpdateAppInUseAction `codec:"action" json:"action"`
}

type UpdateQuitRes struct {
	Quit            bool   `codec:"quit" json:"quit"`
	Pid             int    `codec:"pid" json:"pid"`
	ApplicationPath string `codec:"applicationPath" json:"applicationPath"`
}

type UpdatePromptArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Update    Update              `codec:"update" json:"update"`
	Options   UpdatePromptOptions `codec:"options" json:"options"`
}

type UpdateAppInUseArg struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Update    Update    `codec:"update" json:"update"`
	Processes []Process `codec:"processes" json:"processes"`
}

type UpdateQuitArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Update    Update `codec:"update" json:"update"`
	Status    Status `codec:"status" json:"status"`
}

type UpdateUiInterface interface {
	UpdatePrompt(context.Context, UpdatePromptArg) (UpdatePromptRes, error)
	UpdateAppInUse(context.Context, UpdateAppInUseArg) (UpdateAppInUseRes, error)
	UpdateQuit(context.Context, UpdateQuitArg) (UpdateQuitRes, error)
}

type FileType int

const (
	FileType_UNKNOWN   FileType = 0
	FileType_DIRECTORY FileType = 1
	FileType_FILE      FileType = 2
)

type FileDescriptor struct {
	Name string   `codec:"name" json:"name"`
	Type FileType `codec:"type" json:"type"`
}

type Process struct {
	Pid             string           `codec:"pid" json:"pid"`
	Command         string           `codec:"command" json:"command"`
	FileDescriptors []FileDescriptor `codec:"fileDescriptors" json:"fileDescriptors"`
}

type Time int64

func FromTime(t Time) time.Time {
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(0, int64(t)*1000000)
}

func ToTime(t time.Time) Time {
	// the result of calling UnixNano on the zero Time is undefined.
	// https://golang.org/pkg/time/#Time.UnixNano
	if t.IsZero() {
		return 0
	}
	return Time(t.UnixNano() / 1000000)
}

type Error struct {
	code    int
	message string
}

func (e *Error) Status() Status {
	return Status{Code: e.code, Name: "ERROR", Desc: e.message}
}

func FromError(err error) *Error {
	return &Error{code: 1, message: err.Error()}
}

func StatusOK(desc string) Status {
	if desc == "" {
		desc = "OK"
	}
	return Status{Code: 0, Name: "OK", Desc: desc}
}
