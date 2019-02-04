// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package sysutils

import (
	"fmt"
	"os"
)

// GetExecPathFromPID returns the process's executable path for given PID.
func GetExecPathFromPID(pid uint32) (string, error) {
	return os.Readlink(fmt.Sprintf("/proc/%d/exe", pid))
}
