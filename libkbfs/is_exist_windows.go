// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"syscall"
)

// This file is a workaround for
// https://github.com/golang/go/issues/17164 .

const _ERROR_DIR_NOT_EMPTY = syscall.Errno(145)

func isExist(err error) bool {
	if os.IsExist(err) {
		return true
	}
	switch pe := err.(type) {
	case nil:
		return false
	case *os.PathError:
		err = pe.Err
	case *os.LinkError:
		err = pe.Err
	case *os.SyscallError:
		err = pe.Err
	}
	return err == _ERROR_DIR_NOT_EMPTY
}
