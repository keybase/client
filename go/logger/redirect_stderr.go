// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import "os"

// RedirectStderrTo points the process's stderr (fd 2) at f. Output written
// directly to fd 2 — most importantly Go runtime panic and fatal error
// tracebacks — lands in f instead of being lost. Returns an error on
// platforms without support (Android).
func RedirectStderrTo(f *os.File) error {
	return tryRedirectStderrTo(f)
}
