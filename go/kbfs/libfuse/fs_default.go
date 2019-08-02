// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !darwin,!windows

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

var platformRootDirs []fuse.Dirent

func shouldAppendPlatformRootDirs(parmas PlatformParams) bool { // nolint
	return false
}

func (r *Root) platformLookup(ctx context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (fs.Node, error) {
	return nil, nil
}
