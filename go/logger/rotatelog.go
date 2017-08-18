// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"errors"
	"time"
)

// RotateLogFile is the old style of logging to a file. It uses a default
// config for log rotation and uses the filename set from .Configure.
func (log *Standard) RotateLogFile() error {
	if log.filename == "" {
		return errors.New("No log filename specified")
	}
	return SetLogFileConfig(&LogFileConfig{
		Path:         log.filename,
		MaxAge:       30 * 24 * time.Hour, // 30 days
		MaxSize:      128 * 1024 * 1024,   // 128mb
		MaxKeepFiles: 3,
	})
}
