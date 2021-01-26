// Copyright 2021 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build darwin

package libfuse

// #include <libproc.h>
// #include <stdlib.h>
// #include <errno.h>
import "C"

import (
	"errors"
	"strconv"
	"unsafe"
)

// pidPath returns the exec path for process pid. Adapted from
// https://ops.tips/blog/macos-pid-absolute-path-and-procfs-exploration/
func pidPath(pid int) (path string, err error) {
	const bufSize = C.PROC_PIDPATHINFO_MAXSIZE
	buf := C.CString(string(make([]byte, bufSize)))
	defer C.free(unsafe.Pointer(buf))

	ret, err := C.proc_pidpath(C.int(pid), unsafe.Pointer(buf), bufSize)
	if err != nil {
		return "", err
	}
	if ret < 0 {
		return "", errors.New(
			"error calling proc_pidpath. exit code: " + strconv.Itoa(int(ret)))
	}
	if ret == 0 {
		return "", errors.New("proc_pidpath returned empty buffer")
	}

	path = C.GoString(buf)
	return
}
