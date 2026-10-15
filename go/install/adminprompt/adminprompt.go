// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Package adminprompt runs a shell command as root after the user approves
// the standard macOS administrator prompt.
package adminprompt

import (
	"errors"
	"strings"
)

// ErrCanceled is returned when the user cancels the prompt.
var ErrCanceled = errors.New("administrator prompt canceled")

// ShellQuote quotes s as a single POSIX shell word.
func ShellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// appleScriptString returns s as an AppleScript string literal.
func appleScriptString(s string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
}

// rootPath is the only environment variable shellCmd runs with.
const rootPath = "PATH=/usr/bin:/bin:/usr/sbin:/sbin"

// cleanEnvCommand runs shellCmd with /bin/sh, an environment holding only
// rootPath and umask 022, whatever the environment and umask of the shell
// that runs it.
func cleanEnvCommand(shellCmd string) string {
	return "/usr/bin/env -i " + rootPath + " /bin/sh -c " + ShellQuote("umask 022; "+shellCmd)
}

// script returns the AppleScript that runs shellCmd as root.
func script(prompt, shellCmd string) string {
	return "do shell script " + appleScriptString(cleanEnvCommand(shellCmd)) +
		" with prompt " + appleScriptString(prompt) +
		" with administrator privileges"
}

// isCanceled reports whether osascript failed because the user canceled.
func isCanceled(output string) bool {
	return strings.Contains(output, "(-128)")
}
