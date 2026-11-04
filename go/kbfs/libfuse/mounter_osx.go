// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build darwin
// +build darwin

package libfuse

// #include <libproc.h>
// #include <stdlib.h>
// #include <errno.h>
import "C"

import (
	"context"
	"errors"
	"strconv"
	"time"
	"unsafe"

	"bazil.org/fuse"
	"github.com/keybase/client/go/logger"
)

func getPlatformSpecificMountOptions(dir string, platformParams PlatformParams) ([]fuse.MountOption, error) {
	options := []fuse.MountOption{fuse.OSXFUSELocations(fuse.OSXFUSELocationV4)}

	// Volume name option is only used on OSX (ignored on other platforms).
	volName, err := volumeName(dir)
	if err != nil {
		return nil, err
	}

	options = append(options, fuse.VolumeName(volName))
	options = append(options, fuse.ExclCreate())

	if platformParams.UseLocal {
		options = append(options, fuse.LocalVolume())
	}

	return options, nil
}

// GetPlatformSpecificMountOptionsForTest makes cross-platform tests work
func GetPlatformSpecificMountOptionsForTest() []fuse.MountOption {
	return []fuse.MountOption{
		fuse.OSXFUSELocations(fuse.OSXFUSELocationV4),
		fuse.ExclCreate(),

		// We are diabling the 'local' mount option in tests for now since it
		// causes out tests to leave a bunch of entries behind in Finder's sidebar.
		// TODO: fix this.
		// fuse.LocalVolume(),
	}
}

func translatePlatformSpecificError(err error) error {
	if errors.Is(err, fuse.ErrOSXFUSENotFound) {
		return errors.New(
			"cannot locate macFUSE; install macFUSE 5 or later from https://macfuse.io")
	}
	return err
}

const unmountCallTolerance = time.Second

var unmountingExecPaths = map[string]bool{
	"/usr/sbin/diskutil": true,
	"/usr/libexec/lsd":   true,
	"/sbin/umount":       true,
}

var noop = func() {}

// pidPath returns the exec path for process pid. Adapted from
// https://ops.tips/blog/macos-pid-absolute-path-and-procfs-exploration/
func pidPath(pid int) (path string, err error) {
	const bufSize = C.PROC_PIDPATHINFO_MAXSIZE
	buf := C.CString(string(make([]byte, bufSize)))
	defer C.free(unsafe.Pointer(buf))

	ret, err := C.proc_pidpath(C.int(pid), unsafe.Pointer(buf), bufSize)
	if err != nil {
		return "", err
	}
	if ret < 0 {
		return "", errors.New(
			"error calling proc_pidpath. exit code: " + strconv.Itoa(int(ret)))
	}
	if ret == 0 {
		return "", errors.New("proc_pidpath returned empty buffer")
	}

	path = C.GoString(buf)
	return
}

// wrapCtxWithShorterTimeoutForUnmount wraps ctx witha a timeout of
// unmountCallTolerance if pid is /usr/sbin/diskutil, /usr/libexec/lsd, or
// /sbin/umount. This is useful for calls that usually happen during unmounting
// such as Statfs and Fsync. If we block on those calls, `diskutil umount force
// <mnt>` is blocked as well. So make them timeout after 2s to make unmounting
// work.
func wrapCtxWithShorterTimeoutForUnmount(ctx context.Context,
	log logger.Logger, pid int) (
	newCtx context.Context, maybeUnmounting bool, cancel context.CancelFunc,
) {
	p, err := pidPath(pid)
	if err != nil {
		return ctx, false, noop
	}
	if unmountingExecPaths[p] {
		log.CDebugf(ctx, "wrapping context with timeout for %s", p)
		newCtx, cancel = context.WithTimeout(ctx, unmountCallTolerance)
		return newCtx, true, cancel
	}
	return ctx, false, noop
}
