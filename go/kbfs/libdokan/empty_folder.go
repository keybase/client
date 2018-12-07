// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"golang.org/x/net/context"
)

// EmptyFolder represents an empty, read-only KBFS TLF that has not
// been created by someone with sufficient permissions.
type EmptyFolder struct {
	emptyFile
}

func (ef *EmptyFolder) open(ctx context.Context, oc *openContext, path []string) (f dokan.File, cst dokan.CreateStatus, err error) {
	if len(path) != 0 {
		return nil, 0, dokan.ErrObjectNameNotFound
	}
	return oc.returnDirNoCleanup(ef)
}

// GetFileInformation for dokan.
func (*EmptyFolder) GetFileInformation(context.Context, *dokan.FileInfo) (a *dokan.Stat, err error) {
	return defaultDirectoryInformation()
}

// FindFiles for dokan.
func (*EmptyFolder) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, callback func(*dokan.NamedStat) error) (err error) {
	return nil
}
