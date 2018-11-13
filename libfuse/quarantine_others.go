// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !darwin

package libfuse

import (
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/libquarantine"
)

// NewQuarantineXattrHandler returns a handler that doesn't handle Xattr calls
// on this platform.
func NewQuarantineXattrHandler(libkbfs.Node, *Folder) XattrHandler {
	return NoXattrHandler{}
}

var newDiskXattrStorage = libquarantine.NewNoopXattrStorage
