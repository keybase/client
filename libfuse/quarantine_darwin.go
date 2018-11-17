// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"fmt"
	"strconv"
	"time"

	"bazil.org/fuse"
	"github.com/keybase/kbfs/libkbfs"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"golang.org/x/net/context"
)

const quarantineXattrName = "com.apple.quarantine"

// There are much more than this, but a call using Apple's library to set
// kLSQuarantineTypeOtherDownload produces this flag.
const _kLSQuarantineTypeOtherDownload = "0081;"

const quarantineAgentName = ";Keybase;"

func makeQuarantine(timestamp time.Time) []byte {
	// Omit the identifier in the end. Example:
	// []byte("0081;5bdb56a3;Keybase;")
	return append(
		strconv.AppendInt(
			[]byte(_kLSQuarantineTypeOtherDownload), timestamp.Unix(), 16),
		quarantineAgentName...)
}

// QuarantineXattrHandler implements bazil.org/fuse/fs.NodeGetxattrer,
// bazil.org/fuse/fs.NodeSetxattrer, and bazil.org/fuse/fs.NodeRemovexattrer,
// that only handles a single xattr quarantineXattrName (com.apple.quarantine).
// For all other requests, we return fuse.ENOTSUP which causes the OS to handle
// it by creating and interacting with ._ files.
type QuarantineXattrHandler struct {
	node   libkbfs.Node
	folder *Folder
}

// NewQuarantineXattrHandler returns a handler that handles
// com.apple.quarantine, but returns fuse.ENOTSUP for all other xattrs.
func NewQuarantineXattrHandler(node libkbfs.Node, folder *Folder,
) XattrHandler {
	return &QuarantineXattrHandler{
		node:   node,
		folder: folder,
	}
}

var _ XattrHandler = (*QuarantineXattrHandler)(nil)

// Getxattr implements the fs.NodeGetxattrer interface.
func (h *QuarantineXattrHandler) Getxattr(ctx context.Context,
	req *fuse.GetxattrRequest, resp *fuse.GetxattrResponse) (err error) {
	ctx = h.folder.fs.config.MaybeStartTrace(ctx, "QuarantineXattrHandler.Getxattr",
		fmt.Sprintf("%s %s", h.node.GetBasename(), req.Name))
	defer func() { h.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	h.folder.fs.log.CDebugf(ctx,
		"QuarantineXattrHandler Getxattr %s %s", h.node.GetBasename(), req.Name)
	defer func() { err = h.folder.processError(ctx, libkbfs.ReadMode, err) }()

	if req.Name != quarantineXattrName {
		// The request is not about quarantine. Let the OS fallback to ._ file
		// based method.
		return fuse.ENOTSUP
	}

	xattr, err := h.folder.fs.config.DiskBlockMetadataStore().GetXattr(
		ctx, h.node.GetBlockID(), libkbfs.XattrAppleQuarantine)
	switch err {
	case nil:
		if len(xattr) == 0 {
			return fuse.ENOATTR
		}
		resp.Xattr = xattr
		return nil
	case ldberrors.ErrNotFound:
		// We don't have an Xattr value stored locally, so just use a
		// quarantine value.

		// Stat on the node to get the Mtime.

		// This fits in situation 1 as described in
		// libkbfs/delayed_cancellation.go
		if err = libkbfs.EnableDelayedCancellationWithGracePeriod(ctx,
			h.folder.fs.config.DelayedCancellationGracePeriod()); err != nil {
			return err
		}
		de, err := h.folder.fs.config.KBFSOps().Stat(ctx, h.node)
		if err != nil {
			if _, ok := err.(libkbfs.NoSuchNameError); ok {
				// The node is not found, so just return ENOTSUP
				return fuse.ENOTSUP
			}
			return err
		}

		resp.Xattr = makeQuarantine(time.Unix(0, de.Mtime))
		return nil
	default:
		return err
	}
}

// Setxattr implements the fs.NodeSetxattrer interface.
func (h *QuarantineXattrHandler) Setxattr(ctx context.Context,
	req *fuse.SetxattrRequest) (err error) {
	ctx = h.folder.fs.config.MaybeStartTrace(ctx, "QuarantineXattrHandler.Setxattr",
		fmt.Sprintf("%s %s", h.node.GetBasename(), req.Name))
	defer func() { h.folder.fs.config.MaybeFinishTrace(ctx, err) }()

	h.folder.fs.log.CDebugf(ctx, "QuarantineXattrHandler Setxattr %s", req.Name)
	defer func() { err = h.folder.processError(ctx, libkbfs.ReadMode, err) }()

	if req.Name != quarantineXattrName {
		// The request is not about quarantine. Let the OS fallback to ._ file
		// based method.
		return fuse.ENOTSUP
	}

	return h.folder.fs.config.DiskBlockMetadataStore().SetXattr(ctx,
		h.node.GetBlockID(), libkbfs.XattrAppleQuarantine, req.Xattr)
}

// Removexattr implements the fs.NodeRemovexattrer interface.
func (h *QuarantineXattrHandler) Removexattr(
	ctx context.Context, req *fuse.RemovexattrRequest) error {
	if req.Name != quarantineXattrName {
		// The request is not about quarantine. Let the OS fallback to ._ file
		// based method.
		return fuse.ENOTSUP
	}

	return h.folder.fs.config.DiskBlockMetadataStore().SetXattr(ctx,
		h.node.GetBlockID(), libkbfs.XattrAppleQuarantine, nil)
}
