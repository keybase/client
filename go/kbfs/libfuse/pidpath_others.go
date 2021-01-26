// Copyright 2021 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !darwin

package libfuse

import "github.com/pkg/errors"

var notImplementedErr = errors.New("unimplemented")

func pidPath(pid int) (path string, err error) {
	return "", notImplementedErr
}
