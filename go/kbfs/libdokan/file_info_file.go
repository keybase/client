// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// NewFileInfoFile returns a special file that contains a text
// representation of a file's KBFS metadata.
func NewFileInfoFile(
	fs *FS, dir libkbfs.Node, name string) *SpecialReadFile {
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			return libfs.GetFileInfo(ctx, fs.config, dir, name)
		},
		fs: fs,
	}
}
