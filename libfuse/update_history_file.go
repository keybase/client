// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"encoding/json"
	"time"

	"golang.org/x/net/context"
)

// UpdateHistoryFileName is the name of the KBFS update history -- it
// can be reached anywhere within a top-level folder.
const UpdateHistoryFileName = ".kbfs_update_history"

func getEncodedUpdateHistory(ctx context.Context, folder *Folder) (
	data []byte, t time.Time, err error) {
	folderBranch := folder.getFolderBranch()
	history, err := folder.fs.config.KBFSOps().GetUpdateHistory(
		ctx, folderBranch)
	if err != nil {
		return nil, time.Time{}, err
	}

	data, err = json.Marshal(history)
	if err != nil {
		return nil, time.Time{}, err
	}

	data = append(data, '\n')
	return data, time.Time{}, nil
}

// NewUpdateHistoryFile returns a special read file that contains a text
// representation of the update history of the current TLF.
func NewUpdateHistoryFile(
	folder *Folder, entryValid *time.Duration) *SpecialReadFile {
	*entryValid = 0
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			return getEncodedUpdateHistory(ctx, folder)
		},
	}
}
