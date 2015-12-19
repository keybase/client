// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !windows

package logger

import (
	"syscall"
)

func (log *Standard) RotateLogFile() error {
	logRotateMutex.Lock()
	defer logRotateMutex.Unlock()
	log.internal.Info("Rotating log file; closing down old file")
	_, file, err := OpenLogFile(log.filename)
	if err != nil {
		return err
	}

	err = PickFirstError(
		syscall.Close(1),
		syscall.Close(2),
		syscall.Dup2(int(file.Fd()), 1),
		syscall.Dup2(int(file.Fd()), 2),
		file.Close(),
	)

	if err != nil {
		log.internal.Warning("Couldn't rotate file: %v", err)
	}
	log.internal.Info("Rotated log file; opening up new file")
	return nil
}
