// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

// VolIconFileName is the name of the special icon file in macOS for
// the mount.
const VolIconFileName = ".VolumeIcon.icns"

// ExtendedAttributeSelfFileName is the name of an extended attribute
// file (on macOS) for the current (.) directory.
// This is used to tell the root mount to look for a volume icon file.
const ExtendedAttributeSelfFileName = "._."
