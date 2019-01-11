// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"time"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/dokan/winacl"
	"golang.org/x/net/context"
)

// Return dokan.ErrAccessDenied by default as that is a safe default.

type emptyFile struct{}

func (t emptyFile) Cleanup(ctx context.Context, fi *dokan.FileInfo) {
}
func (t emptyFile) CloseFile(ctx context.Context, fi *dokan.FileInfo) {
}
func (t emptyFile) SetEndOfFile(ctx context.Context, fi *dokan.FileInfo, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) SetAllocationSize(ctx context.Context, fi *dokan.FileInfo, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) ReadFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (int, error) {
	return 0, dokan.ErrAccessDenied
}
func (t emptyFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (int, error) {
	return 0, dokan.ErrAccessDenied
}
func (t emptyFile) FlushFileBuffers(ctx context.Context, fi *dokan.FileInfo) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) FindFiles(ctx context.Context, fi *dokan.FileInfo, ignored string, cb func(*dokan.NamedStat) error) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) SetFileTime(context.Context, *dokan.FileInfo, time.Time, time.Time, time.Time) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) SetFileAttributes(ctx context.Context, fi *dokan.FileInfo, fileAttributes dokan.FileAttribute) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) LockFile(ctx context.Context, fi *dokan.FileInfo, offset int64, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) UnlockFile(ctx context.Context, fi *dokan.FileInfo, offset int64, length int64) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) CanDeleteFile(ctx context.Context, fi *dokan.FileInfo) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) CanDeleteDirectory(ctx context.Context, fi *dokan.FileInfo) error {
	return dokan.ErrAccessDenied
}
func (t emptyFile) GetFileSecurity(ctx context.Context, fi *dokan.FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error {
	if si&winacl.OwnerSecurityInformation != 0 && currentUserSID != nil {
		sd.SetOwner(currentUserSID)
	}
	if si&winacl.GroupSecurityInformation != 0 && currentGroupSID != nil {
		sd.SetGroup(currentGroupSID)
	}
	if si&winacl.DACLSecurityInformation != 0 {
		var acl winacl.ACL
		acl.AddAllowAccess(0x001F01FF, currentUserSID)
		sd.SetDacl(&acl)
	}
	return nil
}
func (t emptyFile) SetFileSecurity(ctx context.Context, fi *dokan.FileInfo, si winacl.SecurityInformation, sd *winacl.SecurityDescriptor) error {
	return dokan.ErrAccessDenied
}
