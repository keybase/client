// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.


package libdokan

import (
	"time"

	"github.com/keybase/kbfs/dokan"
)

// Return dokan.ErrAccessDenied by default as that is a safe default.

type emptyFile struct{}

func (t emptyFile) Cleanup(fi *dokan.FileInfo) {
}
func (t emptyFile) CloseFile(*dokan.FileInfo) {
}
func (t emptyFile) SetEndOfFile(fi *dokan.FileInfo, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) SetAllocationSize(fi *dokan.FileInfo, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) ReadFile(fi *dokan.FileInfo, bs []byte, offset int64) (int, error) {
	return 0, dokan.ErrAccessDenied
}
func (t emptyFile) WriteFile(fi *dokan.FileInfo, bs []byte, offset int64) (int, error) {
	return 0, dokan.ErrAccessDenied
}
func (t emptyFile) FlushFileBuffers(*dokan.FileInfo) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) FindFiles(*dokan.FileInfo, func(*dokan.NamedStat) error) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) SetFileTime(*dokan.FileInfo, time.Time, time.Time, time.Time) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) SetFileAttributes(fi *dokan.FileInfo, fileAttributes uint32) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) LockFile(fi *dokan.FileInfo, offset int64, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) UnlockFile(fi *dokan.FileInfo, offset int64, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) CanDeleteFile(*dokan.FileInfo) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) CanDeleteDirectory(*dokan.FileInfo) error {
	return dokan.ErrAccessDenied
}
