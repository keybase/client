// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"golang.org/x/net/context"
)

type fakeRoot struct {
	EmptyFolder
}

func openFakeRoot(ctx context.Context, fs *FS, fi *dokan.FileInfo) (dokan.File, dokan.CreateStatus, error) {
	path := fi.Path()
	fs.log.CDebugf(ctx, "openFakeRoot %q", path)
	switch path {
	case `\` + WrongUserErrorFileName:
		return stringReadFile(WrongUserErrorContents), dokan.ExistingFile, nil
	case `\`:
		return &fakeRoot{}, dokan.ExistingDir, nil
	}
	return nil, 0, dokan.ErrAccessDenied
}

// FindFiles for dokan.
func (fr *fakeRoot) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, callback func(*dokan.NamedStat) error) (err error) {
	var ns dokan.NamedStat
	ns.FileAttributes = dokan.FileAttributeNormal | dokan.FileAttributeReadonly
	ns.Name = WrongUserErrorFileName
	ns.FileSize = int64(len(WrongUserErrorContents))
	return callback(&ns)
}
