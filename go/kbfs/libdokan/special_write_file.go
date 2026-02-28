// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"context"

	"github.com/keybase/client/go/kbfs/dokan"
)

type specialWriteFile struct {
	emptyFile
}

func (f *specialWriteFile) GetFileInformation(context.Context, *dokan.FileInfo) (*dokan.Stat, error) {
	return defaultFileInformation()
}
