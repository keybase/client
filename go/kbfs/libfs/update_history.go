// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"encoding/json"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// GetEncodedUpdateHistory returns a JSON-encoded version of a TLF's
// complete update history.
func GetEncodedUpdateHistory(
	ctx context.Context, config libkbfs.Config,
	folderBranch data.FolderBranch) (
	data []byte, t time.Time, err error) {
	history, err := config.KBFSOps().GetUpdateHistory(ctx, folderBranch)
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
