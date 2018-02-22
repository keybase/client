// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "path/filepath"

// The number of trace files to keep around and to bundle with sent
// logs.
const MaxTraceFileCount = 5

// Return all trace files in the given directory.
func GetTraceFiles(dir string) ([]string, error) {
	pattern := filepath.Join(dir, "trace.*.out")
	return filepath.Glob(pattern)
}
