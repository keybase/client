// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"os"

	billy "gopkg.in/src-d/go-billy.v4"
)

// RecursiveDelete deletes the given entry from the given filesystem.
// If it's a directory, first all the items in the directory are
// deleted recursively.
func RecursiveDelete(
	ctx context.Context, fs billy.Filesystem, fi os.FileInfo) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if !fi.IsDir() {
		// Delete regular files and symlinks directly.
		return fs.Remove(fi.Name())
	}

	subdirFS, err := fs.Chroot(fi.Name())
	if err != nil {
		return err
	}

	children, err := subdirFS.ReadDir("/")
	if err != nil {
		return err
	}
	for _, childFI := range children {
		if childFI.Name() == "." {
			continue
		}
		err := RecursiveDelete(ctx, subdirFS, childFI)
		if err != nil {
			return err
		}
	}

	return fs.Remove(fi.Name())
}
