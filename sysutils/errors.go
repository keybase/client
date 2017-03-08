// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package sysutils

// NotImplementedError is returned on platforms where GetExecPathFromPID is not
// implemented.
type NotImplementedError struct{}

func (NotImplementedError) Error() string {
	return "not implemented"
}
