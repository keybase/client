// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package logger

func (log *Standard) RotateLogFile() error {
	// This seems to mean copying a file descriptor to log.filename
	// on top of stdout and stderr, which is TBI on Windows
	return nil
}
