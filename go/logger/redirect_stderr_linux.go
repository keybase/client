// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!android

package logger

import (
       "os"
       "syscall"
)

func tryRedirectStderrTo(f *os.File) error {
       return syscall.Dup3(int(f.Fd()), 2, 0)
}
