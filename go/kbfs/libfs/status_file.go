// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// GetEncodedFolderStatus returns serialized JSON containing status information
// for a folder
func GetEncodedFolderStatus(ctx context.Context, config libkbfs.Config,
	folderBranch libkbfs.FolderBranch) (
	data []byte, t time.Time, err error) {
	var status libkbfs.FolderBranchStatus
	status, _, err = config.KBFSOps().FolderStatus(ctx, folderBranch)
	if err != nil {
		return nil, time.Time{}, err
	}

	data, err = PrettyJSON(status)
	return
}

// GetEncodedStatus returns serialized JSON containing top-level KBFS status
// information
func GetEncodedStatus(ctx context.Context, config libkbfs.Config) (
	data []byte, t time.Time, err error) {
	status, _, err := config.KBFSOps().Status(ctx)
	if err != nil {
		config.Reporter().ReportErr(ctx, "", tlf.Private, libkbfs.ReadMode, err)
	}
	data, err = PrettyJSON(status)
	return
}
