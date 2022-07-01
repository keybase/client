// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// Symlink represents KBFS symlinks.
type Symlink struct {
	// The directory this symlink is in. This should be safe to store
	// here, without fear of Renames etc making it stale, because we
	// never persist a Symlink into Folder.nodes; it has no
	// libkbfs.Node, so that's impossible. This should make FUSE
	// Lookup etc always get new nodes, limiting the lifetime of a
	// single Symlink value.
	parent *Dir
	// isTargetADirectory - Some Windows programs want to know.
	isTargetADirectory bool
	name               string
	emptyFile
}

// GetFileInformation does stat for dokan.
func (s *Symlink) GetFileInformation(ctx context.Context, fi *dokan.FileInfo) (a *dokan.Stat, err error) {
	s.parent.folder.fs.logEnter(ctx, "Symlink GetFileInformation")
	defer func() { s.parent.folder.reportErr(ctx, libkbfs.ReadMode, err) }()

	_, _, err = s.parent.folder.fs.config.KBFSOps().Lookup(
		ctx, s.parent.node, s.parent.node.ChildName(s.name))
	if err != nil {
		return nil, errToDokan(err)
	}

	if s.isTargetADirectory {
		return defaultSymlinkDirInformation()
	}
	return defaultSymlinkFileInformation()
}
