// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"time"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

// GetEncodedUserEditHistory returns serialized JSON containing the
// file edit history for the user.
func GetEncodedUserEditHistory(ctx context.Context, config libkbfs.Config) (
	data []byte, t time.Time, err error) {
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, config.KBPKI(), true)
	if err != nil {
		return nil, time.Time{}, err
	}

	edits := config.UserHistory().Get(string(session.Name))
	data, err = PrettyJSON(edits)
	return data, time.Time{}, err
}
