// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"runtime/pprof"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libfs"
	"golang.org/x/net/context"
)

// TODO: Also have a file for CPU profiles.

// ProfileList is a node that can list all of the available profiles.
type ProfileList struct {
	fs *FS
	emptyFile
}

// GetFileInformation for dokan.
func (ProfileList) GetFileInformation(ctx context.Context, fi *dokan.FileInfo) (st *dokan.Stat, err error) {
	return defaultDirectoryInformation()
}

// open tries to open a file.
func (pl ProfileList) open(ctx context.Context, oc *openContext, path []string) (dokan.File, dokan.CreateStatus, error) {
	if len(path) == 0 {
		return oc.returnDirNoCleanup(ProfileList{})
	}
	if len(path) > 1 || !libfs.IsSupportedProfileName(path[0]) {
		return nil, 0, dokan.ErrObjectNameNotFound
	}
	f := libfs.ProfileGet(path[0])
	if f == nil {
		return nil, 0, dokan.ErrObjectNameNotFound
	}
	return oc.returnFileNoCleanup(&SpecialReadFile{read: f, fs: pl.fs})
}

// FindFiles does readdir for dokan.
func (ProfileList) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, callback func(*dokan.NamedStat) error) (err error) {
	profiles := pprof.Profiles()
	var ns dokan.NamedStat
	ns.FileAttributes = dokan.FileAttributeReadonly
	for _, p := range profiles {
		ns.Name = p.Name()
		if !libfs.IsSupportedProfileName(ns.Name) {
			continue
		}
		err := callback(&ns)
		if err != nil {
			return err
		}
	}
	return nil
}
