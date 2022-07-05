// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ioutil

import (
	"os"
	"syscall"

	"github.com/pkg/errors"
)

const error_DIR_NOT_EMPTY = syscall.Errno(145)

// IsExist wraps os.IsExist to work around
// https://github.com/golang/go/issues/17164 .
func IsExist(err error) bool {
	err = errors.Cause(err)
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
	return err == error_DIR_NOT_EMPTY
}
