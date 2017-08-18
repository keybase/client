// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package logger

// These had a weird unicode character which made it look messy on Windows

const (
	fancyFormat   = "%{color}%{time:2006-01-02T15:04:05.000000Z07:00} - [%{level:.4s} %{module} %{shortfile}] %{id:03x}%{color:reset} %{message}"
	plainFormat   = "[%{level:.4s}] %{id:03x} %{message}"
	fileFormat    = "%{time:2006-01-02T15:04:05.000000Z07:00} - [%{level:.4s} %{module} %{shortfile}] %{id:03x} %{message}"
	defaultFormat = "%{color}- %{level} %{message}%{color:reset}"
)
