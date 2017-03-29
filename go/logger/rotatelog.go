// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"errors"
)

// RotateLogFile rotates log files.
func (log *Standard) RotateLogFile() error {
	globalLock.Lock()
	defer globalLock.Unlock()

	var w = currentLogFileWriter
	if w == nil {
		return errors.New("Cannot rotate a when no current log file writer")
	}

	return w.Reset()
}
