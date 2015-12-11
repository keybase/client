// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"encoding/json"
	"time"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// StatusFileName is the name of the KBFS status file -- it can be
// reached anywhere within a top-level folder.
const StatusFileName = ".kbfs_status"

func getEncodedStatus(ctx context.Context, folder *Folder) (
	data []byte, t time.Time, err error) {
	var status libkbfs.FolderBranchStatus
	status, _, err = folder.fs.config.KBFSOps().
		Status(ctx, folder.folderBranch)
	if err != nil {
		return nil, time.Time{}, err
	}

	data, err = json.MarshalIndent(status, "", "  ")
	if err != nil {
		return nil, time.Time{}, err
	}

	data = append(data, '\n')
	return data, time.Time{}, err
}

// NewStatusFile returns a special read file that contains a text
// representation of the status of the current TLF.
func NewStatusFile(folder *Folder) *SpecialReadFile {
	return &SpecialReadFile{
		read: func() ([]byte, time.Time, error) {
			return getEncodedStatus(context.TODO(), folder)
		},
	}
}
