// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import (
	"syscall"

	"bazil.org/fuse"
)

var _ fuse.ErrorNumber = NoSuchUserError{""}

// Errno implements the fuse.ErrorNumber interface for
// NoSuchUserError
func (e NoSuchUserError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOENT)
}

var _ fuse.ErrorNumber = DirNotEmptyError{""}

// Errno implements the fuse.ErrorNumber interface for
// DirNotEmptyError
func (e DirNotEmptyError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOTEMPTY)
}

var _ fuse.ErrorNumber = ReadAccessError{}

// Errno implements the fuse.ErrorNumber interface for
// ReadAccessError.
func (e ReadAccessError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = WriteAccessError{}

// Errno implements the fuse.ErrorNumber interface for
// WriteAccessError.
func (e WriteAccessError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = MetadataIsFinalError{}

// Errno implements the fuse.ErrorNumber interface for
// MetadataIsFinalError.
func (e MetadataIsFinalError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = WriteUnsupportedError{}

// Errno implements the fuse.ErrorNumber interface for
// WriteAccessError.
func (e WriteUnsupportedError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOENT)
}

var _ fuse.ErrorNumber = UnsupportedOpInUnlinkedDirError{}

// Errno implements the fuse.ErrorNumber interface for
// UnsupportedOpInUnlinkedDirError.
func (e UnsupportedOpInUnlinkedDirError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOENT)
}

var _ fuse.ErrorNumber = NeedSelfRekeyError{}

// Errno implements the fuse.ErrorNumber interface for
// NeedSelfRekeyError.
func (e NeedSelfRekeyError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = NeedOtherRekeyError{}

// Errno implements the fuse.ErrorNumber interface for
// NeedOtherRekeyError.
func (e NeedOtherRekeyError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = DisallowedPrefixError{}

// Errno implements the fuse.ErrorNumber interface for
// DisallowedPrefixError.
func (e DisallowedPrefixError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EINVAL)
}

var _ fuse.ErrorNumber = FileTooBigError{}

// Errno implements the fuse.ErrorNumber interface for FileTooBigError.
func (e FileTooBigError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EFBIG)
}

var _ fuse.ErrorNumber = NameTooLongError{}

// Errno implements the fuse.ErrorNumber interface for NameTooLongError.
func (e NameTooLongError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENAMETOOLONG)
}

var _ fuse.ErrorNumber = DirTooBigError{}

// Errno implements the fuse.ErrorNumber interface for DirTooBigError.
func (e DirTooBigError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EFBIG)
}

var _ fuse.ErrorNumber = NoCurrentSessionError{}

// Errno implements the fuse.ErrorNumber interface for NoCurrentSessionError.
func (e NoCurrentSessionError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = NoSuchFolderListError{}

// Errno implements the fuse.ErrorNumber interface for
// NoSuchFolderListError
func (e NoSuchFolderListError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOENT)
}

// Errno implements the fuse.ErrorNumber interface for
// RenameAcrossDirsError.
func (e RenameAcrossDirsError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EXDEV)
}
