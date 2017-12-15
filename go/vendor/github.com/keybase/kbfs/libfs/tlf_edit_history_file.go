// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// GetEncodedTlfEditHistory returns serialized JSON containing the
// file edit history for a folder.
func GetEncodedTlfEditHistory(ctx context.Context, config libkbfs.Config,
	folderBranch libkbfs.FolderBranch) (
	data []byte, t time.Time, err error) {
	edits, err := config.KBFSOps().GetEditHistory(ctx, folderBranch)
	if err != nil {
		return nil, time.Time{}, err
	}

	data, err = PrettyJSON(edits)
	return data, time.Time{}, err
}
