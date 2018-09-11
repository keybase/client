// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
)

type LockPIDFile struct {
	Contextified
	name string
	file *os.File
}

func NewLockPIDFile(g *GlobalContext, s string) *LockPIDFile {
	return &LockPIDFile{Contextified: NewContextified(g), name: s}
}

func (f *LockPIDFile) Close() (err error) {
	if f.file != nil {
		if e1 := f.file.Close(); e1 != nil {
			f.G().Log.Warning("Error closing pid file: %s\n", e1)
		}
		f.G().Log.Debug("Cleaning up pidfile %s", f.name)
		if err = os.Remove(f.name); err != nil {
			f.G().Log.Warning("Error removing pidfile: %s\n", err)
		}
	}
	return
}
