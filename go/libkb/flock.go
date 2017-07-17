// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
)

type LockPIDFile struct {
	name string
	file *os.File
}

func NewLockPIDFile(s string) *LockPIDFile {
	return &LockPIDFile{name: s}
}

func (f *LockPIDFile) Close() (err error) {
	if f.file != nil {
		if e1 := f.file.Close(); e1 != nil {
			G.Log.Warning("Error closing pid file: %s\n", e1)
		}
		G.Log.Debug("Cleaning up pidfile %s", f.name)
		if err = os.Remove(f.name); err != nil {
			G.Log.Warning("Error removing pidfile: %s\n", err)
		}
	}
	return
}
