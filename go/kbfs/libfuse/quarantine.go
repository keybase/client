// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// XattrHandler is an interface that includes fuse Get/Set/Remove calls for
// xattr.
type XattrHandler interface {
	fs.NodeGetxattrer
	fs.NodeSetxattrer
	fs.NodeRemovexattrer
}

// NoXattrHandler is a Xattr handler that always returns fuse.ENOTSUP.
type NoXattrHandler struct{}

var _ XattrHandler = NoXattrHandler{}

// Getxattr implements the fs.NodeGetxattrer interface.
func (h NoXattrHandler) Getxattr(context.Context,
	*fuse.GetxattrRequest, *fuse.GetxattrResponse) error {
	return fuse.ENOTSUP
}

// Setxattr implements the fs.NodeSetxattrer interface.
func (h NoXattrHandler) Setxattr(context.Context, *fuse.SetxattrRequest) error {
	return fuse.ENOTSUP
}

// Removexattr implements the fs.NodeRemovexattrer interface.
func (h NoXattrHandler) Removexattr(context.Context, *fuse.RemovexattrRequest) error {
	return fuse.ENOTSUP
}
