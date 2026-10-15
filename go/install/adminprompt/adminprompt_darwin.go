// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package adminprompt

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// Run shows the administrator prompt and, once approved, runs shellCmd as
// root with /bin/sh and an environment holding only a fixed PATH. It returns
// the command's output.
func Run(ctx context.Context, prompt string, shellCmd string) (string, error) {
	out, err := osascriptCommand(ctx, prompt, shellCmd).CombinedOutput()
	output := string(out)
	switch {
	case err == nil:
		return output, nil
	case ctx.Err() != nil:
		return output, fmt.Errorf("administrator prompt: %w", ctx.Err())
	case isCanceled(output):
		return output, ErrCanceled
	default:
		return output, fmt.Errorf("administrator prompt failed: %w: %s", err, strings.TrimSpace(output))
	}
}

// osascriptCommand runs osascript, and so the shell it starts as root, with
// an environment holding only rootPath.
func osascriptCommand(ctx context.Context, prompt string, shellCmd string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, "/usr/bin/osascript", "-e", script(prompt, shellCmd)) //nolint:gosec // G204: fixed binary; the script is built from quoted arguments
	cmd.Env = []string{rootPath}
	return cmd
}
