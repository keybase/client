// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"github.com/keybase/kbfs/dokan"
)

// Alias is a top-level folder accessed through its non-canonical name.
type Alias struct {
	// canonical name for this folder
	canon string
	emptyFile
}

// GetFileInformation for dokan.
func (s *Alias) GetFileInformation(*dokan.FileInfo) (a *dokan.Stat, err error) {
	return defaultSymlinkDirInformation()
}
