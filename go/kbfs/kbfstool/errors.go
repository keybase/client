// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package main

import (
	"errors"
	"fmt"
)

var errExactlyOnePath = errors.New("exactly one path must be specified")
var errAtLeastOnePath = errors.New("at least one path must be specified")

type cannotWriteErr struct {
	pathStr string
	err     error
}

func (e cannotWriteErr) Error() string {
	if e.err != nil {
		return fmt.Sprintf("cannot write to %s: %v", e.pathStr, e.err)
	}
	return fmt.Sprintf("cannot write to %s", e.pathStr)
}
