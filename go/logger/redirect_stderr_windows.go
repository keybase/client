// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"os"
	"syscall"
)

// yes, it is 32 bits...
const stderrHandle = int32(-12)

func tryRedirectStderrTo(f *os.File) (err error) {
	var handle = stderrHandle
	res, _, e1 := syscall.Syscall(procSetStdHandle.Addr(), 2, uintptr(handle), f.Fd(), 0)
	if res != 0 {
		err = error(e1)
	}
	return
}

var (
	procSetStdHandle = kernel32DLL.NewProc("SetStdHandle")
)
