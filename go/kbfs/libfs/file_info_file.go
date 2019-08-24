// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type fileInfoFile struct {
	libkbfs.NodeMetadata
	data.PrevRevisions
}

// GetFileInfo returns serialized JSON containing status information
// for a file or directory entry.
func GetFileInfo(
	ctx context.Context, config libkbfs.Config, dir libkbfs.Node, name string) (
	data []byte, t time.Time, err error) {
	node, ei, err := config.KBFSOps().Lookup(ctx, dir, dir.ChildName(name))
	if err != nil {
		return nil, time.Time{}, err
	}
	nmd, err := config.KBFSOps().GetNodeMetadata(ctx, node)
	if err != nil {
		return nil, time.Time{}, err
	}
	data, err = PrettyJSON(fileInfoFile{nmd, ei.PrevRevisions})
	if err != nil {
		return nil, time.Time{}, err
	}
	return data, time.Unix(0, ei.Mtime), nil
}
