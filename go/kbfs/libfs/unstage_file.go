// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"bytes"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// UnstageForTesting unstages all unmerged commits and fast-forwards
// to the current master, if the given data is non-empty. If the given
// data is empty, it does nothing.
//
// This should only be needed if there is a bug in automatic conflict
// resolution.
//
// If the given data begins with the bytes "async", the unstaging is
// done asynchronously, i.e. this function returns immediately and the
// unstaging happens in the background. (Other subsequent IO
// operations may be blocked, though.) You can figure out when the
// unstage succeeds by consulting .kbfs_status.
func UnstageForTesting(ctx context.Context, log logger.Logger,
	config libkbfs.Config, fb data.FolderBranch,
	data []byte) (int, error) {
	log.CDebugf(ctx, "UnstageForTesting(%v, %v)", fb, data)
	if len(data) == 0 {
		return 0, nil
	}

	if bytes.HasPrefix(data, []byte("async")) {
		go func() {
			ctx := context.Background()
			err := config.KBFSOps().UnstageForTesting(ctx, fb)
			if err != nil {
				log.Warning("Async UnstageForTesting error: %v", err)
			}
		}()
	} else {
		err := config.KBFSOps().UnstageForTesting(ctx, fb)
		if err != nil {
			return 0, err
		}
	}
	return len(data), nil
}
