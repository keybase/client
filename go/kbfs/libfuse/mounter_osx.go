// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
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
	"github.com/keybase/client/go/install/libnativeinstaller"
	"github.com/keybase/client/go/logger"
)

var kbfusePath = fuse.OSXFUSEPaths{
	DevicePrefix: "/dev/kbfuse",
	Load:         "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse",
	Mount:        "/Library/Filesystems/kbfuse.fs/Contents/Resources/mount_kbfuse",
	DaemonVar:    "_FUSE_DAEMON_PATH",
}

func getPlatformSpecificMountOptions(dir string, platformParams PlatformParams) ([]fuse.MountOption, error) {
	options := []fuse.MountOption{}

	var locationOption fuse.MountOption
	if platformParams.UseSystemFuse {
		// Only allow osxfuse 3.x.
		locationOption = fuse.OSXFUSELocations(fuse.OSXFUSELocationV3)
	} else {
		// Only allow kbfuse.
		locationOption = fuse.OSXFUSELocations(kbfusePath)
	}
	options = append(options, locationOption)

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
	// For now, test with either kbfuse or OSXFUSE for now.
	// TODO: Consider mandate testing with kbfuse?
	return []fuse.MountOption{
		fuse.OSXFUSELocations(kbfusePath, fuse.OSXFUSELocationV3),
		fuse.ExclCreate(),

		// We are diabling the 'local' mount option in tests for now since it
		// causes out tests to leave a bunch of entries behind in Finder's sidebar.
		// TODO: fix this.
		// fuse.LocalVolume(),
	}
}

func translatePlatformSpecificError(err error, platformParams PlatformParams) error {
	if err == fuse.ErrOSXFUSENotFound {
		if platformParams.UseSystemFuse {
			return errors.New(
				"cannot locate OSXFUSE 3.x")
		}
		return errors.New(
			"cannot locate kbfuse; either install the Keybase " +
				"app, or install OSXFUSE 3.x " +
				"and pass in --use-system-fuse")
	}
	return err
}

func (m *mounter) reinstallMountDirIfPossible() {
	err := libnativeinstaller.UninstallMountDir(m.runMode, m.log)
	m.log.Debug("UninstallMountDir: err=%v", err)
	err = libnativeinstaller.InstallMountDir(m.runMode, m.log)
	m.log.Debug("InstallMountDir: err=%v", err)
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
	newCtx context.Context, maybeUnmounting bool, cancel context.CancelFunc) {
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
