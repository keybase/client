// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import "os"

// This file is a workaround for
// https://github.com/golang/go/issues/17164 .

func isExist(err error) bool {
	return os.IsExist(err)
}
