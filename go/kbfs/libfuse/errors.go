// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"syscall"

	"github.com/pkg/errors"

	"bazil.org/fuse"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

type errorWithErrno struct {
	error
	errno syscall.Errno
}

var _ fuse.ErrorNumber = errorWithErrno{}

func (e errorWithErrno) Errno() fuse.Errno {
	return fuse.Errno(e.errno)
}

func filterError(err error) error {
	switch errors.Cause(err).(type) {
	case kbfsblock.ServerErrorUnauthorized:
		return errorWithErrno{err, syscall.EACCES}

	case kbfsmd.ServerErrorUnauthorized:
		return errorWithErrno{err, syscall.EACCES}
	case kbfsmd.ServerErrorWriteAccess:
		return errorWithErrno{err, syscall.EACCES}
	case kbfsmd.MetadataIsFinalError:
		return errorWithErrno{err, syscall.EACCES}

	case libkbfs.NoSuchUserError:
		return errorWithErrno{err, syscall.ENOENT}
	case libkbfs.NoSuchTeamError:
		return errorWithErrno{err, syscall.ENOENT}
	case libkbfs.DirNotEmptyError:
		return errorWithErrno{err, syscall.ENOTEMPTY}
	case libkbfs.ReadAccessError:
		return errorWithErrno{err, syscall.EACCES}
	case libkbfs.WriteAccessError:
		return errorWithErrno{err, syscall.EACCES}
	case libkbfs.WriteUnsupportedError:
		return errorWithErrno{err, syscall.ENOENT}
	case libkbfs.WriteToReadonlyNodeError:
		return errorWithErrno{err, syscall.EACCES}
	case libkbfs.UnsupportedOpInUnlinkedDirError:
		return errorWithErrno{err, syscall.ENOENT}
	case libkbfs.NeedSelfRekeyError:
		return errorWithErrno{err, syscall.EACCES}
	case libkbfs.NeedOtherRekeyError:
		return errorWithErrno{err, syscall.EACCES}
	case libkbfs.DisallowedPrefixError:
		return errorWithErrno{err, syscall.EINVAL}
	case libkbfs.NameTooLongError:
		return errorWithErrno{err, syscall.ENAMETOOLONG}
	case libkbfs.NoCurrentSessionError:
		return errorWithErrno{err, syscall.EACCES}
	case libkbfs.NoSuchFolderListError:
		return errorWithErrno{err, syscall.ENOENT}
	case libkbfs.RenameAcrossDirsError:
		return errorWithErrno{err, syscall.EXDEV}
	case *libkbfs.ErrDiskLimitTimeout:
		return errorWithErrno{err, syscall.ENOSPC}
	case libkbfs.RevGarbageCollectedError:
		return errorWithErrno{err, syscall.ENOENT}
	}
	return err
}
