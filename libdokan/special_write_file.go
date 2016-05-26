// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"github.com/keybase/kbfs/dokan"
)

type specialWriteFile struct {
	emptyFile
}

func (f *specialWriteFile) GetFileInformation(*dokan.FileInfo) (*dokan.Stat, error) {
	return defaultFileInformation()
}
