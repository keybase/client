// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package adminprompt

import (
	"context"
	"os/exec"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCleanEnvCommand(t *testing.T) {
	inner := `echo "${KB_ADMINPROMPT_TEST-unset}|${HOME-unset}|$PATH|$(umask)|it's"`
	cmd := exec.Command("/bin/sh", "-c", "umask 000; "+cleanEnvCommand(inner)) //nolint:gosec // G204: the command is a constant
	cmd.Env = []string{"KB_ADMINPROMPT_TEST=set", "HOME=/nowhere", "PATH=/nowhere"}
	out, err := cmd.CombinedOutput()
	require.NoError(t, err, string(out))
	require.Equal(t, "unset|unset|/usr/bin:/bin:/usr/sbin:/sbin|0022|it's\n", string(out))
}

func TestOsascriptCommand(t *testing.T) {
	cmd := osascriptCommand(context.Background(), "prompt", "/usr/bin/true")
	require.Equal(t, []string{"PATH=/usr/bin:/bin:/usr/sbin:/sbin"}, cmd.Env)
	require.Equal(t, "/usr/bin/osascript", cmd.Path)
}
