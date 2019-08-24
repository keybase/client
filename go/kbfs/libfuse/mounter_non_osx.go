// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !darwin,!windows

package libfuse

import "bazil.org/fuse"

func getPlatformSpecificMountOptions(dir string, platformParams PlatformParams) ([]fuse.MountOption, error) {
	options := []fuse.MountOption{}
	options = append(options, fuse.MaxReadahead(500*1024))
	options = append(options, fuse.AsyncRead())
	return options, nil
}

// GetPlatformSpecificMountOptionsForTest makes cross-platform tests work
func GetPlatformSpecificMountOptionsForTest() []fuse.MountOption {
	return []fuse.MountOption{}
}

func translatePlatformSpecificError(err error, platformParams PlatformParams) error {
	return err
}

func (m *mounter) reinstallMountDirIfPossible() {
	// no-op
}
