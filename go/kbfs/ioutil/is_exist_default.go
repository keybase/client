// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package ioutil

import (
	"os"

	"github.com/pkg/errors"
)

// IsExist wraps os.IsExist to work around
// https://github.com/golang/go/issues/17164 .
func IsExist(err error) bool {
	return os.IsExist(errors.Cause(err))
}
