// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package adminprompt

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestShellQuote(t *testing.T) {
	cases := []struct{ in, out string }{
		{"", `''`},
		{"/usr/local/bin", `'/usr/local/bin'`},
		{"/Volumes/Keybase (testuser)", `'/Volumes/Keybase (testuser)'`},
		{"it's", `'it'\''s'`},
		{`say "hi" $HOME`, `'say "hi" $HOME'`},
		{"''", `''\'''\'''`},
	}
	for _, tc := range cases {
		require.Equal(t, tc.out, ShellQuote(tc.in), tc.in)
	}
}

func TestAppleScriptString(t *testing.T) {
	cases := []struct{ in, out string }{
		{"", `""`},
		{"plain", `"plain"`},
		{`a "quoted" word`, `"a \"quoted\" word"`},
		{`back\slash`, `"back\\slash"`},
		{`\"`, `"\\\""`},
	}
	for _, tc := range cases {
		require.Equal(t, tc.out, appleScriptString(tc.in), tc.in)
	}
}

func TestScript(t *testing.T) {
	cmd := "/bin/ln -sfn " + ShellQuote(`/Volumes/Keybase (it's "x" $y\z)`) + " /tmp/l"
	require.Equal(t,
		`do shell script `+appleScriptString(cleanEnvCommand(cmd))+
			` with prompt "Keybase wants \"this\"." with administrator privileges`,
		script(`Keybase wants "this".`, cmd))
}

func TestCleanEnvCommandQuoting(t *testing.T) {
	require.Equal(t,
		`/usr/bin/env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin /bin/sh -c 'umask 022; /bin/rm -f '\''/a b/it'\''\'\'''\''s'\'''`,
		cleanEnvCommand("/bin/rm -f "+ShellQuote("/a b/it's")))
}

func TestIsCanceled(t *testing.T) {
	require.True(t, isCanceled("0:166: execution error: User canceled. (-128)\n"))
	require.False(t, isCanceled("0:166: execution error: ln: /usr/local/bin/keybase: Permission denied (1)\n"))
	require.False(t, isCanceled(""))
}
