// Copyright 2016 Keybase, Inc. All rights reserved. Use of
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
	if log.maxSize <= 0 {
		return errors.New("No max log file size specified")
	}
	return SetLogFileConfig(&LogFileConfig{
		Path:         log.filename,
		MaxAge:       30 * 24 * time.Hour, // 30 days
		MaxSize:      log.maxSize,         // 128mb
		MaxKeepFiles: 3,
	})
}
