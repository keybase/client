// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !darwin,!windows

package libfuse

import (
	"github.com/keybase/client/go/kbfs/libkbfs"
)

// NewQuarantineXattrHandler returns a handler that doesn't handle Xattr calls
// on this platform.
func NewQuarantineXattrHandler(libkbfs.Node, *Folder) XattrHandler {
	return NoXattrHandler{}
}
