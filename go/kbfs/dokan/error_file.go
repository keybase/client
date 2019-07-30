// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/client/go/kbfs/dokan/winacl"
)

type errorFile struct { // nolint
	fs FileSystem
}

func (ef *errorFile) print(method string, fi *FileInfo) error {
	ef.fs.ErrorPrint(fmt.Errorf("INVALID FILE: %s %q", method, fi.Path()))
	return ErrAccessDenied
}

func (ef *errorFile) ReadFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	return 0, ef.print("ReadFile", fi)
}
func (ef *errorFile) WriteFile(ctx context.Context, fi *FileInfo, bs []byte, offset int64) (int, error) {
	return 0, ef.print("WriteFile", fi)
}
func (ef *errorFile) FlushFileBuffers(ctx context.Context, fi *FileInfo) error {
	return ef.print("FlushFileBuffers", fi)
}
func (ef *errorFile) GetFileInformation(ctx context.Context, fi *FileInfo) (*Stat, error) {
	return nil, ef.print("GetFileInformation", fi)
}
func (ef *errorFile) FindFiles(ctx context.Context, fi *FileInfo, pattern string, fillStatCallback func(*NamedStat) error) error {
	return ef.print("FindFiles", fi)
}
func (ef *errorFile) SetFileTime(ctx context.Context, fi *FileInfo, creation time.Time, lastAccess time.Time, lastWrite time.Time) error {
	return ef.print("SetFileTime", fi)
}
func (ef *errorFile) SetFileAttributes(ctx context.Context, fi *FileInfo, fileAttributes FileAttribute) error {
	return ef.print("SetFileAttributes", fi)
}
func (ef *errorFile) SetEndOfFile(ctx context.Context, fi *FileInfo, length int64) error {
	return ef.print("SetEndOfFile", fi)
}
func (ef *errorFile) SetAllocationSize(ctx context.Context, fi *FileInfo, length int64) error {
	return ef.print("SetAllocationSize", fi)
}
func (ef *errorFile) LockFile(ctx context.Context, fi *FileInfo, offset int64, length int64) error {
	return ef.print("LockFile", fi)
}
func (ef *errorFile) UnlockFile(ctx context.Context, fi *FileInfo, offset int64, length int64) error {
	return ef.print("UnlockFile", fi)
}
func (ef *errorFile) GetFileSecurity(ctx context.Context, fi *FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error {
	return ef.print("GetFileSecurity", fi)
}
func (ef *errorFile) SetFileSecurity(ctx context.Context, fi *FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error {
	return ef.print("SetFileSecurity", fi)
}
func (ef *errorFile) CanDeleteFile(ctx context.Context, fi *FileInfo) error {
	return ef.print("CanDeleteFile", fi)
}
func (ef *errorFile) CanDeleteDirectory(ctx context.Context, fi *FileInfo) error {
	return ef.print("CanDeleteDirectory", fi)
}
func (ef *errorFile) Cleanup(ctx context.Context, fi *FileInfo) {
	ef.print("Cleanup", fi)
}
func (ef *errorFile) CloseFile(ctx context.Context, fi *FileInfo) {
	ef.print("CloseFile", fi)
}
